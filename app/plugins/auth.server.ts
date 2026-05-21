// plugins/auth.server.ts
export default defineNuxtPlugin(async () => {
  const { fetchSession } = useAuth()
  await fetchSession() // hits /api/auth/session, reads cookie server-side
})