/**
 * Where the database URL comes from, and what to say when it is missing.
 *
 * Pulled out of `prisma7.config.ts` so it can be tested. The rule it encodes
 * broke a production image build once: `prisma generate` runs during `npm ci`
 * inside the Docker build, where there is deliberately no DATABASE_URL — the
 * image must not carry a connection string — and a config that demands one
 * there fails the build.
 */

/**
 * Commands that never open a connection, so they must not require a URL.
 * `generate` is the one that matters; the rest are here for the same reason.
 */
export const OFFLINE_COMMANDS = [
  "generate",
  "format",
  "validate",
  "version",
  "debug",
];

/** Never connected to. Present only because the config field is required. */
export const OFFLINE_PLACEHOLDER = "postgresql://offline/none";

export const MISSING_URL_MESSAGE =
  "DATABASE_URL is not set.\n\n" +
  "  Locally:    copy .env.example to .env\n" +
  "  Cloud Shell after a restart, from ~/vertex-infosolutions:\n\n" +
  "    source ~/vertex.env\n\n" +
  "  If you have not made that file yet, or it is out of date, look the\n" +
  "  names up again with part 1 of step 6 in the deployment guide.";

/**
 * Throws with the name of the missing variable rather than letting Prisma
 * report "The datasource.url property is required", which sends you to read a
 * config file where nothing is wrong.
 */
export function datasourceUrl(
  env: string | undefined,
  argv: readonly string[],
): string {
  if (env) return env;
  if (argv.some((arg) => OFFLINE_COMMANDS.includes(arg))) {
    return OFFLINE_PLACEHOLDER;
  }
  throw new Error(MISSING_URL_MESSAGE);
}
