export default defineNuxtRouteMiddleware(async () => {
  const { isAuthed, fetchSession } = useAuth()

  if (!isAuthed.value) {
    await fetchSession()
  }
})
