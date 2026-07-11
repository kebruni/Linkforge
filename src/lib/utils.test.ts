import { describe, expect, it } from "vitest";
import { cn, formatNumber, isValidSlug, slugify } from "./utils";

describe("cn", () => {
  it("merges tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", false && "hidden", "font-bold")).toBe("text-sm font-bold");
  });
});

describe("formatNumber", () => {
  it("formats small numbers as-is", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(999)).toBe("999");
  });
  it("formats thousands and millions", () => {
    expect(formatNumber(1500)).toBe("1.5k");
    expect(formatNumber(2_500_000)).toBe("2.5M");
  });
});

describe("isValidSlug", () => {
  it("accepts valid slugs", () => {
    expect(isValidSlug("maya")).toBe(true);
    expect(isValidSlug("maya-r")).toBe(true);
    expect(isValidSlug("a1b2")).toBe(true);
  });
  it("rejects invalid slugs", () => {
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("-maya")).toBe(false);
    expect(isValidSlug("Maya")).toBe(false);
    expect(isValidSlug("has space")).toBe(false);
  });
});

describe("slugify", () => {
  it("normalises input", () => {
    expect(slugify(" Hello World! ")).toBe("hello-world");
    expect(slugify("Foo___Bar")).toBe("foo-bar");
  });
  it("handles apostrophes and punctuation (page titles)", () => {
    expect(slugify("My name's")).toBe("my-names");
    expect(slugify("Café du Coin")).toBe("cafe-du-coin");
    expect(slugify("Hello!!!")).toBe("hello");
  });
  it("truncates to 32 chars", () => {
    expect(slugify("a".repeat(50)).length).toBeLessThanOrEqual(32);
  });
});
