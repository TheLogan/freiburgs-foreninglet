import { clearAuthSession } from '../../utils/session'

export default defineEventHandler((event) => {
  clearAuthSession(event)
  return { ok: true }
})
