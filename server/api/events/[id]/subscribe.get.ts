import { fetchSubscribeForm } from '../../../utils/bifrost'
import { withAdminJar } from '../../../utils/adminSession'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Activity id is required.' })
  }

  const form = await withAdminJar((jar) => fetchSubscribeForm(jar, id.trim()))
  return { form }
})
