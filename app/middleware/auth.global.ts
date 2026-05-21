export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthed, fetchSession } = useAuth()

  if (!isAuthed.value) {
    await fetchSession()
  }

  if (!isAuthed.value && to.path !== '/') {
    return navigateTo('/')
  }
})
