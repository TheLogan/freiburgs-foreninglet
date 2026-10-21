import { getAdminJar } from '../utils/adminSession'

// Sign in at startup so bad credentials show up in the server log immediately, not on the first visit.
export default defineNitroPlugin(() => {
  getAdminJar().catch(() => {
    // Already logged by initAdminSession.
  })
})
