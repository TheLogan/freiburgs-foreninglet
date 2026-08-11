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

  return { user, isAuthed, fetchSession }
}
