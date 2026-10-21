import { fetchUpcomingEvents } from '../../utils/bifrost'
import { withAdminJar } from '../../utils/adminSession'

export default defineEventHandler(async (_event) => {
  const upcomingEvents = await withAdminJar(fetchUpcomingEvents)
  return { upcomingEvents }
})
