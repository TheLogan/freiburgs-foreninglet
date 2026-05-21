import { verifyBifrostSession } from '../../utils/bifrost'
import { clearAuthSession, getSessionJar, getSessionUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = getSessionUser(event)
  const jar = getSessionJar(event)

  if (!user || !jar) {
    return null
  }

  const valid = await verifyBifrostSession(jar)
  if (!valid) {
    clearAuthSession(event)
    return null
  }

  return user
})
