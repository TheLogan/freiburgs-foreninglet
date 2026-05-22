import type { UserInfoResponse } from '#shared/types/userInfo'
import { getFetchErrorMessage } from '~/utils/errors'

type UserInfoStatus = 'idle' | 'loading' | 'success' | 'error'

export function useUserInfo() {
  const userInfo = useState<UserInfo | null>('user-info', () => null)
  const status = useState<UserInfoStatus>('user-info-status', () => 'idle')
  const error = useState<string | null>('user-info-error', () => null)

  const loading = computed(() => status.value === 'loading')

  async function getUserInfo() {
    status.value = 'loading'
    error.value = null

    try {
      const data = await $fetch<UserInfoResponse>('/api/user/info')
      userInfo.value = data.userInfo
      status.value = 'success'
    } catch (e) {
      status.value = 'error'
      error.value = getFetchErrorMessage(e, 'Could not load user info.')
    }
  }

  function clearUserInfo() {
    userInfo.value = null
    status.value = 'idle'
    error.value = null
  }

  return { userInfo, loading, error, getUserInfo, clearUserInfo }
}
