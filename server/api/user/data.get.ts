import { fetchMemberActivities } from '../../utils/bifrost'
import { getSessionJar, getSessionUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = getSessionUser(event)
  const jar = getSessionJar(event)

  if (!user || !jar) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated.' })
  }

  const activities = await fetchMemberActivities(jar)
  return { activities }
})
