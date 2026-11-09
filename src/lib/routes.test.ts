import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { navItems } from "./navigation";
import { routePermissions } from "./permissions";

const appDir = join(process.cwd(), "src", "app", "(app)");

function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pageFiles(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

// src/app/(app)/orders/[id]/page.tsx → /orders/[id]
function routeOf(file: string) {
  const folder = relative(appDir, file).split(sep).slice(0, -1).join("/");
  return `/${folder}`;
}

const pages = pageFiles(appDir).map((file) => ({ file, route: routeOf(file), source: readFileSync(file, "utf8") }));

// Guards against a new page that forgets its access rule: every signed-in page must have an entry in
// routePermissions and render inside <RequireAccess> (the server-side check).
describe("every app page is guarded on the server", () => {
  it("finds the pages", () => {
    expect(pages.length).toBeGreaterThan(20);
  });

  for (const { route, source } of pages) {
    it(route, () => {
      expect(Object.keys(routePermissions)).toContain(route);
      // The page must check its own route, not just any route (a copy-pasted guard would open it to the wrong roles).
      const ownRoute = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(source).toMatch(new RegExp(`<RequireAccess\\s+route="${ownRoute}"`));
    });
  }

  it("has an access rule for every sidebar link", () => {
    for (const item of navItems) expect(Object.keys(routePermissions), item.href).toContain(item.href);
  });
});
