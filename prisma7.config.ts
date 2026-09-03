// Prisma reads this for the schema location, the migrations directory and the
// database URL.
import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Fail with the actual problem.
 *
 * Without this, an unset `DATABASE_URL` reaches Prisma as `undefined` and it
 * reports "The datasource.url property is required in your Prisma config
 * file" — which sends you looking at this file, where nothing is wrong. The
 * environment variable is what is missing, and in Cloud Shell it goes missing
 * every time the session restarts.
 */
function databaseUrl(): string {
  const url = process.env["DATABASE_URL"];
  if (url) return url;

  throw new Error(
    "DATABASE_URL is not set.\n\n" +
      "  Locally:    copy .env.example to .env\n" +
      "  Cloud Shell after a restart, from ~/vertex-infosolutions:\n\n" +
      `    PW=$(jq -r '.parameters.dbAdminPassword.value' infra/main.parameters.json | python3 -c "import sys,urllib.parse;print(urllib.parse.quote(sys.stdin.read().strip(),safe=''))")\n` +
      '    export DATABASE_URL="postgresql://vertexadmin:$PW@$PGHOST:5432/vertex?sslmode=require"\n\n' +
      "  If $PGHOST is empty too, the shell has forgotten the resource names —\n" +
      "  re-run part 1 of step 6 in the deployment guide to look them up.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl(),
  },
});
