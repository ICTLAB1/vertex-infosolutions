import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";
import * as notify from "@/lib/notify";
import { retryFailedNotifications } from "@/lib/outbox";

/**
 * Sending again what failed to send.
 *
 * The outbox has always recorded failures. Until this, nothing read them back,
 * so a licence-key email that bounced was a customer who had paid and had
 * nothing. What matters is that the retry is *restrained*: an address that
 * keeps refusing must not be hammered, because a sending domain's reputation
 * is what gets the next customer's one-time code out of their spam folder.
 *
 * The provider is stubbed. These tests are about which rows are picked up and
 * what happens to them, not about Resend's HTTP API.
 *
 * The sweep is deliberately global — it is the whole outbox's retry, not one
 * caller's — so a run here also picks up rows other tests left behind. Every
 * assertion below is therefore about a specific row this file created, never
 * about a total.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("retryFailedNotifications", () => {
  const stamp = Date.now();
  const made: string[] = [];

  beforeAll(() => {
    // Both channels configured, so the sweep is willing to try.
    vi.spyOn(notify, "channelStatus").mockReturnValue({
      email: true,
      whatsapp: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(notify, "channelStatus").mockReturnValue({
      email: true,
      whatsapp: true,
    });
  });

  afterAll(async () => {
    if (!hasDatabase) return;
    vi.restoreAllMocks();
    await prisma.notification.deleteMany({ where: { id: { in: made } } });
    await prisma.$disconnect();
  });

  const minutesAgo = (minutes: number) =>
    new Date(Date.now() - minutes * 60_000);

  async function failedMessage(
    options: {
      attempts?: number;
      lastAttemptAt?: Date;
      status?: "FAILED" | "QUEUED" | "SENT" | "SKIPPED" | "ABANDONED";
      channel?: "EMAIL" | "WHATSAPP";
      error?: string;
    } = {},
  ) {
    const row = await prisma.notification.create({
      data: {
        channel: options.channel ?? "EMAIL",
        status: options.status ?? "FAILED",
        destination: `retry.${stamp}.${Math.random()}@example.test`,
        template: options.channel === "WHATSAPP" ? "vertex_order_paid" : "order.keys",
        subject: "Your licence keys",
        body: "Anita | VX-1 | $99 | https://x",
        attempts: options.attempts ?? 1,
        lastAttemptAt: options.lastAttemptAt ?? minutesAgo(60),
        error: options.error ?? "503 upstream unavailable",
      },
    });
    made.push(row.id);
    return row;
  }

  const reload = (id: string) =>
    prisma.notification.findUniqueOrThrow({ where: { id } });

  /** A provider that accepts everything. */
  const accepting = () => {
    vi.spyOn(notify.deliver, "email").mockResolvedValue({ ok: true, ref: "re_1" });
    vi.spyOn(notify.deliver, "whatsapp").mockResolvedValue({ ok: true, ref: "wa_1" });
  };

  /** A provider that is having a bad day. */
  const failing = (error = "503 upstream unavailable") => {
    vi.spyOn(notify.deliver, "email").mockResolvedValue({ ok: false, error });
    vi.spyOn(notify.deliver, "whatsapp").mockResolvedValue({ ok: false, error });
  };

  it("sends a failed message again, and records that it went", async () => {
    const row = await failedMessage();
    accepting();

    const result = await retryFailedNotifications();
    expect(result.sent).toBeGreaterThanOrEqual(1);

    const after = await reload(row.id);
    expect(after.status).toBe("SENT");
    expect(after.sentAt).not.toBeNull();
    expect(after.providerRef).toBe("re_1");
    expect(after.attempts).toBe(2);
    // The old error is cleared: it is no longer true.
    expect(after.error).toBeNull();
  });

  /**
   * The restraint that matters. Every attempt waits longer than the last, so a
   * message that keeps failing is not a loop hammering somebody's mail server.
   */
  it("waits longer after each attempt before trying again", async () => {
    // One attempt so far, five minutes ago: the first wait is fifteen minutes.
    const tooSoon = await failedMessage({ attempts: 1, lastAttemptAt: minutesAgo(5) });
    // Three attempts, half an hour ago: that one waits an hour.
    const alsoTooSoon = await failedMessage({ attempts: 3, lastAttemptAt: minutesAgo(30) });
    // Three attempts, two hours ago: due.
    const due = await failedMessage({ attempts: 3, lastAttemptAt: minutesAgo(120) });
    accepting();

    await retryFailedNotifications();

    expect((await reload(tooSoon.id)).status).toBe("FAILED");
    expect((await reload(tooSoon.id)).attempts).toBe(1);
    expect((await reload(alsoTooSoon.id)).status).toBe("FAILED");
    expect((await reload(due.id)).status).toBe("SENT");
  });

  /**
   * A 4xx says the request itself is wrong — an address that does not exist, a
   * domain that is not verified. Sending it again changes nothing, and doing
   * so repeatedly is what ruins a sending reputation.
   */
  it("gives up at once on a message the provider refused outright", async () => {
    const row = await failedMessage({ attempts: 1 });
    failing("422 Invalid `to` field");

    await retryFailedNotifications();

    const after = await reload(row.id);
    expect(after.status).toBe("ABANDONED");
    expect(after.attempts).toBe(2);
    expect(after.error).toContain("422");
  });

  /** A timeout or a rate limit is an outage, not a refusal. */
  it("keeps trying after a timeout or a rate limit", async () => {
    const timedOut = await failedMessage({ attempts: 1 });
    failing("429 Too many requests");

    await retryFailedNotifications();

    expect((await reload(timedOut.id)).status).toBe("FAILED");
  });

  it("gives up once the attempts run out", async () => {
    // Five attempts made; the sixth is the last.
    const row = await failedMessage({ attempts: 5, lastAttemptAt: minutesAgo(600) });
    failing();

    await retryFailedNotifications();

    const after = await reload(row.id);
    expect(after.status).toBe("ABANDONED");
    expect(after.attempts).toBe(6);
  });

  it("never touches a message that already went, or one deliberately skipped", async () => {
    const sent = await failedMessage({ status: "SENT", attempts: 1 });
    const skipped = await failedMessage({ status: "SKIPPED", attempts: 0 });
    const abandoned = await failedMessage({ status: "ABANDONED", attempts: 6 });
    accepting();

    await retryFailedNotifications();

    expect((await reload(sent.id)).attempts).toBe(1);
    expect((await reload(skipped.id)).status).toBe("SKIPPED");
    expect((await reload(abandoned.id)).status).toBe("ABANDONED");
  });

  /**
   * A row left QUEUED is one a process was holding when it died. It is picked
   * up, but only after long enough that a send genuinely in flight is never
   * sent twice.
   */
  it("rescues a message whose process died holding it", async () => {
    const stuck = await failedMessage({
      status: "QUEUED",
      attempts: 1,
      lastAttemptAt: minutesAgo(60),
    });
    const inFlight = await failedMessage({
      status: "QUEUED",
      attempts: 1,
      lastAttemptAt: minutesAgo(1),
    });
    accepting();

    await retryFailedNotifications();

    expect((await reload(stuck.id)).status).toBe("SENT");
    expect((await reload(inFlight.id)).status).toBe("QUEUED");
    expect((await reload(inFlight.id)).attempts).toBe(1);
  });

  /**
   * Two schedulers, or a run that overlaps the one before it. A message that
   * goes twice is a duplicate in somebody's inbox.
   */
  it("sends once when two sweeps run at the same instant", async () => {
    const row = await failedMessage({ attempts: 1, lastAttemptAt: minutesAgo(60) });
    const send = vi
      .spyOn(notify.deliver, "email")
      .mockResolvedValue({ ok: true, ref: "re_1" });

    await Promise.all([
      retryFailedNotifications(),
      retryFailedNotifications(),
      retryFailedNotifications(),
    ]);

    const forThisRow = send.mock.calls.filter(
      (call) => call[0] === row.destination,
    );
    expect(forThisRow).toHaveLength(1);
    expect((await reload(row.id)).attempts).toBe(2);
  });

  /**
   * With no API key there is nothing to retry *with*. Spending six attempts
   * discovering that would abandon real messages during a configuration
   * outage.
   */
  it("does nothing at all when no provider is configured", async () => {
    const row = await failedMessage({ attempts: 1 });
    accepting();
    vi.spyOn(notify, "channelStatus").mockReturnValue({
      email: false,
      whatsapp: false,
    });

    const result = await retryFailedNotifications();

    expect(result).toEqual({ due: 0, sent: 0, failed: 0, abandoned: 0, raced: 0 });
    expect((await reload(row.id)).attempts).toBe(1);
  });

  it("retries a WhatsApp message with its variables intact", async () => {
    const row = await failedMessage({ channel: "WHATSAPP" });
    const send = vi
      .spyOn(notify.deliver, "whatsapp")
      .mockResolvedValue({ ok: true, ref: "wa_1" });

    await retryFailedNotifications();

    expect((await reload(row.id)).status).toBe("SENT");
    const call = send.mock.calls.find((c) => c[0] === row.destination);
    expect(call?.[1]).toBe("vertex_order_paid");
    expect(call?.[2]).toEqual(["Anita", "VX-1", "$99", "https://x"]);
  });
});
