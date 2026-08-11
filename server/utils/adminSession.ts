import { bifrostLogin, type CookieJar } from './bifrost'

let adminJar: CookieJar | null = null
let initPromise: Promise<CookieJar> | null = null

async function initAdminSession(): Promise<CookieJar> {
  const username = process.env.FORENINGLET_USERNAME
  const password = process.env.FORENINGLET_PASSWORD

  if (!username || !password) {
    throw createError({
      statusCode: 503,
      statusMessage: 'FORENINGLET_USERNAME and FORENINGLET_PASSWORD must be set in environment.',
    })
  }

  const { jar } = await bifrostLogin(username, password)
  adminJar = jar
  return jar
}

export async function getAdminJar(): Promise<CookieJar> {
  if (adminJar !== null) return adminJar

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
