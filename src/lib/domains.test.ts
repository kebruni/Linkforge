import { describe, expect, it } from "vitest";
import { isValidHostname, makeDomainVerifyToken, normalizeDomain } from "./domains";

describe("domains helpers", () => {
  it("normalizes hostnames", () => {
    expect(normalizeDomain("https://Links.Example.com/path")).toBe("links.example.com");
    expect(normalizeDomain("links.example.com.")).toBe("links.example.com");
  });

  it("validates hostnames", () => {
    expect(isValidHostname("links.example.com")).toBe(true);
    expect(isValidHostname("localhost")).toBe(false);
    expect(isValidHostname("not a domain")).toBe(false);
    expect(isValidHostname("a.co")).toBe(true);
  });

  it("creates verify tokens", () => {
    const t = makeDomainVerifyToken();
    expect(t.startsWith("lf-verify=")).toBe(true);
    expect(t.length).toBeGreaterThan(20);
  });
});
