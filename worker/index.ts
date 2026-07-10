/**
 * Linkforge worker — drains Redis streams + BullMQ queues into Postgres.
 *
 * Runs as a separate process (pnpm worker / docker compose service).  Sharing
 * the same package.json keeps types and Prisma client in sync with the web
 * app; the only orchestration difference is that this entrypoint does not
 * start an HTTP server.
 */
import { createHmac } from "node:crypto";
import { Worker, type Job } from "bullmq";
import { PrismaClient, AnalyticsEventType } from "@prisma/client";
import nodemailer from "nodemailer";

// Env is injected by Docker / process manager — no dotenv in production.
import { env } from "../src/lib/env";
import { redis } from "../src/lib/redis";
import { QUEUE_NAMES } from "../src/lib/queue";
import { logger } from "../src/lib/logger";

const prisma = new PrismaClient({ log: ["error"] });

const STREAM_KEY = "analytics:stream";
const STREAM_GROUP = "analytics-workers";
const STREAM_CONSUMER = `worker-${process.pid}`;

const TYPE_MAP: Record<string, AnalyticsEventType> = {
  PAGE_VIEW: AnalyticsEventType.PAGE_VIEW,
  BLOCK_CLICK: AnalyticsEventType.BLOCK_CLICK,
  FORM_SUBMIT: AnalyticsEventType.FORM_SUBMIT,
  PRODUCT_PURCHASE: AnalyticsEventType.PRODUCT_PURCHASE,
};

async function ensureGroup() {
  try {
    await redis.xgroup("CREATE", STREAM_KEY, STREAM_GROUP, "0", "MKSTREAM");
    logger.info("worker: created stream group");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("BUSYGROUP")) throw err;
  }
}

interface ParsedEvent {
  type: AnalyticsEventType;
  pageId: string;
  blockId: string | null;
  visitorId: string | null;
  ipHash: string | null;
  country: string;
  device: string;
  os: string;
  browser: string;
  referer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  occurredAt: Date;
}

function parseFields(fields: string[]): ParsedEvent | null {
  const obj: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    const k = fields[i];
    const v = fields[i + 1];
    if (k !== undefined && v !== undefined) obj[k] = v;
  }
  const type = TYPE_MAP[obj.type ?? ""];
  if (!type || !obj.pageId) return null;
  const ts = Number(obj.ts);
  return {
    type,
    pageId: obj.pageId,
    blockId: obj.blockId || null,
    visitorId: obj.visitorId || null,
    ipHash: obj.ipHash || null,
    country: obj.country || "ZZ",
    device: obj.device || "unknown",
    os: obj.os || "unknown",
    browser: obj.browser || "unknown",
    referer: obj.referer || null,
    utmSource: obj.utmSource || null,
    utmMedium: obj.utmMedium || null,
    utmCampaign: obj.utmCampaign || null,
    utmTerm: obj.utmTerm || null,
    utmContent: obj.utmContent || null,
    occurredAt: Number.isFinite(ts) ? new Date(ts) : new Date(),
  };
}

