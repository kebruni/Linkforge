import { describe, expect, it } from "vitest";
import {
  apiKeyLimitFor,
  canUseCustomDomains,
  FREE_PAGE_LIMIT,
  isProRole,
  pageLimitFor,
  shortLinkLimitFor,
  webhookLimitFor,
} from "./plan";

describe("plan gates", () => {
  it("identifies pro roles", () => {
    expect(isProRole("USER")).toBe(false);
    expect(isProRole("PRO")).toBe(true);
    expect(isProRole("ADMIN")).toBe(true);
    expect(isProRole("SUPPORT")).toBe(true);
  });

  it("limits free pages and shorts", () => {
    expect(pageLimitFor("USER")).toBe(FREE_PAGE_LIMIT);
    expect(pageLimitFor("PRO")).toBe(Number.POSITIVE_INFINITY);
    expect(shortLinkLimitFor("USER")).toBeLessThan(shortLinkLimitFor("PRO"));
  });

  it("locks developer features to PRO", () => {
    expect(webhookLimitFor("USER")).toBe(0);
    expect(apiKeyLimitFor("USER")).toBe(0);
    expect(webhookLimitFor("PRO")).toBeGreaterThan(0);
    expect(apiKeyLimitFor("PRO")).toBeGreaterThan(0);
    expect(canUseCustomDomains("USER")).toBe(false);
    expect(canUseCustomDomains("PRO")).toBe(true);
  });
});
