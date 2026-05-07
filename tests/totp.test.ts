import { authenticator } from "otplib";
import { describe, expect, it } from "vitest";

import { buildTotpUri, generateTotpSecret, verifyTotpCode } from "@/lib/totp";

describe("totp", () => {
  it("generates a base32 secret", () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]+$/);
    expect(s.length).toBeGreaterThanOrEqual(16);
  });

  it("verifies the current OTP", () => {
    const secret = generateTotpSecret();
    const code = authenticator.generate(secret);
    expect(verifyTotpCode(secret, code)).toBe(true);
  });

  it("ignores whitespace in the submitted code", () => {
    const secret = generateTotpSecret();
    const code = authenticator.generate(secret);
    const padded = `${code.slice(0, 3)} ${code.slice(3)}`;
    expect(verifyTotpCode(secret, padded)).toBe(true);
  });

  it("rejects malformed codes", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "")).toBe(false);
    expect(verifyTotpCode(secret, "abc123")).toBe(false);
    expect(verifyTotpCode(secret, "12")).toBe(false);
    expect(verifyTotpCode(secret, "1234567890123")).toBe(false);
  });

  it("rejects a code from a different secret", () => {
    const secretA = generateTotpSecret();
    const secretB = generateTotpSecret();
    const code = authenticator.generate(secretA);
    expect(verifyTotpCode(secretB, code)).toBe(false);
  });

  it("buildTotpUri produces a parseable otpauth:// URI", () => {
    const secret = generateTotpSecret();
    const uri = buildTotpUri(secret, "alice@example.com");
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    const parsed = new URL(uri);
    expect(parsed.searchParams.get("secret")).toEqual(secret);
    expect(parsed.searchParams.get("issuer")).toBeTruthy();
  });
});
