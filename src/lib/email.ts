/**
 * Email helpers — enqueue via BullMQ; worker delivers via SMTP (or logs in dev).
 */
import { randomBytes } from "node:crypto";
import { env } from "./env";
import { getQueue, QUEUE_NAMES } from "./queue";
import { logger } from "./logger";

export type EmailJob = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function enqueueEmail(job: EmailJob) {
  try {
    await getQueue(QUEUE_NAMES.emailSend).add("send", job, {
      removeOnComplete: true,
    });
  } catch (err) {
    // Don't fail the HTTP request if Redis is down — log and continue.
    logger.error({ err, to: job.to }, "email.enqueue_failed");
  }
}

export function appUrl(path = "") {
  const base = env.APP_URL.replace(/\/$/, "");
  return path ? `${base}${path.startsWith("/") ? path : `/${path}`}` : base;
}

export function brandingShell(body: string) {
  return `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;max-width:560px;margin:0 auto;padding:24px">
  <div style="font-weight:700;font-size:18px;margin-bottom:16px">${env.APP_NAME}</div>
  ${body}
  <p style="margin-top:32px;font-size:12px;color:#666">— ${env.APP_NAME}</p>
</body></html>`;
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = appUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  await enqueueEmail({
    to,
    subject: `Reset your ${env.APP_NAME} password`,
    text: `Reset your password: ${link}\nThis link expires in 1 hour.`,
    html: brandingShell(`
      <p>We received a request to reset your password.</p>
      <p><a href="${link}" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Reset password</a></p>
      <p style="font-size:13px;color:#666">Or copy this link: ${link}</p>
      <p style="font-size:13px;color:#666">If you didn't request this, you can ignore this email. The link expires in 1 hour.</p>
    `),
  });
}

export async function sendEmailVerification(to: string, token: string) {
  const link = appUrl(`/verify?token=${encodeURIComponent(token)}`);
  await enqueueEmail({
    to,
    subject: `Verify your ${env.APP_NAME} email`,
    text: `Verify your email: ${link}`,
    html: brandingShell(`
      <p>Confirm your email to finish setting up your account.</p>
      <p><a href="${link}" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Verify email</a></p>
    `),
  });
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
