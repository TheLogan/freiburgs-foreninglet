import type { UserEvent } from "#shared/types/userEvents";
import {
  ALL_AVAILABLE_EVENTS_URL,
  BASE_URL,
  DEFAULT_CLUB_ID,
  DO_LOGIN_URL,
  EVENTS_URL,
  FRONTPAGE_URL,
  LOGIN_URL,
  LOOKUP_URL,
  PROFILE_URL,
} from "#shared/constants/foreninglet";
import type { SubscribeForm } from "#shared/types/subscribe";
import { subscribeIndexUrl } from "#shared/constants/foreninglet";
import {
  htmlHasSubscribeForm,
  isBifrostLoginPage,
  parseEnrolledEvents as parseEnrolledEvents,
  parseSubscribeForm,
  parseCommentPostResult,
  parseUpcomingEvents,
  parseUserInfo,
} from "./bifrost-parse";
import { UserInfo } from "~~/shared/types/userInfo";
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

function checkLoginSuccess(text: string, url: string) {
  const lower = text.toLowerCase();
  return {
    urlFrontpage: url.includes("frontpage") || url.includes("dashboard"),
    htmlLogUd: text.includes("Log ud") || lower.includes("log ud"),
    htmlMinProfil: text.includes("Min profil") || lower.includes("min profil"),
    htmlVelkommen: text.includes("Velkommen") || lower.includes("velkommen"),
    htmlFrontpageLink: lower.includes("memberportal/frontpage"),
    htmlLogout: lower.includes("log-out") || lower.includes("logout"),
  };
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

  const checks = checkLoginSuccess(text, url);
  bifrostLog("completeLogin:response", {
    status,
    finalUrl: url,
    bodyLength: text.length,
    titleMatch: text.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim(),
    preview: text.replace(/\s+/g, " ").slice(0, 400),
    checks,
    ...jarSnapshot(jar),
  });

  if (Object.values(checks).some(Boolean)) {
    bifrostLog("completeLogin:success", { reason: "response-checks" });
    return true;
  }

  const sessionOk = await verifyBifrostSession(jar);
  bifrostLog("completeLogin:frontpageVerify", {
    sessionOk,
    ...jarSnapshot(jar),
  });

  if (sessionOk) {
    bifrostLog("completeLogin:success", { reason: "frontpage-verify" });
    return true;
  }

  bifrostLog("completeLogin:failed", {
    hint: "No URL/HTML match and frontpage verify failed. See preview above.",
  });
  return false;
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
        "Login could not be confirmed. Check the terminal running `npm run dev` for [bifrost] logs.",
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

  const { status, text, url } = await bifrostFetch(FRONTPAGE_URL, jar, {
    headers: DEFAULT_HEADERS,
  });

  if (status < 200 || status >= 400) {
    bifrostLog("verify:httpError", { status, url });
    return false;
  }

  const checks = checkLoginSuccess(text, url);
  const ok = Object.values(checks).some(Boolean);
  bifrostLog("verify:result", {
    ok,
    checks,
    finalUrl: url,
    bodyLength: text.length,
  });
  return ok;
}

export async function fetchUserEvents(jar: CookieJar): Promise<UserEvent[]> {
  const { status, text } = await bifrostFetch(EVENTS_URL, jar, {
    headers: {
      ...DEFAULT_HEADERS,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: FRONTPAGE_URL,
    },
  });

  if (status === 401 || status === 403) {
    throw createError({ statusCode: 401, statusMessage: "Session expired." });
  }

  if (status < 200 || status >= 400) {
    throw createError({
      statusCode: 502,
      statusMessage: `Bifrost request failed (${status}).`,
    });
  }

  return parseEnrolledEvents(text);
}

export async function fetchUserInfo(jar: CookieJar): Promise<UserInfo> {
  const { status, text } = await bifrostFetch(PROFILE_URL, jar, {
    headers: {
      ...DEFAULT_HEADERS,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: FRONTPAGE_URL,
    },
  });

  if (status === 401 || status === 403) {
    throw createError({ statusCode: 401, statusMessage: "Session expired." });
  }

  if (status < 200 || status >= 400) {
    throw createError({
      statusCode: 502,
      statusMessage: `Bifrost request failed (${status}).`,
    });
  }

  return parseUserInfo(text);
}

