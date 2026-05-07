import { describe, expect, it } from "vitest";

import { decryptString, encryptString, sha256Hex } from "@/lib/crypto";

describe("crypto", () => {
  it("round-trips a short ASCII string", () => {
    const enc = encryptString("hello world");
    expect(enc).not.toEqual("hello world");
    expect(decryptString(enc)).toEqual("hello world");
  });

  it("round-trips an empty string", () => {
    const enc = encryptString("");
    expect(decryptString(enc)).toEqual("");
  });

  it("round-trips multibyte unicode", () => {
    const plain = "Привет, мир — 𝕃inkforge";
    const enc = encryptString(plain);
    expect(decryptString(enc)).toEqual(plain);
  });

  it("produces a fresh ciphertext each call (random IV)", () => {
    const a = encryptString("same plaintext");
    const b = encryptString("same plaintext");
    expect(a).not.toEqual(b);
    expect(decryptString(a)).toEqual(decryptString(b));
  });

  it("rejects a tampered ciphertext", () => {
    const enc = encryptString("don't tamper with me");
    // Flip one byte in the ciphertext portion (after iv+tag prefix).
    const buf = Buffer.from(enc, "base64");
    buf[buf.length - 1] = buf[buf.length - 1] ^ 0xff;
    const tampered = buf.toString("base64");
    expect(() => decryptString(tampered)).toThrow();
  });

  it("sha256Hex is deterministic and 64-char hex", () => {
    const a = sha256Hex("Linkforge");
    const b = sha256Hex("Linkforge");
    expect(a).toEqual(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex("Linkforge!")).not.toEqual(a);
  });
});
