import type { UserEvent } from '#shared/types/activity'
import {
  BASE_URL,
  DEFAULT_CLUB_ID,
  DO_LOGIN_URL,
  EVENTS_URL,
  FRONTPAGE_URL,
  LOGIN_URL,
  LOOKUP_URL,
  PROFILE_URL,
} from '#shared/constants/foreninglet'
import { parseEnrolledEvents as parseEnrolledEvents, parseUserInfo } from './bifrost-parse'
import { UserInfo } from '~~/shared/types/userInfo'

export interface LookupMember {
  member_id: string
  member_full_name?: string
  username: string
  key_1: string
  key_2: string
  club_id: string
  club_name?: string,
  post_url?: string
}

export type CookieJar = Map<string, string>

/** Server-side debug logs — appear in the `nuxt dev` terminal, not the browser console. */
function bifrostLog(step: string, data?: Record<string, unknown>) {
  if (!import.meta.dev) return
  const payload = data ? ` ${JSON.stringify(data)}` : ''
  console.log(`[bifrost] ${step}${payload}`)
}

function jarSnapshot(jar: CookieJar) {
  return {
    cookieCount: jar.size,
    cookieNames: [...jar.keys()],
  }
}

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
}

function portalHeaders(extra?: Record<string, string>) {
  return {
    ...DEFAULT_HEADERS,
    Referer: LOGIN_URL,
    Origin: BASE_URL,
    ...extra,
  }
}

export function createCookieJar(): CookieJar {
  return new Map()
}

export function serializeJar(jar: CookieJar): string {
  return JSON.stringify(Object.fromEntries(jar))
}

export function deserializeJar(serialized: string): CookieJar {
  try {
    const obj = JSON.parse(serialized) as Record<string, string>
    return new Map(Object.entries(obj))
  } catch {
    return createCookieJar()
  }
}

function cookieHeader(jar: CookieJar): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

function absorbCookies(jar: CookieJar, headers: Headers) {
  const setCookies =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : []

  if (setCookies.length > 0) {
    for (const header of setCookies) {
      const [pair] = header.split(';')
      const eq = pair.indexOf('=')
      if (eq > 0) {
        jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
      }
    }
    return
  }

  const raw = headers.get('set-cookie')
  if (!raw) return

  for (const header of raw.split(/,(?=\s*[^;,]+=)/)) {
    const [pair] = header.split(';')
    const eq = pair.indexOf('=')
    if (eq > 0) {
      jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
    }
  }
}

async function bifrostFetch(
  url: string,
  jar: CookieJar,
  init: {
    method?: string
    body?: string
    headers?: Record<string, string>
    redirect?: RequestRedirect
  } = {},
): Promise<{ status: number; text: string; url: string }> {
  const headers = new Headers(init.headers)
  const cookies = cookieHeader(jar)
  if (cookies) headers.set('Cookie', cookies)

  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers,
    body: init.body,
    redirect: init.redirect ?? 'follow',
  })

  absorbCookies(jar, res.headers)
  const text = await res.text()

  bifrostLog('fetch', {
    method: init.method ?? 'GET',
    url,
    status: res.status,
    finalUrl: res.url,
    bodyLength: text.length,
    ...jarSnapshot(jar),
  })

  return { status: res.status, text, url: res.url }
}

