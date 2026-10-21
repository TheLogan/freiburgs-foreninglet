import { fetchUpcomingEvents } from '../../utils/bifrost'
import { withAdminJar } from '../../utils/adminSession'

// Each refresh costs 1 + N Foreninglet page loads, so share the result between visitors for a few minutes.
export default defineCachedEventHandler(async (_event) => {
  const upcomingEvents = await withAdminJar(fetchUpcomingEvents)
  return { upcomingEvents }
}, {
  name: 'upcoming-events',
  maxAge: 5 * 60,
  swr: true,
  getKey: () => 'all',
})