export async function fetchUpcomingEvents(
  jar: CookieJar,
): Promise<UpcomingEvent[]> {
  const { status, text } = await bifrostFetch(ALL_AVAILABLE_EVENTS_URL, jar, {
    headers: {
      ...DEFAULT_HEADERS,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: FRONTPAGE_URL,
    },
  });

  if (status === 401 || status === 403) {
    throw createError({ statusCode: 401, statusMessage: "Session expired." });
  }

  if (status < 200 || status >= 400) {
    throw createError({
      statusCode: 502,
      statusMessage: `Bifrost request failed (${status}).`,
    });
  }

  return parseUpcomingEvents(text);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeMatchText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function commentsHtmlIncludesText(
  commentsHtml: string | undefined,
  commentText: string,
): boolean {
  const needle = normalizeMatchText(commentText);
  if (!needle) return true;
  if (!commentsHtml) return false;
  const haystack = normalizeMatchText(commentsHtml.replace(/<[^>]+>/g, " "));
  return haystack.includes(needle);
}

function extractCommentText(
  fields: Record<string, string>,
  form: SubscribeForm,
): string {
  const textarea = form.fields.find((field) => field.type === "textarea");
  if (textarea?.name) {
    const value = fields[textarea.name]?.trim();
    if (value) return value;
  }

  let longest = "";
  for (const value of Object.values(fields)) {
    const trimmed = value.trim();
    if (trimmed.length > longest.length) {
      longest = trimmed;
    }
  }
  return longest;
}

async function refreshSubscribeFormAfterComment(
  jar: CookieJar,
  activityId: string,
  commentText: string,
  postResponseHtml?: string,
): Promise<{ form: SubscribeForm; commentVisible: boolean }> {
  const pageUrl = subscribeIndexUrl(activityId);

  if (postResponseHtml && htmlHasSubscribeForm(postResponseHtml)) {
    try {
      const parsed = parseSubscribeForm(postResponseHtml, pageUrl);
      if (commentsHtmlIncludesText(parsed.commentsHtml, commentText)) {
        return { form: parsed, commentVisible: true };
      }
    } catch {
      // Fall through to refetch polling
    }
  }

  const pollDelaysMs = [400, 500, 600, 700, 800, 1000, 1200, 1500];
  let lastForm: SubscribeForm | undefined;

  for (let attempt = 0; attempt < pollDelaysMs.length; attempt++) {
    if (attempt > 0) {
      await delay(pollDelaysMs[attempt - 1] ?? 800);
    }

    lastForm = await fetchSubscribeForm(jar, activityId, {
      referer: pageUrl,
      attempts: 1,
    });

    if (commentsHtmlIncludesText(lastForm.commentsHtml, commentText)) {
      return { form: lastForm, commentVisible: true };
    }
  }

  if (!lastForm) {
    lastForm = await fetchSubscribeForm(jar, activityId, {
      referer: pageUrl,
      attempts: 2,
    });
  }

  return {
    form: lastForm,
    commentVisible: commentsHtmlIncludesText(lastForm.commentsHtml, commentText),
  };
}

function isRetryableSubscribeError(error: unknown): boolean {
  return (
    error !== null
    && typeof error === "object"
    && "statusCode" in error
    && (error as { statusCode: number }).statusCode === 502
  );
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
      const { status, text } = await bifrostFetch(pageUrl, jar, {
        headers: {
          ...DEFAULT_HEADERS,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: referer,
        },
      });

      if (status === 401 || status === 403 || isBifrostLoginPage(text)) {
        throw createError({
          statusCode: 401,
          statusMessage: "Session expired.",
        });
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

export function isAllowedBifrostUrl(url: string): boolean {
  try {
    const resolved = url.startsWith("http")
      ? new URL(url)
      : new URL(url, BASE_URL);
    const base = new URL(BASE_URL);
    return (
      resolved.origin === base.origin
      && resolved.pathname.startsWith("/memberportal/")
    );
  } catch {
    return false;
  }
}

export async function followBifrostLink(
  jar: CookieJar,
  url: string,
  referer: string,
  activityId: string,
): Promise<SubscribeForm> {
  if (!isAllowedBifrostUrl(url)) {
    throw createError({
      statusCode: 400,
      statusMessage: "That link cannot be opened from the app.",
    });
  }

  const resolved = url.startsWith("http") ? url : new URL(url, BASE_URL).href;
  const subscribePageUrl = subscribeIndexUrl(activityId);

  // Foreninglet delete controls are plain <a href="..."> links — use GET, not POST
  const { status, text, url: finalUrl } = await bifrostFetch(resolved, jar, {
    method: "GET",
    headers: {
      ...DEFAULT_HEADERS,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: referer,
    },
  });

  if (status === 401 || status === 403 || isBifrostLoginPage(text)) {
    throw createError({ statusCode: 401, statusMessage: "Session expired." });
  }

  if (status < 200 || status >= 400) {
    throw createError({
      statusCode: 502,
      statusMessage: `Request failed (${status}).`,
    });
  }

  // Use the action response when it already contains the sign-up form
  if (htmlHasSubscribeForm(text)) {
    try {
      return parseSubscribeForm(text, finalUrl || subscribePageUrl);
    } catch (error) {
      if (!isRetryableSubscribeError(error)) throw error;
    }
  }

  // Foreninglet may need a moment before the sign-up page is ready again after delete
  return fetchSubscribeForm(jar, activityId, {
    referer: subscribePageUrl,
    attempts: 4,
  });
}

export async function postActivityComment(
  jar: CookieJar,
  activityId: string,
  fields: Record<string, string>,
): Promise<{
  success: boolean;
  message: string;
  form?: SubscribeForm;
  commentPending?: boolean;
}> {
  const pageUrl = subscribeIndexUrl(activityId);
  const form = await fetchSubscribeForm(jar, activityId);
  const commentText = extractCommentText(fields, form);

  const body = new URLSearchParams();
  for (const field of form.fields) {
    if (field.name in fields) {
      body.set(field.name, fields[field.name] ?? "");
    } else if (field.type === "checkbox") {
      body.set(field.name, field.value || "");
    } else if (field.value) {
      body.set(field.name, field.value);
    }
  }

  for (const [key, value] of Object.entries(fields)) {
    if (!body.has(key)) {
      body.set(key, value);
    }
  }

  const { status, text } = await bifrostFetch(form.action, jar, {
    method: form.method,
    headers: {
      ...portalHeaders({ Referer: pageUrl }),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    body: body.toString(),
    redirect: "follow",
  });

  if (status === 401 || status === 403) {
    throw createError({ statusCode: 401, statusMessage: "Session expired." });
  }

  if (status < 200 || status >= 500) {
    throw createError({
      statusCode: 502,
      statusMessage: `Comment request failed (${status}).`,
    });
  }

  const result = parseCommentPostResult(text);
  if (!result.success) {
    return result;
  }

  const { form: refreshedForm, commentVisible } =
    await refreshSubscribeFormAfterComment(jar, activityId, commentText, text);

  const message = commentVisible
    ? result.message
    : `${result.message} It may take a moment to appear in the list.`;

  return {
    success: true,
    message,
    form: refreshedForm,
    commentPending: !commentVisible,
  };
}
