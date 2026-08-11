import { followBifrostLink } from '../../../../utils/bifrost'
import { subscribeIndexUrl } from '#shared/constants/foreninglet'
import { getAdminJar } from '../../../../utils/adminSession'

export default defineEventHandler(async (event) => {
  const jar = await getAdminJar()

  const id = getRouterParam(event, 'id')
  if (!id?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Activity id is required.' })
  }

  const body = await readBody(event)
  const url = typeof body?.url === 'string' ? body.url.trim() : ''

  if (!url) {
    throw createError({ statusCode: 400, statusMessage: 'URL is required.' })
  }

  const activityId = id.trim()
  const form = await followBifrostLink(
    jar,
    url,
    subscribeIndexUrl(activityId),
    activityId,
  )

  return { form }
})
