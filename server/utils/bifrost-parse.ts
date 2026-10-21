import * as cheerio from "cheerio";
import { UpcomingEvent } from "~~/shared/types/event";
import type {
  PaymentCheckout,
  PaymentLineItem,
  SubscribeFieldOption,
  SubscribeFieldType,
  SubscribeForm,
  SubscribeFormField,
} from "#shared/types/subscribe";
import type { Element } from "domhandler";

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

// export function parseUpcomingEvents(html: string): UpcomingEvent[] {
//   if (html.includes('/memberportal/login') && !html.includes('activity-entry')) {
//     throw createError({ statusCode: 401, statusMessage: 'Session expired.' })
//   }

//   const $ = cheerio.load(html);

//   return [];
// }

function entryText(
  $entry: cheerio.Cheerio<Element>,
  selector: string,
): string | undefined {
  const text = $entry.find(selector).first().text().replace(/\s+/g, " ").trim();
  return text || undefined;
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

function resolveUrl(href: string, baseUrl: string): string {
  if (href.startsWith("http")) return href;
  return new URL(href, baseUrl).href;
}

function fieldLabel($: cheerio.CheerioAPI, $el: cheerio.Cheerio<Element>): string {
  const id = $el.attr("id");
  if (id) {
    const forLabel = $(`label[for="${id}"]`)
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();
    if (forLabel) return forLabel.replace(/\s*\*\s*$/, "").trim();
  }

  const parentLabel = $el.parent("label").text().replace(/\s+/g, " ").trim();
  if (parentLabel) return parentLabel.replace(/\s*\*\s*$/, "").trim();

  const prevLabel = $el.prev("label").text().replace(/\s+/g, " ").trim();
  if (prevLabel) return prevLabel.replace(/\s*\*\s*$/, "").trim();

  const pLabel = $el
    .closest("p")
    .find("label")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  if (pLabel) return pLabel.replace(/\s*\*\s*$/, "").trim();

  const groupLabel = $el
    .closest(".form-group, .mb-3, .row")
    .find("label")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  if (groupLabel) return groupLabel.replace(/\s*\*\s*$/, "").trim();

  return $el.attr("name") ?? $el.attr("placeholder") ?? "Field";
}

const INFO_METADATA_SELECTORS = [
  "h1",
  "h2",
  "h3.activity-name",
  ".activity-name",
  ".activity-row",
  ".activity-buttons",
  ".activity-price-div",
  ".activity-price-text",
  ".activity-first-sub-column",
  ".activity-second-sub-column",
  ".settlement-date-div",
  ".seats-text-div",
  ".activity-location-div",
  ".activity-instructor-div",
  "script",
  "style",
  "form",
  "input",
  "select",
  "textarea",
  "button",
  ".hidden",
  ".sr-only",
];

function isMetadataOnlyBlock($: cheerio.CheerioAPI, $el: cheerio.Cheerio<Element>): boolean {
  if ($el.is(".activity-row, .activity-price-div, .settlement-date-div, .seats-text-div")) {
    return true;
  }
  const text = $el.text().replace(/\s+/g, " ").trim();
  if (!text) return true;
  if (
    $el.find(".activity-price-div, .settlement-date-div, .activity-location-div").length
    && !$el.find(".activity-comments, blockquote").length
    && $el.find("p").length === 0
  ) {
    return true;
  }
  return false;
}

function isEventMetadataRow($: cheerio.CheerioAPI, $row: cheerio.Cheerio<Element>): boolean {
  if (!$row.is(".row") || $row.closest(".comment, form").length) return false;
  if (!$row.find(".col-lg-4, .col-lg-6, .col-lg-8").length) return false;
  return (
    $row.find(
      ".glyphicon-calendar, .glyphicon-time, .fa-coins, .fa-map-marker, .fa-users, .icon-money, .icon-users1",
    ).length > 0
    || /mødested|mødetidspunkt|pris|ledige pladser/i.test($row.text())
  );
}

const COMMENT_LINK_TRANSLATIONS: { pattern: RegExp; label: string; deleteLink?: boolean }[] = [
  { pattern: /^slet\s+kommentar$/i, label: "Delete comment", deleteLink: true },
  { pattern: /^vis\s+tidligere\s+kommentarer$/i, label: "Show previous comments" },
];

function localizeCommentLinkLabels(
  $: cheerio.CheerioAPI,
  $root: cheerio.Cheerio<Element>,
): void {
  $root.find("a").each((_, el) => {
    const $link = $(el);
    const text = $link.text().replace(/\s+/g, " ").trim();
    for (const { pattern, label, deleteLink } of COMMENT_LINK_TRANSLATIONS) {
      if (!pattern.test(text)) continue;
      $link.text(label);
      if (deleteLink) {
        $link.addClass("comment-delete-link");
      }
      break;
    }
  });
}

function extractCommentThreads($: cheerio.CheerioAPI): string | undefined {
  const $comments = $(".comment");
  if (!$comments.length) return undefined;

  const parts: string[] = [];

  $("a#show-all-comments-button, a[id*='show-all-comments']").each((_, el) => {
    const $link = $(el);
    const label = $link.text().replace(/\s+/g, " ").trim();
    if (label) {
      const $wrapper = cheerio.load(
        `<p class="show-all-comments"><a href="${$link.attr("href") ?? "#"}">${label}</a></p>`,
        null,
        false,
      );
      const $block = $wrapper("p.show-all-comments");
      localizeCommentLinkLabels($wrapper, $block);
      const html = $wrapper.html();
      if (html) parts.push(html);
    }
  });

  $comments.each((_, el) => {
    const clone = $(el).clone();
    clone.find("script, style, form, button").remove();
    localizeCommentLinkLabels($, clone);
    const $deleteLink = clone.find("a.comment-delete-link").first();
    const deleteHref = $deleteLink.attr("href");
    if (deleteHref) {
      clone.attr("data-delete-href", deleteHref);
    }
    const outer = $.html(clone);
    if (outer) parts.push(outer);
  });

  return parts.join("\n").trim() || undefined;
}

function sanitizeMetadataHtml(html: string): string | undefined {
  const $ = cheerio.load(`<div class="subscribe-metadata-root">${html}</div>`);
  const $root = $(".subscribe-metadata-root");

  $root.find(
    ".comment, .show-all-comments, a#show-all-comments-button, script, style, form, button",
  ).remove();

  const text = $root.text().replace(/\s+/g, " ").trim();
  if (!text || text.length < 2) return undefined;

  return $root.html()?.trim() || undefined;
}

function sanitizeInfoHtml(html: string): string | undefined {
  const $ = cheerio.load(`<div class="subscribe-info-root">${html}</div>`);
  const $root = $(".subscribe-info-root");

  $root.find(
    ".comment, .show-all-comments, a#show-all-comments-button, script, style, form, button",
  ).remove();

  for (const selector of INFO_METADATA_SELECTORS) {
    $root.find(selector).remove();
  }

  $root.find("h3.activity-name, .activity-name").remove();

  $root.find(".row").each((_, el) => {
    if (isEventMetadataRow($, $(el))) {
      $(el).remove();
    }
  });

  $root.find(".col-lg-4, .col-lg-6, .col-lg-8").each((_, el) => {
    if (!$(el).closest(".comment").length) {
      $(el).remove();
    }
  });

  $root.find(".row, .col-lg-12").each((_, el) => {
    if (isMetadataOnlyBlock($, $(el))) {
      $(el).remove();
    }
  });

  const text = $root.text().replace(/\s+/g, " ").trim();
  if (!text || text.length < 2) return undefined;

  return $root.html()?.trim() || undefined;
}

function extractMetadataHtml(
  $: cheerio.CheerioAPI,
  $form: cheerio.Cheerio<Element>,
): string | undefined {
  const parts: string[] = [];
  const $scope = $form.closest(".panel-body");
  const $search = $scope.length ? $scope : $("body");

  $search.find(".activity-row").each((_, el) => {
    const $row = $(el);
    if ($row.closest(".comment, form").length) return;
    const clone = $row.clone();
    clone.find("script, style, form, .comment").remove();
    const html = $.html(clone)?.trim();
    if (html) parts.push(html);
  });

  $search.find(".row").each((_, el) => {
    const $row = $(el);
    if (!isEventMetadataRow($, $row)) return;
    const clone = $row.clone();
    clone.find("script, style, form, .comment").remove();
    const html = $.html(clone)?.trim();
    if (html) parts.push(html);
  });

  for (const selector of [".activity-first-sub-column", ".activity-second-sub-column"]) {
    $search.find(selector).each((_, el) => {
      const $col = $(el);
      if ($col.closest(".comment, form, .row").length) return;
      const clone = $col.clone();
      clone.find("script, style, form, .comment").remove();
      const html = $.html(clone)?.trim();
      if (html) parts.push(html);
    });
  }

  if (!parts.length) return undefined;
  return sanitizeMetadataHtml(parts.join("\n"));
}

function extractProseHtml(
  $: cheerio.CheerioAPI,
  $form: cheerio.Cheerio<Element>,
): string | undefined {
  const commentSelectors = [
    ".activity-comments",
    "#activity-comments",
    ".subscription-comments",
    ".member-comments",
  ];

  for (const selector of commentSelectors) {
    const $block = $(selector).first();
    if (!$block.length) continue;

    const clone = $block.clone();
    clone.find("form, .activity-buttons, script, style").remove();
    clone.find("h3.activity-name, .activity-name").remove();
    clone.find(".row").each((_, row) => {
      const $row = $(row);
      if ($row.closest(".comment").length) return;
      if ($row.find(".col-lg-4, .glyphicon-calendar, .icon-money, .fa-coins").length) {
        $row.remove();
      }
    });
    const sanitized = sanitizeInfoHtml(clone.html() ?? "");
    if (sanitized) return sanitized;
  }

  const proseSelectors = [
    ".subscription-description",
    ".subscription-intro",
    ".activity-info",
  ];

  for (const selector of proseSelectors) {
    const $block = $(selector).first();
    if (!$block.length) continue;

    const clone = $block.clone();
    clone.find(INFO_METADATA_SELECTORS.join(", ")).remove();
    const sanitized = sanitizeInfoHtml(clone.html() ?? "");
    if (sanitized) return sanitized;
  }

  const $panelBody = $form.closest(".panel-body");
  if ($panelBody.length) {
    const fragments: string[] = [];

    $panelBody.children().each((_, child) => {
      const $child = $(child);
      if ($child.is("form")) return false;
      if ($child.is("h3.activity-name, .activity-name, .comment, a#show-all-comments-button")) {
        return;
      }
      if ($child.is(".row") && isEventMetadataRow($, $child)) return;
      if (isMetadataOnlyBlock($, $child)) return;

      if ($child.is("p, .alert, .well, blockquote, .activity-comments")) {
        const html = $child.html()?.trim();
        if (html) fragments.push(html);
      }
    });

    if (fragments.length) {
      const sanitized = sanitizeInfoHtml(fragments.join(""));
      if (sanitized) return sanitized;
    }
  }

  return undefined;
}

function inputType($el: cheerio.Cheerio<Element>): SubscribeFieldType {
  const tag = $el.prop("tagName")?.toLowerCase();
  if (tag === "textarea") return "textarea";
  if (tag === "select") return "select";
  const type = ($el.attr("type") ?? "text").toLowerCase();
  if (type === "hidden") return "hidden";
  if (type === "checkbox") return "checkbox";
  if (type === "radio") return "radio";
  if (type === "email") return "email";
  if (type === "tel") return "tel";
  if (type === "number") return "number";
  if (type === "password") return "password";
  return "text";
}

function selectOptions(
  $: cheerio.CheerioAPI,
  $select: cheerio.Cheerio<Element>,
): SubscribeFieldOption[] {
  return $select
    .find("option")
    .map((_, opt) => ({
      value: $(opt).attr("value") ?? $(opt).text().trim(),
      label: $(opt).text().replace(/\s+/g, " ").trim(),
    }))
    .get()
    .filter((opt) => opt.label.length > 0 || opt.value.length > 0);
}

export function htmlHasSubscribeForm(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes("subscription-form")
    || lower.includes("subscribe-form")
    || lower.includes("subscribe/index/")
    || /id=["'][^"']*subscription/i.test(html)
  );
}

export function parseSubscribeForm(html: string, pageUrl: string): SubscribeForm {
  if (isBifrostLoginPage(html)) {
    throw sessionExpiredError();
  }

  const $ = cheerio.load(html);
  let $form = $(
    '#subscription-form, #subscribe-form, #member-subscription-form, form[action*="subscribe"]',
  ).first();

  if (!$form.length) {
    $form = $("form")
      .filter((_, el) => {
        const $f = $(el);
        const action = $f.attr("action") ?? "";
        return (
          $f.find('button[type="submit"], input[type="submit"]').length > 0
          && !action.includes("logout")
          && !action.includes("login")
        );
      })
      .first();
  }

  if (!$form.length) {
    throw createError({
      statusCode: 502,
      statusMessage: "Subscribe form not found on Foreninglet page.",
    });
  }

  const actionAttr = $form.attr("action") ?? pageUrl;
  const method = ($form.attr("method") ?? "POST").toUpperCase() === "GET" ? "GET" : "POST";
  const fields: SubscribeFormField[] = [];
  const seen = new Set<string>();

  function addField($el: cheerio.Cheerio<Element>) {
    const name = $el.attr("name");
    if (!name || seen.has(name)) return;

    const type = inputType($el);
    if (type === "radio") {
      const checked = $form!.find(`input[type="radio"][name="${name}"]:checked`).first();
      const value = checked.attr("value") ?? "";
      const options = $form!
        .find(`input[type="radio"][name="${name}"]`)
        .map((_, radio) => {
          const $radio = $(radio);
          const optionLabel =
            fieldLabel($, $radio)
            || $radio.closest("label").text().replace(/\s+/g, " ").trim()
            || $radio.attr("value")
            || name;
          return {
            value: $radio.attr("value") ?? "",
            label: optionLabel,
          };
        })
        .get();
      fields.push({
        name,
        label: fieldLabel($, $el),
        type: "radio",
        value,
        required: $el.attr("required") !== undefined,
        disabled: false,
        options,
      });
      seen.add(name);
      return;
    }

    let value = $el.attr("value") ?? "";
    if (type === "checkbox") {
      value = $el.is(":checked") ? (value || "true") : "";
    }
    if (type === "select") {
      const selected = $el.find("option:selected").first();
      value = selected.attr("value") ?? selected.text().trim();
    }
    if (type === "textarea") {
      value = $el.text().trim() || $el.attr("value")?.trim() || "";
    }

    fields.push({
      name,
      label: fieldLabel($, $el),
      type,
      value,
      required: $el.attr("required") !== undefined,
      disabled: $el.is(":disabled") || $el.attr("readonly") !== undefined,
      options: type === "select" ? selectOptions($, $el) : undefined,
    });
    seen.add(name);
  }

  $form.find("input, select, textarea").each((_, el) => {
    const $el = $(el);
    const type = ($el.attr("type") ?? "").toLowerCase();
    if (type === "submit" || type === "button" || type === "image") return;
    addField($el);
  });

  const pageTitle =
    $("h1").first().text().replace(/\s+/g, " ").trim()
    || $(".page-header").first().text().replace(/\s+/g, " ").trim()
    || $form.closest(".panel").find(".panel-heading").first().text().replace(/\s+/g, " ").trim()
    || undefined;

  return {
    action: resolveUrl(actionAttr, pageUrl),
    method,
    fields,
    pageTitle,
    metadataHtml: extractMetadataHtml($, $form),
    infoHtml: extractProseHtml($, $form),
    commentsHtml: extractCommentThreads($),
  };
}

const IDENTIFY_PATH_RE = /\/subscribe\/identify\/(\d+)\/(\d+)/g;

export function parseIdentifySlotFromHtml(
  html: string,
  activityId: string,
): string | undefined {
  const pattern = new RegExp(
    `/subscribe/identify/${activityId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(\\d+)`,
  );
  return html.match(pattern)?.[1];
}

export function listIdentifySlotsFromHtml(html: string): string[] {
  const slots = new Set<string>();
  for (const match of html.matchAll(IDENTIFY_PATH_RE)) {
    if (match[2] !== undefined) slots.add(match[2]);
  }
  return [...slots].sort((a, b) => Number(a) - Number(b));
}

export function htmlHasPaymentCheckout(html: string): boolean {
  const lower = html.toLowerCase();
  return lower.includes("flte_payment_form") || lower.includes("payment.quickpay.net");
}

export function parsePaymentCheckout(html: string, pageUrl: string): PaymentCheckout {
  if (isBifrostLoginPage(html)) {
    throw sessionExpiredError();
  }

  const $ = cheerio.load(html);
  const $paymentForm = $("#flte_payment_form");

  if (!$paymentForm.length) {
    throw createError({
      statusCode: 502,
      statusMessage: "Payment checkout not found on Foreninglet page.",
    });
  }

  const $panel = $paymentForm.closest(".panel, .card").first();
  const $body = $panel.find(".panel-body, .card-body").first();

  const pageTitle =
    $panel.find(".panel-title, .card-header").first().text().replace(/\s+/g, " ").trim()
    || undefined;

  const memberName =
    $body.find("h4").first().text().replace(/\s+/g, " ").trim() || undefined;

  const invoiceHeading = $body
    .find("h6")
    .filter((_, el) => /fakturanr/i.test($(el).text()))
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  const invoiceNumber = invoiceHeading
    ? invoiceHeading.replace(/^.*fakturanr\.?\s*:?\s*/i, "").trim()
    : undefined;

  const lineItems: PaymentLineItem[] = [];
  let total: string | undefined;

  $body.find("table tbody tr").each((_, row) => {
    const cells = $(row)
      .find("td")
      .map((__, cell) => $(cell).text().replace(/\s+/g, " ").trim())
      .get();
    if (cells.length < 2) return;

    const text = cells[0] ?? "";
    const amount = cells[cells.length - 1] ?? "";
    if (/^total$/i.test(text.replace(/<[^>]+>/g, "").trim()) || /<b>\s*total\s*<\/b>/i.test($(row).html() ?? "")) {
      total = amount;
      return;
    }
    if (text && amount) {
      lineItems.push({ text, amount });
    }
  });

  const paymentAction = $paymentForm.attr("action")?.trim();
  if (!paymentAction) {
    throw createError({
      statusCode: 502,
      statusMessage: "QuickPay payment URL not found.",
    });
  }

  const acceptTermsLabel = $paymentForm
    .find('input[type="checkbox"]')
    .first()
    .parent()
    .text()
    .replace(/\s+/g, " ")
    .trim() || undefined;

  const conditionsErrorMessage =
    $("#conditions-span")
      .find("p")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim()
    || undefined;

  let noticeHtml: string | undefined;
  const $table = $body.find("table").first();
  if ($table.length) {
    const noticeParts: string[] = [];
    let capture = false;
    for (const node of $body[0]?.children ?? []) {
      const $node = $(node);
      if ($node.is("table") && $node.is($table)) {
        capture = true;
        continue;
      }
      if (!capture) continue;
      if ($node.is("#flte_payment_form") || $node.find("#flte_payment_form").length) break;
      if ($node.is("h4") && /handelsbetingelser/i.test($node.text())) break;
      const htmlChunk = $.html($node).trim();
      if (htmlChunk) noticeParts.push(htmlChunk);
    }
    if (noticeParts.length) {
      noticeHtml = noticeParts.join("");
    }
  }

  let termsHtml: string | undefined;
  const $termsHeading = $body
    .find("h4")
    .filter((_, el) => /handelsbetingelser/i.test($(el).text()))
    .first();
  if ($termsHeading.length) {
    const termsParts: string[] = [];
    let $cursor = $termsHeading.next();
    while ($cursor.length && !$cursor.is("form")) {
      termsParts.push($.html($cursor));
      $cursor = $cursor.next();
    }
    termsHtml = termsParts.join("").trim() || undefined;
  }

  return {
    pageTitle,
    memberName,
    invoiceNumber,
    lineItems,
    total,
    noticeHtml,
    termsHtml,
    paymentUrl: resolveUrl(paymentAction, pageUrl),
    acceptTermsLabel,
    conditionsErrorMessage,
  };
}
