export const BASE_URL = 'https://bifrost.foreninglet.dk'

export const DEFAULT_CLUB_ID = '3322'

export const LOGIN_URL = `${BASE_URL}/memberportal/login`
export const LOOKUP_URL = `${BASE_URL}/memberportal/login/lookupmembers`
export const DO_LOGIN_URL = `${BASE_URL}/memberportal/login/dologin`
export const ALL_AVAILABLE_EVENTS_URL = `${BASE_URL}/memberportal/activity/search`

export function subscribeIndexUrl(activityId: string): string {
  return `${BASE_URL}/memberportal/subscribe/index/${activityId}`
}
