import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Every door into the back office is locked.
 *
 * This reads the source rather than exercising the routes, on purpose. The
 * failure it is guarding against is somebody adding a page or an action six
 * months from now and forgetting the guard — and that mistake produces a route
 * no test knows to visit, so a test that visits routes cannot catch it. A test
 * that walks the directory can.
 *
 * The layout's guard is not enough on its own: a layout does not run before a
 * server action, so an unguarded action would be reachable by anybody who can
 * post a form, signed in or not.
 */
const ADMIN = join(process.cwd(), "src/app/admin");

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const sources = filesUnder(ADMIN).filter((path) => path.endsWith(".tsx") || path.endsWith(".ts"));
const relative = (path: string) => path.slice(process.cwd().length + 1);

describe("the admin area", () => {
  it("has pages to guard", () => {
    // A test that silently passes because it found nothing is worse than none.
    expect(sources.length).toBeGreaterThan(4);
  });

  it("guards every page and layout", () => {
    const pages = sources.filter(
      (path) => path.endsWith("/page.tsx") || path.endsWith("/layout.tsx"),
    );
    expect(pages.length).toBeGreaterThan(3);

    for (const path of pages) {
      expect(
        readFileSync(path, "utf8"),
        `${relative(path)} does not call requireAdmin`,
      ).toContain("requireAdmin(");
    }
  });

  /**
   * Every exported server action, not just the file. An action is a public
   * endpoint with a generated URL, reachable by anybody who can post to it.
   */
  it("guards every server action, one by one", () => {
    const actionFiles = sources.filter((path) => path.endsWith("-actions.ts"));
    expect(actionFiles.length).toBeGreaterThan(0);

    for (const path of actionFiles) {
      const source = readFileSync(path, "utf8");
      expect(source.startsWith('"use server"'), relative(path)).toBe(true);

      // Split on the exported functions and check each body in turn, so an
      // unguarded action cannot hide behind a guarded one in the same file.
      const bodies = source.split(/export async function /).slice(1);
      expect(bodies.length).toBeGreaterThan(2);
      for (const body of bodies) {
        const name = body.slice(0, body.indexOf("("));
        expect(body, `${relative(path)}: ${name} does not call requireAdmin`).toContain(
          "requireAdmin(",
        );
      }
    }
  });

  /**
   * The back office must never be indexed, and must never be reachable without
   * a session — the layout carries the robots directive for the whole tree.
   */
  it("keeps itself out of search results", () => {
    const layout = readFileSync(join(ADMIN, "layout.tsx"), "utf8");
    expect(layout).toContain("robots");
    expect(layout).toContain("index: false");
  });
});
