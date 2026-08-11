import { fetchPaymentCheckout } from '../../../../utils/bifrost'
import { getAdminJar } from '../../../../utils/adminSession'

export default defineEventHandler(async (event) => {
  const jar = await getAdminJar()

  const id = getRouterParam(event, 'id')
  if (!id?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Activity id is required.' })
  }

  const query = getQuery(event)
  const slot = typeof query.slot === 'string' ? query.slot.trim() : undefined

  const checkout = await fetchPaymentCheckout(jar, id.trim(), { slot })
  return { checkout }
})
