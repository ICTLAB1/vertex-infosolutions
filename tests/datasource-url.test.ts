import { describe, expect, it } from "vitest";

import {
  datasourceUrl,
  OFFLINE_PLACEHOLDER,
} from "../prisma/datasource-url";

describe("resolving the database URL", () => {
  it("uses the environment when it is set", () => {
    expect(datasourceUrl("postgresql://host/db", ["prisma", "migrate"])).toBe(
      "postgresql://host/db",
    );
  });

  it("does not demand a URL for prisma generate", () => {
    // `npm ci` runs `prisma generate` inside the Docker build, where there is
    // deliberately no DATABASE_URL — the image must not be built carrying a
    // connection string. Requiring one here fails the build, which it did.
    expect(datasourceUrl(undefined, ["node", "prisma", "generate"])).toBe(
      OFFLINE_PLACEHOLDER,
    );
  });

  it("explains itself when a command really does need a database", () => {
    expect(() =>
      datasourceUrl(undefined, ["node", "prisma", "migrate", "deploy"]),
    ).toThrow(/DATABASE_URL is not set/);
    // Names the variable and the fix, not the config property.
    expect(() => datasourceUrl(undefined, ["node", "prisma", "db", "push"])).toThrow(
      /source ~\/vertex\.env/,
    );
  });
});
