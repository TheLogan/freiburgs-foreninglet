import { getAdminJar } from '../../utils/adminSession'
import type { User } from '#shared/types/user'

export default defineEventHandler(async (_event) => {
  await getAdminJar()
  const user: User = { id: 'system' }
  return user
})
