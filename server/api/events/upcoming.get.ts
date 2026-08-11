import { fetchUpcomingEvents } from '../../utils/bifrost'
import { getAdminJar } from '../../utils/adminSession'

export default defineEventHandler(async (_event) => {
  const jar = await getAdminJar()
  const upcomingEvents = await fetchUpcomingEvents(jar)
  return { upcomingEvents }
})
