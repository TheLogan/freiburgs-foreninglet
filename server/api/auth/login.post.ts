import type { User } from '#shared/types/user'
import { bifrostLogin } from '../../utils/bifrost'
import { setSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const username = typeof body?.username === 'string' ? body.username.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Username and password are required.',
    })
  }

  if (import.meta.dev) {
    console.log('[auth] login attempt', {
      username: username.replace(/(.{2}).+(@.*)/, '$1***$2'),
    })
  }

  try {
    const { member, jar } = await bifrostLogin(username, password)

    const user: User = {
      id: member.member_id,
      name: member.member_full_name,
    }

    setSession(event, jar, user)

    return { user }
  } catch (e: unknown) {
    if (import.meta.dev) {
      console.error('[auth] login failed', e)
    }
    if (e && typeof e === 'object' && 'statusCode' in e) throw e
    throw createError({
      statusCode: 502,
      statusMessage: e instanceof Error ? e.message : 'Login failed.',
    })
  }
})
