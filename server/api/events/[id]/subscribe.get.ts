import { fetchSubscribeForm } from '../../../utils/bifrost'
import { withAdminJar } from '../../../utils/adminSession'

function activityId(event: Parameters<typeof getRouterParam>[0]): string {
  const id = getRouterParam(event, 'id')?.trim() ?? ''
  if (!/^\d+$/.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Activity id is required.' })
  }
  return id
}

// Cached per event, like the event list, so opening details doesn't hit Foreninglet every time.
export default defineCachedEventHandler(async (event) => {
  const id = activityId(event)
  const form = await withAdminJar((jar) => fetchSubscribeForm(jar, id))
  return { form }
}, {
  name: 'event-details',
  maxAge: 5 * 60,
  swr: true,
  getKey: (event) => activityId(event),
})
