import { fetchUserEvents, fetchUserInfo } from '../../utils/bifrost'
import { getSessionJar, getSessionUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = getSessionUser(event)
  const jar = getSessionJar(event)

  if (!user || !jar) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated.' })
  }

  const userInfo = await fetchUserInfo(jar);
  return { userInfo }
})
