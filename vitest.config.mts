import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Tests run in Node, not in Next's runtime.
 *
 * Two aliases make that possible. `@/` is the same path alias tsconfig uses,
 * and `server-only` — the package that throws if a module is imported into a
 * client bundle — is stubbed, because outside Next there is no bundle to
 * protect and the guard would fail every import.
 *
 * Tests needing a database are skipped unless DATABASE_URL is set, so
 * `npm test` is useful on a laptop with nothing running, and CI (which does
 * start Postgres) gets the full suite.
 */
export default defineConfig({
  test: {
    environment: "node",
    // Loads .env so the database-backed tests find DATABASE_URL locally. In CI
    // the workflow sets it directly and this is a no-op.
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // A test that talks to Postgres and one that hashes a password with scrypt
    // are both slower than a pure unit test; the default 5s is too tight.
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // The database tests share one schema, so they must not interleave.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
});
