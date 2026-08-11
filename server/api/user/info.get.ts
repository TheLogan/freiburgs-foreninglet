import { fetchAutoPaymentStatus, fetchUserInfo } from '../../utils/bifrost'
import { getAdminJar } from '../../utils/adminSession'

export default defineEventHandler(async (_event) => {
  const jar = await getAdminJar()

  const [userInfo, autoPaymentEnabled] = await Promise.all([
    fetchUserInfo(jar),
    fetchAutoPaymentStatus(jar).catch(() => false),
  ])

  return { userInfo: { ...userInfo, autoPaymentEnabled } }
})
