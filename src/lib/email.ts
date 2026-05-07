/**
 * Email send helpers — both inline (for transactional emails on the request
 * path) and queue-based (for retry-friendly background sends).
 *
 * The actual SMTP transport is constructed lazily in the worker process so the
 * web bundle stays small and edge-safe.  When `SMTP_HOST` is unset we degrade
 * to a "log to stdout" transport so dev never blocks on a real mail server.
 */
import { getQueue, QUEUE_NAMES } from "./queue";
import { logger } from "./logger";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Tag used by the worker to surface in logs / future audit. */
  template?: string;
  meta?: Record<string, unknown>;
}

export async function enqueueEmail(msg: MailMessage): Promise<void> {
  try {
    await getQueue(QUEUE_NAMES.emailSend).add("send", msg, {
      removeOnComplete: { count: 1000, age: 3600 },
      removeOnFail: { age: 7 * 24 * 3600 },
    });
  } catch (err) {
    logger.warn({ err, to: msg.to, template: msg.template }, "email.enqueue_failed");
  }
}

/**
 * Render the suspicious-login email body.  Plain-text only on purpose — keeps
 * the email deliverable across providers and avoids HTML escaping pitfalls.
 */
export function renderNewDeviceEmail(input: {
  userName: string;
  deviceLabel: string;
  country: string | null;
  ip: string | null;
  occurredAt: Date;
  reviewUrl: string;
}): { subject: string; text: string } {
  const lines = [
    `Hi ${input.userName || "there"},`,
    "",
    `A new sign-in to your Linkforge account was detected:`,
    "",
    `  Device:   ${input.deviceLabel}`,
    `  Location: ${input.country ?? "Unknown"}`,
    `  IP:       ${input.ip ?? "Unknown"}`,
    `  Time:     ${input.occurredAt.toISOString()}`,
    "",
    `If this was you, no action is needed.`,
    `If you don't recognise this sign-in, secure your account now:`,
    `  ${input.reviewUrl}`,
    "",
    `— The Linkforge team`,
  ];
  return {
    subject: "New sign-in to your Linkforge account",
    text: lines.join("\n"),
  };
}
