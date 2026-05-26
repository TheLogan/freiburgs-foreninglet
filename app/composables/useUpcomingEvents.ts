import type { UpcomingEvent, UpcomingEventResponse } from '#shared/types/event'
import { getFetchErrorMessage } from '~/utils/errors'

export type { UpcomingEvent }

type EventStatus = 'idle' | 'loading' | 'success' | 'error'

export function useUpcomingEvents() {
  const events = useState<UpcomingEvent[]>('upcoming-events', () => [])
  const status = useState<EventStatus>('upcoming-events-status', () => 'idle')
  const error = useState<string | null>('upcoming-events-error', () => null)

  const loading = computed(() => status.value === 'loading')

  async function getUpcomingEvents() {
    status.value = 'loading'
    error.value = null

    try {
      const data = await $fetch<UpcomingEventResponse>('/api/events/upcoming')
      events.value = data.upcomingEvents
      status.value = 'success'
      console.log('data', data)
    } catch (e) {
      status.value = 'error'
      error.value = getFetchErrorMessage(e, 'Could not load upcoming events.')
      events.value = []
    }
  }

  function clearUpcomingEvents() {
    events.value = []
    status.value = 'idle'
    error.value = null
  }

  return { events, loading, error, getUpcomingEvents, clearUpcomingEvents }
}
