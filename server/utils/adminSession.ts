import { bifrostLogin, type CookieJar } from './bifrost'
import { isSessionExpiredError } from './bifrost-parse'

/** After a failed login, wait this long before trying again so we don't hammer Foreninglet or lock the account. */
const LOGIN_RETRY_DELAY_MS = 60_000

let adminJar: CookieJar | null = null
let initPromise: Promise<CookieJar> | null = null
let lastLoginFailureAt: number | null = null

function serviceUnavailable() {
  return createError({
    statusCode: 503,
    statusMessage: 'Events are temporarily unavailable. Please try again later.',
  })
}

async function initAdminSession(): Promise<CookieJar> {
  const username = process.env.FORENINGLET_USERNAME
  const password = process.env.FORENINGLET_PASSWORD

  try {
    if (!username || !password) {
      throw new Error('FORENINGLET_USERNAME and FORENINGLET_PASSWORD must be set in environment.')
    }

    const { jar } = await bifrostLogin(username, password)
    adminJar = jar
    lastLoginFailureAt = null
    console.info('[adminSession] Signed in to Foreninglet.')
    return jar
  } catch (error) {
    lastLoginFailureAt = Date.now()
    const reason = (error as { statusMessage?: string, message?: string })?.statusMessage
      ?? (error as Error)?.message
      ?? String(error)
    console.error(
      `[adminSession] Foreninglet login failed: ${reason} Retrying in ${LOGIN_RETRY_DELAY_MS / 1000}s at the earliest.`,
    )
    throw serviceUnavailable()
  }
}

export async function getAdminJar(): Promise<CookieJar> {
  if (adminJar !== null) return adminJar

  if (lastLoginFailureAt !== null && Date.now() - lastLoginFailureAt < LOGIN_RETRY_DELAY_MS) {
    throw serviceUnavailable()
  }

  // Deduplicate concurrent initialization requests
  if (!initPromise) {
    initPromise = initAdminSession().finally(() => { initPromise = null })
  }
  return initPromise
}

/** Invalidate the cached session so the next call to getAdminJar() re-authenticates. */
export function invalidateAdminSession(): void {
  adminJar = null
}

/**
 * Run a Foreninglet request with the shared session. If Foreninglet reports the
 * session as expired, sign in again and retry once.
 */
export async function withAdminJar<T>(fn: (jar: CookieJar) => Promise<T>): Promise<T> {
  const jar = await getAdminJar()
  try {
    return await fn(jar)
  } catch (error) {
    if (!isSessionExpiredError(error)) throw error

    // Only the first request to notice the expiry drops the session; others reuse the new login.
    if (adminJar === jar) {
      console.info('[adminSession] Foreninglet session expired; signing in again.')
      invalidateAdminSession()
    }
    return await fn(await getAdminJar())
  }
}
