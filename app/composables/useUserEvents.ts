import type { EventsResponse, UserEvent } from '#shared/types/userEvents'
import { getFetchErrorMessage } from '~/utils/errors'

// export type { UserEvent as Activity }

type EventsStatus = 'idle' | 'loading' | 'success' | 'error'

export function useUserEvents() {
  const userEvents = useState<UserEvent[]>('user-events', () => [])
  const status = useState<EventsStatus>('user-events-status', () => 'idle')
  const error = useState<string | null>('user-events-error', () => null)

  const loading = computed(() => status.value === 'loading')

  async function getUserEvents() {
    status.value = 'loading'
    error.value = null

    try {
      const data = await $fetch<EventsResponse>('/api/user/events')
      userEvents.value = data.userEvents
      status.value = 'success'
    } catch (e) {
      status.value = 'error'
      error.value = getFetchErrorMessage(e, 'Could not load events.')
      userEvents.value = []
    }
  }

  function clearUserEvents() {
    userEvents.value = []
    status.value = 'idle'
    error.value = null
  }

  return {
    userEvents,
    status,
    error,
    loading,
    getUserEvents,
    clearUserEvents,
  }
}