export function parseClubId(html: string): string {
  const match = html.match(/name=["']club_id["'][^>]*value=["']([^"']*)["']/i)
    ?? html.match(/value=["']([^"']*)["'][^>]*name=["']club_id["']/i)
  return match?.[1] ?? DEFAULT_CLUB_ID
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
    change_account_enabled: '0',
    remember_me: '0',
    club_id: clubId,
  }).toString()

  const { status, text } = await bifrostFetch(LOOKUP_URL, jar, {
    method: 'POST',
    headers: {
      ...portalHeaders({ 'X-Requested-With': 'XMLHttpRequest' }),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (status < 200 || status >= 300) {
    throw new Error(`Lookup failed (${status}).`)
  }

  const trimmed = text.trim()
  bifrostLog('lookup:response', {
    status,
    bodyLength: trimmed.length,
    preview: trimmed.slice(0, 200),
  })

  if (trimmed === '[]') return []

  const members = JSON.parse(trimmed) as LookupMember[]
  bifrostLog('lookup:members', {
    count: members.length,
    first: members[0]
      ? {
          member_id: members[0].member_id,
          member_full_name: members[0].member_full_name,
          post_url: members[0].post_url,
        }
      : null,
  })
  return members
}

function checkLoginSuccess(text: string, url: string) {
  const lower = text.toLowerCase()
  return {
    urlFrontpage: url.includes('frontpage') || url.includes('dashboard'),
    htmlLogUd: text.includes('Log ud') || lower.includes('log ud'),
    htmlMinProfil: text.includes('Min profil') || lower.includes('min profil'),
    htmlVelkommen: text.includes('Velkommen') || lower.includes('velkommen'),
    htmlFrontpageLink: lower.includes('memberportal/frontpage'),
    htmlLogout: lower.includes('log-out') || lower.includes('logout'),
  }
}

async function completeLogin(member: LookupMember, jar: CookieJar): Promise<boolean> {
  let postUrl = member.post_url ?? DO_LOGIN_URL
  if (!postUrl.startsWith('http')) {
    postUrl = new URL(postUrl, LOGIN_URL).href
  }

  bifrostLog('completeLogin:start', {
    postUrl,
    member_id: member.member_id,
    club_id: member.club_id,
    ...jarSnapshot(jar),
  })

  const body = new URLSearchParams({
    username: member.username,
    key_1: member.key_1,
    key_2: member.key_2,
    club_id: member.club_id,
    member_id: member.member_id,
  }).toString()

  const { status, text, url } = await bifrostFetch(postUrl, jar, {
    method: 'POST',
    headers: {
      ...portalHeaders(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    redirect: 'follow',
  })

  if (status < 200 || status >= 400) {
    bifrostLog('completeLogin:httpError', { status, url })
    throw new Error(`Login failed (${status}).`)
  }

  const checks = checkLoginSuccess(text, url)
  bifrostLog('completeLogin:response', {
    status,
    finalUrl: url,
    bodyLength: text.length,
    titleMatch: text.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim(),
    preview: text.replace(/\s+/g, ' ').slice(0, 400),
    checks,
    ...jarSnapshot(jar),
  })

  if (Object.values(checks).some(Boolean)) {
    bifrostLog('completeLogin:success', { reason: 'response-checks' })
    return true
  }

  const sessionOk = await verifyBifrostSession(jar)
  bifrostLog('completeLogin:frontpageVerify', { sessionOk, ...jarSnapshot(jar) })

  if (sessionOk) {
    bifrostLog('completeLogin:success', { reason: 'frontpage-verify' })
    return true
  }

  bifrostLog('completeLogin:failed', {
    hint: 'No URL/HTML match and frontpage verify failed. See preview above.',
  })
  return false
}

export async function bifrostLogin(
  email: string,
  password: string,
): Promise<{ member: LookupMember; jar: CookieJar }> {
  bifrostLog('login:start', { email: email.replace(/(.{2}).+(@.*)/, '$1***$2') })
  const jar = createCookieJar()

  const page = await bifrostFetch(LOGIN_URL, jar, {
    headers: DEFAULT_HEADERS,
  })

  if (page.status < 200 || page.status >= 400) {
    bifrostLog('login:loginPageFailed', { status: page.status })
    throw new Error(`Could not load login page (${page.status}).`)
  }

  const clubId = parseClubId(page.text)
  bifrostLog('login:clubId', { clubId, ...jarSnapshot(jar) })

  const members = await lookupMembers(email, password, clubId, jar)

  if (members.length === 0) {
    bifrostLog('login:noMembers')
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid email or password.',
    })
  }

  const member = members[0]
  const ok = await completeLogin(member, jar)

  if (!ok) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Login could not be confirmed. Check the terminal running `npm run dev` for [bifrost] logs.',
    })
  }

  bifrostLog('login:success', { member_id: member.member_id, ...jarSnapshot(jar) })
  return { member, jar }
}

export async function verifyBifrostSession(jar: CookieJar): Promise<boolean> {
  if (jar.size === 0) {
    bifrostLog('verify:noCookies')
    return false
  }

  const { status, text, url } = await bifrostFetch(FRONTPAGE_URL, jar, {
    headers: DEFAULT_HEADERS,
  })

  if (status < 200 || status >= 400) {
    bifrostLog('verify:httpError', { status, url })
    return false
  }

  const checks = checkLoginSuccess(text, url)
  const ok = Object.values(checks).some(Boolean)
  bifrostLog('verify:result', { ok, checks, finalUrl: url, bodyLength: text.length })
  return ok
}

export async function fetchUserEvents(jar: CookieJar): Promise<UserEvent[]> {
  const { status, text } = await bifrostFetch(EVENTS_URL, jar, {
    headers: {
      ...DEFAULT_HEADERS,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Referer: FRONTPAGE_URL,
    },
  })

  if (status === 401 || status === 403) {
    throw createError({ statusCode: 401, statusMessage: 'Session expired.' })
  }

  if (status < 200 || status >= 400) {
    throw createError({
      statusCode: 502,
      statusMessage: `Bifrost request failed (${status}).`,
    })
  }

  return parseEnrolledEvents(text)
}

export async function fetchUserInfo(jar: CookieJar): Promise<UserInfo> {
  const { status, text } = await bifrostFetch(PROFILE_URL, jar, {
    headers: {
      ...DEFAULT_HEADERS,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Referer: FRONTPAGE_URL,
    },
  })

  if (status === 401 || status === 403) {
    throw createError({ statusCode: 401, statusMessage: 'Session expired.' })
  }

  if (status < 200 || status >= 400) {
    throw createError({
      statusCode: 502,
      statusMessage: `Bifrost request failed (${status}).`,
    })
  }

  return parseUserInfo(text)
}