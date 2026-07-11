/**
 * Dispatch outbound webhooks for a user (fire-and-forget via BullMQ).
 */
import type { WebhookEventType } from "@prisma/client";
import { prisma } from "./prisma";
import { getQueue, QUEUE_NAMES } from "./queue";
import { logger } from "./logger";

export async function dispatchUserWebhooks(
  userId: string,
  eventType: WebhookEventType,
  payload: Record<string, unknown>,
) {
  try {
    const hooks = await prisma.webhook.findMany({
      where: {
        userId,
        active: true,
        events: { has: eventType },
      },
      select: { id: true },
    });
    if (hooks.length === 0) return;

    const queue = getQueue(QUEUE_NAMES.webhookDeliver);
    await Promise.all(
      hooks.map((h) =>
        queue.add(
          "deliver",
          { webhookId: h.id, eventType, payload },
          { removeOnComplete: true },
        ),
      ),
    );
  } catch (err) {
    logger.warn({ err, userId, eventType }, "webhooks.dispatch_failed");
  }
}
