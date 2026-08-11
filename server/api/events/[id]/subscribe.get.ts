import { fetchSubscribeForm } from '../../../utils/bifrost'
import { getAdminJar } from '../../../utils/adminSession'

export default defineEventHandler(async (event) => {
  const jar = await getAdminJar()

  const id = getRouterParam(event, 'id')
  if (!id?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Activity id is required.' })
  }

  const form = await fetchSubscribeForm(jar, id.trim())
  return { form }
})
