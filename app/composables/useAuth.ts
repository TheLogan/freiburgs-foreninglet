import type { User } from '#shared/types/user'

export type { User }

export function useAuth() {
  const user = useState<User | null>('auth-user', () => null)
  const sessionLoaded = useState('auth-session-loaded', () => false)
  const isAuthed = computed(() => user.value != null)

  async function fetchSession() {
    if (sessionLoaded.value) return
    sessionLoaded.value = true
    try {
      user.value = await $fetch<User | null>('/api/auth/session')
    } catch {
      user.value = null
    }
  }

  async function login(username: string, password: string) {
    const data = await $fetch<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    })
    user.value = data.user
    sessionLoaded.value = true
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    user.value = null
    sessionLoaded.value = false
    useUserEvents().clearUserEvents()
    useUserInfo().clearUserInfo()
    await navigateTo('/')
  }

  return { user, isAuthed, login, fetchSession, logout }
}
