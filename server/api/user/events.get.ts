import { fetchUserEvents } from '../../utils/bifrost'
import { getAdminJar } from '../../utils/adminSession'

export default defineEventHandler(async (_event) => {
  const jar = await getAdminJar()
  const userEvents = await fetchUserEvents(jar)
  return { userEvents }
})
