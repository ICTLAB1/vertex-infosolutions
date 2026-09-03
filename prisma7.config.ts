// Prisma reads this for the schema location, the migrations directory and the
// database URL. The URL rule lives in ./prisma/datasource-url.ts so it can be
// tested — it broke an image build once.
import "dotenv/config";
import { defineConfig } from "prisma/config";

import { datasourceUrl } from "./prisma/datasource-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: datasourceUrl(process.env["DATABASE_URL"], process.argv),
  },
});
