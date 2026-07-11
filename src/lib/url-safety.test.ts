import { describe, expect, it } from "vitest";
import {
  assertSafePublicUrl,
  assertSafeWebhookUrl,
  safeHref,
  sanitizeBlockContentUrls,
} from "./url-safety";

describe("assertSafePublicUrl", () => {
  it("allows https", () => {
    const r = assertSafePublicUrl("https://example.com/a");
    expect(r.ok).toBe(true);
  });

  it("blocks javascript and data", () => {
    expect(assertSafePublicUrl("javascript:alert(1)").ok).toBe(false);
    expect(assertSafePublicUrl("data:text/html,hi").ok).toBe(false);
  });

  it("blocks private IPs and metadata", () => {
    expect(assertSafePublicUrl("http://169.254.169.254/").ok).toBe(false);
    expect(assertSafePublicUrl("http://127.0.0.1/").ok).toBe(false);
    expect(assertSafePublicUrl("http://10.0.0.5/x").ok).toBe(false);
    expect(assertSafePublicUrl("http://192.168.1.1").ok).toBe(false);
  });

  it("blocks localhost hostnames", () => {
    expect(assertSafePublicUrl("http://localhost:3000").ok).toBe(false);
  });

  it("allows mailto when opted in", () => {
    expect(assertSafePublicUrl("mailto:hi@example.com", { allowMailto: true }).ok).toBe(true);
  });
});

describe("assertSafeWebhookUrl", () => {
  it("blocks metadata", () => {
    expect(assertSafeWebhookUrl("http://169.254.169.254/latest/meta-data/").ok).toBe(false);
  });

  it("allows public https", () => {
    expect(assertSafeWebhookUrl("https://hooks.example.com/lf").ok).toBe(true);
  });
});

describe("safeHref", () => {
  it("falls back on evil schemes", () => {
    expect(safeHref("javascript:alert(1)")).toBe("#");
  });
});

describe("sanitizeBlockContentUrls", () => {
  it("rejects evil url in content", () => {
    const r = sanitizeBlockContentUrls({ url: "javascript:alert(1)", label: "x" });
    expect(r.ok).toBe(false);
  });

  it("normalizes https", () => {
    const r = sanitizeBlockContentUrls({ url: "https://ok.example/path" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.content.url).toContain("https://ok.example");
  });
});
