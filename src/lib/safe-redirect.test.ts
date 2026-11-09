import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps same-site paths with query strings", () => {
    expect(safeRedirectPath("/orders?page=2")).toBe("/orders?page=2");
    expect(safeRedirectPath("/update-password")).toBe("/update-password");
  });

  it("rejects other sites and falls back to the dashboard", () => {
    expect(safeRedirectPath("https://evil.com")).toBe("/");
    expect(safeRedirectPath("//evil.com")).toBe("/");
    expect(safeRedirectPath("/\\evil.com")).toBe("/");
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/");
  });

  // Browsers remove tabs and newlines from URLs, so these would turn into "//evil.com".
  it("rejects paths that become another site once the browser parses them", () => {
    expect(safeRedirectPath("/\t/evil.com")).toBe("/");
    expect(safeRedirectPath("/\n/evil.com")).toBe("/");
    expect(safeRedirectPath("/\r\n/evil.com")).toBe("/");
    expect(safeRedirectPath("/\\\\evil.com")).toBe("/");
    expect(safeRedirectPath("\\/evil.com")).toBe("/");
  });

  // "." and ".." segments collapse, which would turn these into "//evil.com" after normalizing.
  it("rejects paths that collapse into another site", () => {
    expect(safeRedirectPath("/.//evil.com")).toBe("/");
    expect(safeRedirectPath("/..//evil.com")).toBe("/");
    expect(safeRedirectPath("/%2e//evil.com")).toBe("/");
    expect(safeRedirectPath("/a/..//evil.com")).toBe("/");
    expect(safeRedirectPath("/./\\evil.com")).toBe("/");
  });

  it("ignores values that are not strings", () => {
    expect(safeRedirectPath(42)).toBe("/");
    expect(safeRedirectPath({ toString: () => "//evil.com" })).toBe("/");
  });

  it("keeps encoded characters as a harmless same-site path", () => {
    expect(safeRedirectPath("/%2F%2Fevil.com")).toBe("/%2F%2Fevil.com");
    expect(safeRedirectPath("/orders#top")).toBe("/orders#top");
  });

  it("uses the fallback for empty values", () => {
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath("", "/login")).toBe("/login");
  });
});
