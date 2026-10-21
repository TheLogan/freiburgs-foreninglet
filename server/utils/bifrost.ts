import {
  ALL_AVAILABLE_EVENTS_URL,
  BASE_URL,
  DEFAULT_CLUB_ID,
  DO_LOGIN_URL,
  FRONTPAGE_URL,
  LOGIN_URL,
  LOOKUP_URL,
} from "#shared/constants/foreninglet";
import type { PaymentCheckout, SubscribeForm } from "#shared/types/subscribe";
import { subscribeIdentifyUrl, subscribeIndexUrl } from "#shared/constants/foreninglet";
import {
  htmlHasPaymentCheckout,
  htmlHasSubscribeForm,
  isBifrostLoginPage,
  sessionExpiredError,
  parseIdentifySlotFromHtml,
  parsePaymentCheckout,
  parseSubscribeForm,
  parseUpcomingEvents,
  parseEventDetails,
} from "./bifrost-parse";
import { UpcomingEvent } from "~~/shared/types/event";

export interface LookupMember {
  member_id: string;
  member_full_name?: string;
  username: string;
  key_1: string;
  key_2: string;
  club_id: string;
  club_name?: string;
  post_url?: string;
}

export type CookieJar = Map<string, string>;

/** Server-side debug logs — appear in the `nuxt dev` terminal, not the browser console. */
function bifrostLog(step: string, data?: Record<string, unknown>) {
  if (!import.meta.dev) return;
  const payload = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[bifrost] ${step}${payload}`);
}

function jarSnapshot(jar: CookieJar) {
  return {
    cookieCount: jar.size,
    cookieNames: [...jar.keys()],
  };
}

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
};

function portalHeaders(extra?: Record<string, string>) {
  return {
    ...DEFAULT_HEADERS,
    Referer: LOGIN_URL,
    Origin: BASE_URL,
    ...extra,
  };
}

export function createCookieJar(): CookieJar {
  return new Map();
}

export function serializeJar(jar: CookieJar): string {
  return JSON.stringify(Object.fromEntries(jar));
}

export function deserializeJar(serialized: string): CookieJar {
  try {
    const obj = JSON.parse(serialized) as Record<string, string>;
    return new Map(Object.entries(obj));
  } catch {
    return createCookieJar();
  }
}

function cookieHeader(jar: CookieJar): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function absorbCookies(jar: CookieJar, headers: Headers) {
  const setCookies =
    typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];

  if (setCookies.length > 0) {
    for (const header of setCookies) {
      const [pair] = header.split(";");
      if (!pair) continue;
      const eq = pair.indexOf("=");
      if (eq > 0) {
        jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    }
    return;
  }

  const raw = headers.get("set-cookie");
  if (!raw) return;

  for (const header of raw.split(/,(?=\s*[^;,]+=)/)) {
    const [pair] = header.split(";");
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq > 0) {
      jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
}

async function bifrostFetch(
  url: string,
  jar: CookieJar,
  init: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    redirect?: RequestRedirect;
  } = {},
): Promise<{ status: number; text: string; url: string }> {
  const headers = new Headers(init.headers);
  const cookies = cookieHeader(jar);
  if (cookies) headers.set("Cookie", cookies);

  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers,
    body: init.body,
    redirect: init.redirect ?? "follow",
  });

  absorbCookies(jar, res.headers);
  const text = await res.text();

  bifrostLog("fetch", {
    method: init.method ?? "GET",
    url,
    status: res.status,
    finalUrl: res.url,
    bodyLength: text.length,
    ...jarSnapshot(jar),
  });

  return { status: res.status, text, url: res.url };
}

export function parseClubId(html: string): string {
  const match =
    html.match(/name=["']club_id["'][^>]*value=["']([^"']*)["']/i) ??
    html.match(/value=["']([^"']*)["'][^>]*name=["']club_id["']/i);
  return match?.[1] ?? DEFAULT_CLUB_ID;
}

async function lookupMembers(
  email: string,
  password: string,
  clubId: string,
  jar: CookieJar,
): Promise<LookupMember[]> {
  const body = new URLSearchParams({
    username: email,
    password,
    change_account_enabled: "0",
    remember_me: "0",
    club_id: clubId,
  }).toString();

  const { status, text } = await bifrostFetch(LOOKUP_URL, jar, {
    method: "POST",
    headers: {
      ...portalHeaders({ "X-Requested-With": "XMLHttpRequest" }),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (status < 200 || status >= 300) {
    throw new Error(`Lookup failed (${status}).`);
  }

  const trimmed = text.trim();
  bifrostLog("lookup:response", {
    status,
    bodyLength: trimmed.length,
    preview: trimmed.slice(0, 200),
  });

  if (trimmed === "[]") return [];

  const members = JSON.parse(trimmed) as LookupMember[];
  bifrostLog("lookup:members", {
    count: members.length,
    first: members[0]
      ? {
          member_id: members[0].member_id,
          member_full_name: members[0].member_full_name,
          post_url: members[0].post_url,
        }
      : null,
  });
  return members;
}

async function completeLogin(
  member: LookupMember,
  jar: CookieJar,
): Promise<boolean> {
  let postUrl = member.post_url ?? DO_LOGIN_URL;
  if (!postUrl.startsWith("http")) {
    postUrl = new URL(postUrl, LOGIN_URL).href;
  }

  bifrostLog("completeLogin:start", {
    postUrl,
    member_id: member.member_id,
    club_id: member.club_id,
    ...jarSnapshot(jar),
  });

  const body = new URLSearchParams({
    username: member.username,
    key_1: member.key_1,
    key_2: member.key_2,
    club_id: member.club_id,
    member_id: member.member_id,
  }).toString();

  const { status, text, url } = await bifrostFetch(postUrl, jar, {
    method: "POST",
    headers: {
      ...portalHeaders(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    redirect: "follow",
  });

  if (status < 200 || status >= 400) {
    bifrostLog("completeLogin:httpError", { status, url });
    throw new Error(`Login failed (${status}).`);
  }

  if (isBifrostLoginPage(text, url)) {
    bifrostLog("completeLogin:failed", { reason: "login-page-returned", finalUrl: url });
    return false;
  }

  // The dologin response itself is not conclusive, so confirm on a members-only page.
  const sessionOk = await verifyBifrostSession(jar);
  bifrostLog(sessionOk ? "completeLogin:success" : "completeLogin:failed", {
    finalUrl: url,
    ...jarSnapshot(jar),
  });
  return sessionOk;
}

export async function bifrostLogin(
  email: string,
  password: string,
): Promise<{ member: LookupMember; jar: CookieJar }> {
  bifrostLog("login:start", {
    email: email.replace(/(.{2}).+(@.*)/, "$1***$2"),
  });
  const jar = createCookieJar();

  const page = await bifrostFetch(LOGIN_URL, jar, {
    headers: DEFAULT_HEADERS,
  });

  if (page.status < 200 || page.status >= 400) {
    bifrostLog("login:loginPageFailed", { status: page.status });
    throw new Error(`Could not load login page (${page.status}).`);
  }

  const clubId = parseClubId(page.text);
  bifrostLog("login:clubId", { clubId, ...jarSnapshot(jar) });

  const members = await lookupMembers(email, password, clubId, jar);

  if (members.length < 1 || members[0] == undefined) {
    bifrostLog("login:noMembers");
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid email or password.",
    });
  }

  const member = members[0];
  const ok = await completeLogin(member, jar);

  if (!ok) {
    throw createError({
      statusCode: 401,
      statusMessage:
        "Foreninglet did not accept the login.",
    });
  }

  bifrostLog("login:success", {
    member_id: member.member_id,
    ...jarSnapshot(jar),
  });
  return { member, jar };
}

export async function verifyBifrostSession(jar: CookieJar): Promise<boolean> {
  if (jar.size === 0) {
    bifrostLog("verify:noCookies");
    return false;
  }

  // The front page is public, but the activity search redirects to the login page
  // when the session is not authenticated.
  const { status, text, url } = await bifrostFetch(ALL_AVAILABLE_EVENTS_URL, jar, {
    headers: DEFAULT_HEADERS,
  });

  if (status < 200 || status >= 400) {
    bifrostLog("verify:httpError", { status, url });
    return false;
  }

  const ok = !isBifrostLoginPage(text, url);
  bifrostLog("verify:result", { ok, finalUrl: url, bodyLength: text.length });
  return ok;
}

/** Today's date as dd-mm-yyyy (the activity search form's format), in Danish time. */
function todayInCopenhagen(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Copenhagen",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")}`;
}

