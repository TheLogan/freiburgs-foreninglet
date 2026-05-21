import type { H3Event } from 'h3'
import type { User } from '#shared/types/user'
import { deserializeJar, serializeJar, type CookieJar } from './bifrost'

export const BIFROST_SESSION_COOKIE = 'bifrost-session'
export const BIFROST_USER_COOKIE = 'bifrost-user'

export type SessionUser = User

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
}

export function getSessionJar(event: H3Event): CookieJar | null {
  const raw = getCookie(event, BIFROST_SESSION_COOKIE)
  if (!raw) return null
  const jar = deserializeJar(raw)
  return jar.size > 0 ? jar : null
}

export function getSessionUser(event: H3Event): SessionUser | null {
  const raw = getCookie(event, BIFROST_USER_COOKIE)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

export function setSession(
  event: H3Event,
  jar: CookieJar,
  user: SessionUser,
) {
  setCookie(event, BIFROST_SESSION_COOKIE, serializeJar(jar), cookieOptions)
  setCookie(event, BIFROST_USER_COOKIE, JSON.stringify(user), cookieOptions)
}

export function clearAuthSession(event: H3Event) {
  deleteCookie(event, BIFROST_SESSION_COOKIE, { path: '/' })
  deleteCookie(event, BIFROST_USER_COOKIE, { path: '/' })
}
