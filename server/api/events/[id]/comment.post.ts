import { postActivityComment } from '../../../utils/bifrost'
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

  const body = await readBody(event)
  const fields =
    body?.fields && typeof body.fields === 'object' && !Array.isArray(body.fields)
      ? (body.fields as Record<string, string>)
      : null

  if (!fields) {
    throw createError({ statusCode: 400, statusMessage: 'Comment form fields are required.' })
  }

  return await postActivityComment(jar, id.trim(), fields)
})