export async function fetchUpcomingEvents(
  jar: CookieJar,
): Promise<UpcomingEvent[]> {
  // A plain GET lists past events too; the search form's start_date filters server-side.
  const body = new URLSearchParams({
    name: "",
    start_date: todayInCopenhagen(),
    end_date: "",
  }).toString();

  const { status, text, url } = await bifrostFetch(ALL_AVAILABLE_EVENTS_URL, jar, {
    method: "POST",
    headers: {
      ...portalHeaders({ Referer: ALL_AVAILABLE_EVENTS_URL }),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    body,
  });

  if (status === 401 || status === 403 || isBifrostLoginPage(text, url)) {
    throw sessionExpiredError();
  }

  if (status < 200 || status >= 400) {
    throw createError({
      statusCode: 502,
      statusMessage: `Bifrost request failed (${status}).`,
    });
  }

  const events = parseUpcomingEvents(text);

  // The search list only has name and start date; each event's own page has price, location and places.
  return Promise.all(
    events.map(async (event) => {
      try {
        const page = await bifrostFetch(subscribeIndexUrl(event.id), jar, {
          headers: {
            ...DEFAULT_HEADERS,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            Referer: ALL_AVAILABLE_EVENTS_URL,
          },
        });
        if (page.status < 200 || page.status >= 400) return event;
        return { ...event, ...withoutUndefined(parseEventDetails(page.text)) };
      } catch (error) {
        bifrostLog("upcoming:detailsFailed", { id: event.id, error: String(error) });
        return event;
      }
    }),
  );
}

function withoutUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableSubscribeError(error: unknown): boolean {
  return (
    error !== null
    && typeof error === "object"
    && "statusCode" in error
    && (error as { statusCode: number }).statusCode === 502
  );
}

export async function fetchPaymentCheckout(
  jar: CookieJar,
  activityId: string,
  options?: { slot?: string; referer?: string },
): Promise<PaymentCheckout> {
  let slot = options?.slot?.trim() || "0";

  if (!options?.slot) {
    try {
      const indexUrl = subscribeIndexUrl(activityId);
      const { text: indexHtml } = await bifrostFetch(indexUrl, jar, {
        headers: {
          ...DEFAULT_HEADERS,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: options?.referer ?? ALL_AVAILABLE_EVENTS_URL,
        },
      });
      const parsedSlot = parseIdentifySlotFromHtml(indexHtml, activityId);
      if (parsedSlot) slot = parsedSlot;
    } catch {
      // Fall back to default slot when index page cannot be loaded.
    }
  }

  const pageUrl = subscribeIdentifyUrl(activityId, slot);
  const referer = options?.referer ?? subscribeIndexUrl(activityId);

  const { status, text, url } = await bifrostFetch(pageUrl, jar, {
    headers: {
      ...DEFAULT_HEADERS,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: referer,
    },
  });

  if (status === 401 || status === 403 || isBifrostLoginPage(text, url)) {
    throw sessionExpiredError();
  }

  if (status < 200 || status >= 400) {
    throw createError({
      statusCode: 502,
      statusMessage: `Could not load payment page (${status}).`,
    });
  }

  if (!htmlHasPaymentCheckout(text)) {
    if (htmlHasSubscribeForm(text)) {
      throw createError({
        statusCode: 422,
        statusMessage:
          "Complete the sign-up form on Foreninglet before payment.",
        data: { code: "needs_signup_form" },
      });
    }
    throw createError({
      statusCode: 502,
      statusMessage: "Payment checkout not found on Foreninglet page.",
    });
  }

  return parsePaymentCheckout(text, pageUrl);
}

export async function fetchSubscribeForm(
  jar: CookieJar,
  activityId: string,
  options?: { referer?: string; attempts?: number },
): Promise<SubscribeForm> {
  const pageUrl = subscribeIndexUrl(activityId);
  const referer = options?.referer ?? ALL_AVAILABLE_EVENTS_URL;
  const attempts = options?.attempts ?? 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      await delay(300 * attempt);
    }

    try {
      const { status, text, url } = await bifrostFetch(pageUrl, jar, {
        headers: {
          ...DEFAULT_HEADERS,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: referer,
        },
      });

      if (status === 401 || status === 403 || isBifrostLoginPage(text, url)) {
        throw sessionExpiredError();
      }

      if (status < 200 || status >= 400) {
        throw createError({
          statusCode: 502,
          statusMessage: `Could not load sign-up page (${status}).`,
        });
      }

      return parseSubscribeForm(text, pageUrl);
    } catch (error) {
      lastError = error;
      if (!isRetryableSubscribeError(error) || attempt === attempts - 1) {
        throw error;
      }
    }
  }

  throw lastError;
}
