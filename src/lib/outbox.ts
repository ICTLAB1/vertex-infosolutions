import "server-only";

import { prisma } from "@/lib/db";
import {
  attachmentsFor,
  channelStatus,
  deliver,
  type NotifyTemplate,
} from "@/lib/notify";

/**
 * Sending again what failed to send.
 *
 * The outbox records every message before it goes, so a provider that was
 * briefly down leaves a row rather than losing a message. Until now nothing
 * read those rows back: a licence-key email that failed was a customer who had
 * paid and had nothing, and the only fix was somebody noticing.
 *
 * Three rules shape this:
 *
 * **Never hammer.** Each attempt waits longer than the last, and after six the
 * message is abandoned rather than retried forever. An address that keeps
 * bouncing is how a sending domain's reputation is destroyed, and reputation
 * is what gets the *next* customer's one-time code out of their spam folder.
 *
 * **A refusal is not an outage.** A provider answering 4xx is saying the
 * request itself is wrong — an address that does not exist, a domain that is
 * not verified. Retrying that changes nothing, so it is abandoned at once and
 * the reason is kept.
 *
 * **Do not burn attempts on a provider that is switched off.** With no API key
 * configured, the sweep does nothing at all rather than spending six attempts
 * discovering that.
 */

/** Waits between attempts: 15 minutes, doubling, capped at four hours. */
function backoffMinutes(attempts: number): number {
  return Math.min(15 * 2 ** Math.max(0, attempts - 1), 240);
}

const MAX_ATTEMPTS = 6;

/**
 * A row left QUEUED for longer than this was being sent by a process that
 * died. Long enough that a send genuinely in flight is never stolen.
 */
const STUCK_AFTER_MINUTES = 15;

export type OutboxSweep = {
  /** Rows eligible this run. */
  due: number;
  sent: number;
  /** Failed again, and will be tried once more later. */
  failed: number;
  /** Given up on: refused by the provider, or out of attempts. */
  abandoned: number;
  /** Claimed by another run between the read and the write. */
  raced: number;
};

/**
 * A 4xx that is not a timeout or a rate limit means the request was wrong, and
 * sending the identical request again will be wrong in the identical way.
 */
function permanentlyRefused(error: string): boolean {
  const status = Number(error.match(/^(\d{3})\b/)?.[1]);
  if (!status) return false;
  if (status === 408 || status === 429) return false;
  return status >= 400 && status < 500;
}

export async function retryFailedNotifications(
  options: { now?: Date; limit?: number } = {},
): Promise<OutboxSweep> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 100;
  const channels = channelStatus();

  const result: OutboxSweep = {
    due: 0,
    sent: 0,
    failed: 0,
    abandoned: 0,
    raced: 0,
  };

  const usable = [
    ...(channels.email ? (["EMAIL"] as const) : []),
    ...(channels.whatsapp ? (["WHATSAPP"] as const) : []),
  ];
  if (usable.length === 0) {
    console.warn("[outbox] no provider is configured; nothing can be retried");
    return result;
  }

  const stuckBefore = new Date(now.getTime() - STUCK_AFTER_MINUTES * 60_000);

  const candidates = await prisma.notification.findMany({
    where: {
      channel: { in: [...usable] },
      attempts: { lt: MAX_ATTEMPTS },
      OR: [
        { status: "FAILED" },
        // Left mid-flight by a process that died holding it.
        { status: "QUEUED", lastAttemptAt: { lt: stuckBefore } },
      ],
    },
    // Oldest attempt first, so nothing starves behind a busy hour.
    orderBy: [{ lastAttemptAt: "asc" }, { createdAt: "asc" }],
    take: limit,
  });

  for (const row of candidates) {
    // The back-off is applied here rather than in the query because it depends
    // on the row's own attempt count.
    const waited =
      !row.lastAttemptAt ||
      row.lastAttemptAt.getTime() +
        backoffMinutes(row.attempts) * 60_000 <=
        now.getTime();
    if (!waited) continue;

    result.due += 1;

    // Compare-and-swap on the exact state that was read. Two sweeps running
    // together cannot both take the same row, and the loser moves on.
    const claimed = await prisma.notification.updateMany({
      where: { id: row.id, status: row.status, attempts: row.attempts },
      data: {
        status: "QUEUED",
        attempts: { increment: 1 },
        lastAttemptAt: now,
      },
    });
    if (claimed.count === 0) {
      result.raced += 1;
      continue;
    }

    const attempt =
      row.channel === "EMAIL"
        ? await deliver.email(
            row.destination,
            row.subject ?? "",
            row.body,
            await attachmentsFor(row.template as NotifyTemplate, row.orderId),
          )
        : await deliver.whatsapp(
            row.destination,
            row.template,
            // The variables were flattened into the body when the row was
            // written. None of them — a name, an order number, a total, a URL
            // — can contain the separator.
            row.body.split(" | "),
          );

    if (attempt.ok) {
      await prisma.notification.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          sentAt: now,
          providerRef: attempt.ref,
          error: null,
        },
      });
      result.sent += 1;
      continue;
    }

    const done =
      permanentlyRefused(attempt.error) || row.attempts + 1 >= MAX_ATTEMPTS;
    await prisma.notification.update({
      where: { id: row.id },
      data: { status: done ? "ABANDONED" : "FAILED", error: attempt.error },
    });
    if (done) {
      result.abandoned += 1;
      console.error(
        `[outbox] giving up on ${row.template} to ${row.destination}: ${attempt.error}`,
      );
    } else {
      result.failed += 1;
    }
  }

  return result;
}