async function flush(events: ParsedEvent[]) {
  if (events.length === 0) return;

  // Resolve owner ids in one query
  const pageIds = Array.from(new Set(events.map((e) => e.pageId)));
  const pages = await prisma.page.findMany({
    where: { id: { in: pageIds } },
    select: { id: true, userId: true },
  });
  const ownerOf = new Map(pages.map((p) => [p.id, p.userId]));

  const validEvents = events.filter((e) => ownerOf.has(e.pageId));
  if (validEvents.length === 0) return;

  await prisma.analyticsEvent.createMany({
    data: validEvents.map((e) => ({
      pageId: e.pageId,
      blockId: e.blockId,
      ownerId: ownerOf.get(e.pageId)!,
      type: e.type,
      occurredAt: e.occurredAt,
      visitorId: e.visitorId,
      ipHash: e.ipHash,
      country: e.country,
      device: e.device,
      os: e.os,
      browser: e.browser,
      referer: e.referer,
      utmSource: e.utmSource,
      utmMedium: e.utmMedium,
      utmCampaign: e.utmCampaign,
      utmTerm: e.utmTerm,
      utmContent: e.utmContent,
    })),
  });

  // Update daily roll-ups
  const buckets = new Map<
    string,
    { pageId: string; ownerId: string; day: Date; views: number; clicks: number; uniques: Set<string> }
  >();
  for (const e of validEvents) {
    const day = new Date(e.occurredAt);
    day.setUTCHours(0, 0, 0, 0);
    const key = `${e.pageId}:${day.toISOString()}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        pageId: e.pageId,
        ownerId: ownerOf.get(e.pageId)!,
        day,
        views: 0,
        clicks: 0,
        uniques: new Set<string>(),
      };
      buckets.set(key, bucket);
    }
    if (e.type === AnalyticsEventType.PAGE_VIEW) bucket.views += 1;
    if (e.type === AnalyticsEventType.BLOCK_CLICK) bucket.clicks += 1;
    if (e.visitorId) bucket.uniques.add(e.visitorId);
  }

  for (const b of buckets.values()) {
    await prisma.analyticsDaily.upsert({
      where: { pageId_day: { pageId: b.pageId, day: b.day } },
      update: {
        views: { increment: b.views },
        clicks: { increment: b.clicks },
        uniques: { increment: b.uniques.size },
      },
      create: {
        pageId: b.pageId,
        ownerId: b.ownerId,
        day: b.day,
        views: b.views,
        clicks: b.clicks,
        uniques: b.uniques.size,
      },
    });
  }
}

async function streamLoop() {
  await ensureGroup();
  logger.info("worker: analytics stream loop started");
  while (true) {
    try {
      const result = (await redis.xreadgroup(
        "GROUP",
        STREAM_GROUP,
        STREAM_CONSUMER,
        "COUNT",
        "200",
        "BLOCK",
        "5000",
        "STREAMS",
        STREAM_KEY,
        ">",
      )) as [string, [string, string[]][]][] | null;
      if (!result) continue;
      const ackIds: string[] = [];
      const events: ParsedEvent[] = [];
      for (const [, msgs] of result) {
        for (const [id, fields] of msgs) {
          const ev = parseFields(fields);
          if (ev) events.push(ev);
          ackIds.push(id);
        }
      }
      if (events.length > 0) {
        try {
          await flush(events);
        } catch (err) {
          logger.error({ err }, "worker.analytics.flush_failed");
        }
      }
      if (ackIds.length > 0) {
        try {
          await redis.xack(STREAM_KEY, STREAM_GROUP, ...ackIds);
        } catch (err) {
          logger.error({ err }, "worker.analytics.ack_failed");
        }
      }
    } catch (err) {
      logger.error({ err }, "worker.analytics.loop_error");
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

const queueWorkers: Worker[] = [];

function createMailTransport() {
  if (!env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
  });
}

function startBullWorkers() {
  const connection = { url: env.REDIS_URL };
  const mailer = createMailTransport();

  queueWorkers.push(
    new Worker(
      QUEUE_NAMES.imageProcess,
      async (job: Job) => {
        // Image variants land with S3 pipeline in a later pass
        logger.info({ id: job.id, name: job.name }, "image-process: accepted");
      },
      { connection },
    ),
  );

  queueWorkers.push(
    new Worker(
      QUEUE_NAMES.emailSend,
      async (job: Job<{ to: string; subject: string; html: string; text?: string }>) => {
        const { to, subject, html, text } = job.data ?? {};
        if (!to || !subject) {
          logger.warn({ id: job.id }, "email-send: missing fields");
          return;
        }
        if (!mailer) {
          logger.info(
            { id: job.id, to, subject },
            "email-send: SMTP not configured — logged only",
          );
          return;
        }
        await mailer.sendMail({
          from: env.EMAIL_FROM || `noreply@${new URL(env.APP_URL).hostname}`,
          to,
          subject,
          html,
          text: text ?? undefined,
        });
        logger.info({ id: job.id, to }, "email-send: delivered");
      },
      { connection },
    ),
  );

  queueWorkers.push(
    new Worker(
      QUEUE_NAMES.webhookDeliver,
      async (job: Job<{ webhookId: string; eventType: string; payload: unknown }>) => {
        const { webhookId, eventType, payload } = job.data ?? {};
        if (!webhookId) {
          logger.warn({ id: job.id }, "webhook-deliver: missing webhookId");
          return;
        }
        const hook = await prisma.webhook.findUnique({ where: { id: webhookId } });
        if (!hook || !hook.active) {
          logger.info({ webhookId }, "webhook-deliver: inactive or missing");
          return;
        }

        const body = JSON.stringify({
          id: job.id,
          type: eventType,
          createdAt: new Date().toISOString(),
          data: payload,
        });
        const signature = createHmac("sha256", hook.secret).update(body).digest("hex");

        let statusCode: number | null = null;
        let responseBody: string | null = null;
        try {
          const res = await fetch(hook.url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-linkforge-signature": `sha256=${signature}`,
              "x-linkforge-event": String(eventType ?? ""),
            },
            body,
            signal: AbortSignal.timeout(15_000),
          });
          statusCode = res.status;
          responseBody = (await res.text()).slice(0, 2000);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          await prisma.webhook.update({
            where: { id: hook.id },
            data: { failureCount: 0, lastErrorAt: null },
          });
        } catch (err) {
          await prisma.webhook.update({
            where: { id: hook.id },
            data: {
              failureCount: { increment: 1 },
              lastErrorAt: new Date(),
            },
          });
          await prisma.webhookDelivery.create({
            data: {
              webhookId: hook.id,
              eventType: (eventType as never) ?? "PAGE_PUBLISHED",
              payload: payload as object,
              statusCode,
              responseBody,
              attempt: job.attemptsMade + 1,
            },
          });
          throw err;
        }

        await prisma.webhookDelivery.create({
          data: {
            webhookId: hook.id,
            eventType: (eventType as never) ?? "PAGE_PUBLISHED",
            payload: payload as object,
            statusCode,
            responseBody,
            attempt: job.attemptsMade + 1,
            deliveredAt: new Date(),
          },
        });
        logger.info({ webhookId, statusCode }, "webhook-deliver: ok");
      },
      { connection },
    ),
  );

  for (const w of queueWorkers) {
    w.on("failed", (job, err) => logger.error({ jobId: job?.id, err }, "queue.failed"));
  }
}

async function main() {
  startBullWorkers();
  await streamLoop();
}

const shutdown = async (signal: string) => {
  logger.warn({ signal }, "worker: shutting down");
  for (const w of queueWorkers) await w.close().catch(() => undefined);
  await redis.quit().catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void main().catch((err) => {
  logger.fatal({ err }, "worker: fatal");
  process.exit(1);
});
