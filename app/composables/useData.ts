import type { ActivitiesResponse, Activity } from '#shared/types/activity'
import { getFetchErrorMessage } from '~/utils/errors'

export type { Activity }

type MembershipsStatus = 'idle' | 'loading' | 'success' | 'error'

export function useData() {
  const memberships = useState<Activity[]>('memberships', () => [])
  const status = useState<MembershipsStatus>('memberships-status', () => 'idle')
  const error = useState<string | null>('memberships-error', () => null)

  const loading = computed(() => status.value === 'loading')

  async function getMemberships() {
    status.value = 'loading'
    error.value = null

    try {
      const data = await $fetch<ActivitiesResponse>('/api/user/data')
      memberships.value = data.activities
      status.value = 'success'
    } catch (e) {
      status.value = 'error'
      error.value = getFetchErrorMessage(e, 'Could not load activities.')
      memberships.value = []
    }
  }

  function clearMemberships() {
    memberships.value = []
    status.value = 'idle'
    error.value = null
  }

  return {
    memberships,
    status,
    error,
    loading,
    getMemberships,
    clearMemberships,
  }
}
