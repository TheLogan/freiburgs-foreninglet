import * as cheerio from "cheerio";
import type { UpcomingEvent } from "#shared/types/event";

const SESSION_EXPIRED_CODE = "session_expired";

/** Thrown when Foreninglet answers with its login page instead of the requested page. */
export function sessionExpiredError() {
  return createError({
    statusCode: 401,
    statusMessage: "Session expired.",
    data: { code: SESSION_EXPIRED_CODE },
  });
}

export function isSessionExpiredError(error: unknown): boolean {
  return (
    error !== null
    && typeof error === "object"
    && (error as { data?: { code?: string } }).data?.code === SESSION_EXPIRED_CODE
  );
}

/**
 * True when Foreninglet returned the portal login page, not an authenticated page.
 * Logged-out requests are redirected there with HTTP 200, so the status code alone
 * cannot be trusted.
 */
export function isBifrostLoginPage(html: string, finalUrl?: string): boolean {
  if (finalUrl) {
    try {
      if (new URL(finalUrl).pathname.replace(/\/+$/, "") === "/memberportal/login") {
        return true;
      }
    } catch {
      // Ignore malformed URLs and fall back to the HTML check.
    }
  }
  return html.includes('id="member-portal-login-form"');
}

function parseActivityId(href: string | undefined): string | undefined {
  return href?.match(/\/subscribe\/index\/(\d+)/)?.[1];
}
export function parseUpcomingEvents(html: string): UpcomingEvent[] {
  if (isBifrostLoginPage(html)) {
    throw sessionExpiredError();
  }
  const $ = cheerio.load(html);

  // The activity/search page returns a table of simple anchor links, one per row.
  const links = $('a[href*="/memberportal/subscribe/index/"]');
  if (!links.length) {
    // No matches is a valid result as long as we got the search page itself.
    if ($('input[name="start_date"]').length) return [];
    throw createError({
      statusCode: 502,
      statusMessage: "Activity list not found on Foreninglet page.",
    });
  }
  const events = links
    .map((_, el) => {
      const $a = $(el);
      const href = $a.attr("href") ?? "";
      const id = parseActivityId(href);
      if (!id || !href) return null;

      // Text format: "Activity Name - DD. MMM YYYY, kl. HH:MM"
      const fullText = $a.text().replace(/\s+/g, " ").trim();
      const dashIdx = fullText.lastIndexOf(" - ");
      const name = dashIdx >= 0 ? fullText.slice(0, dashIdx).trim() : fullText;
      const startDate = dashIdx >= 0 ? fullText.slice(dashIdx + 3).trim() : undefined;

      return {
        id,
        name,
        status: "unknown" as const,
        startDate,
        subscribeUrl: href.startsWith("http") ? href : `https://bifrost.foreninglet.dk${href}`,
      };
    })
    .get()
    .filter((e) => e !== null);

  // Foreninglet sorts alphabetically; show the soonest event first.
  return events.sort(
    (a, b) => danishDateSortKey(a.startDate) - danishDateSortKey(b.startDate),
  );
}

export type EventDetails = Pick<
  UpcomingEvent,
  "status" | "price" | "startDate" | "dateRange" | "location" | "seats" | "signupDeadline"
>;

/** Reads price, dates, location and free places from an event's subscribe/index page. */
export function parseEventDetails(html: string): Partial<EventDetails> {
  const $ = cheerio.load(html);
  const $meta = $(".glyphicon-calendar").first().closest(".row");
  const lines = $meta
    .find(".col-lg-4 > div")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);
  const valueAfter = (label: string) =>
    lines
      .find((line) => line.toLowerCase().startsWith(label.toLowerCase()))
      ?.slice(label.length)
      .trim() || undefined;

  const details: Partial<EventDetails> = {};

  // Multi-day events have "Startdato:/Slutdato:" lines; single-day ones only "dd/mm-yyyy" + time,
  // in which case the search list's start date is already the more readable version.
  const start = valueAfter("Startdato:");
  const end = valueAfter("Slutdato:");
  if (start) details.startDate = start;
  if (start && end) details.dateRange = `${start} - ${end}`;

  details.price = valueAfter("Pris:");

  $(".activity-extra-info").each((_, el) => {
    const $info = $(el);
    if ($info.find(".card-title").text().trim().toLowerCase() === "tilmeldingsfrist") {
      details.signupDeadline =
        $info.find(".card-text").text().replace(/\s+/g, " ").trim() || undefined;
    }
  });

  details.location =
    valueAfter("Mødested:")
    || $meta.find(".icon-map-marker1").first().parent().text().replace(/\s+/g, " ").trim()
    || undefined;

  const seatsLine = lines.find((line) => /ledige pladser/i.test(line));
  const freeSeats = seatsLine?.match(/(-?\d+)\s+ledige pladser/i)?.[1];
  const canBuy = $('a[href*="/memberportal/subscribe/identify/"]').length > 0;
  details.seats = seatsLine;
  details.status =
    freeSeats !== undefined && Number(freeSeats) <= 0
      ? "sold_out"
      : canBuy
        ? "available"
        : "unknown";

  return details;
}

const DANISH_MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, maj: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, okt: 9, nov: 10, dec: 11,
};

/** Sort key for dates like "7. nov. 2026, kl. 17:00"; unparseable dates sort last. */
function danishDateSortKey(text: string | undefined): number {
  const match = text?.match(/(\d{1,2})\.\s*([a-zæøå]+)\.?\s+(\d{4})(?:,\s*kl\.\s*(\d{1,2}):(\d{2}))?/i);
  const month = match ? DANISH_MONTHS[match[2]!.slice(0, 3).toLowerCase()] : undefined;
  if (!match || month === undefined) return Number.MAX_SAFE_INTEGER;
  return Date.UTC(Number(match[3]), month, Number(match[1]), Number(match[4] ?? 0), Number(match[5] ?? 0));
}
