import { describe, expect, it } from "vitest";

import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normalize,
  safeEqual,
} from "@/lib/recovery";

describe("recovery codes", () => {
  it("generates exactly 10 unique formatted codes by default", () => {
    const { plain, hashes } = generateRecoveryCodes();
    expect(plain).toHaveLength(10);
    expect(hashes).toHaveLength(10);
    expect(new Set(plain).size).toBe(10);
    expect(new Set(hashes).size).toBe(10);
    for (const code of plain) {
      // 5 chars, dash, 5 chars from the safe alphabet.
      expect(code).toMatch(/^[a-z0-9]{5}-[a-z0-9]{5}$/);
    }
  });

  it("hashes are deterministic for normalized input", () => {
    const { plain, hashes } = generateRecoveryCodes(3);
    plain.forEach((p, i) => {
      expect(hashRecoveryCode(p)).toEqual(hashes[i]);
      // case + whitespace doesn't matter
      expect(hashRecoveryCode(p.toUpperCase())).toEqual(hashes[i]);
      expect(hashRecoveryCode(`  ${p}  `)).toEqual(hashes[i]);
    });
  });

  it("normalize strips non-alnum and lowercases", () => {
    expect(normalize("AB-CD ef")).toEqual("abcdef");
    expect(normalize("XYZ-123")).toEqual("xyz123");
    expect(normalize("")).toEqual("");
  });

  it("safeEqual returns true for byte-equal hex strings", () => {
    expect(safeEqual("deadbeef", "deadbeef")).toBe(true);
    // hex parsing is case-insensitive, so these decode to the same bytes
    expect(safeEqual("deadbeef", "DEADBEEF")).toBe(true);
    expect(safeEqual("deadbeef", "cafebabe")).toBe(false);
    expect(safeEqual("deadbeef", "dead")).toBe(false); // length mismatch
  });

  it("respects custom count", () => {
    const { plain } = generateRecoveryCodes(5);
    expect(plain).toHaveLength(5);
  });
});
