import type { UpcomingEvent, UpcomingEventResponse } from '#shared/types/event'

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
    } catch {
      status.value = 'error'
      error.value = 'Arrangementerne kunne ikke hentes lige nu. Prøv igen senere.'
      events.value = []
    }
  }

  return { events, loading, error, getUpcomingEvents }
}
