import { describe, expect, it } from "vitest";
import { validateBlockContent, BLOCK_PALETTE } from "./index";

describe("validateBlockContent", () => {
  it("accepts a valid link block", () => {
    const r = validateBlockContent("LINK", {
      label: "Portfolio",
      url: "https://example.com",
    });
    expect(r.success).toBe(true);
  });

  it("rejects link without url", () => {
    const r = validateBlockContent("LINK", { label: "x" });
    expect(r.success).toBe(false);
  });

  it("accepts FAQ items", () => {
    const r = validateBlockContent("FAQ", {
      items: [{ q: "Hi?", a: "Hello" }],
    });
    expect(r.success).toBe(true);
  });

  it("accepts countdown ISO date", () => {
    const r = validateBlockContent("COUNTDOWN", {
      targetAt: new Date().toISOString(),
    });
    expect(r.success).toBe(true);
  });
});

describe("BLOCK_PALETTE", () => {
  it("includes core blocks", () => {
    const kinds = new Set(BLOCK_PALETTE.map((b) => b.kind));
    expect(kinds.has("LINK")).toBe(true);
    expect(kinds.has("FORM")).toBe(true);
    expect(kinds.has("MAP")).toBe(true);
    expect(kinds.has("PRODUCT")).toBe(true);
  });
});
