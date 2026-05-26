import { fetchSubscribeForm } from '../../../utils/bifrost'
import { getSessionJar, getSessionUser } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  const user = getSessionUser(event)
  const jar = getSessionJar(event)

  if (!user || !jar) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated.' })
  }

  const id = getRouterParam(event, 'id')
  if (!id?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Activity id is required.' })
  }

  const form = await fetchSubscribeForm(jar, id.trim())
  return { form }
})
