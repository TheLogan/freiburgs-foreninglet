export const BASE_URL = 'https://bifrost.foreninglet.dk'

export const DEFAULT_CLUB_ID = '3322'

export const LOGIN_URL = `${BASE_URL}/memberportal/login`
export const FRONTPAGE_URL = `${BASE_URL}/memberportal/frontpage`
export const EVENTS_URL = `${BASE_URL}/memberportal/memberactivities`
export const LOOKUP_URL = `${BASE_URL}/memberportal/login/lookupmembers`
export const DO_LOGIN_URL = `${BASE_URL}/memberportal/login/dologin`
export const PROFILE_URL = `${BASE_URL}/memberportal/masterdata#`
export const ALL_AVAILABLE_EVENTS_URL = `${BASE_URL}/memberportal/enrollment`

export function subscribeIndexUrl(activityId: string): string {
  return `${BASE_URL}/memberportal/subscribe/index/${activityId}`
}

/** Payment checkout after sign-up; trailing slot is the price/option index (usually 0). */
export function subscribeIdentifyUrl(activityId: string, slot = '0'): string {
  return `${BASE_URL}/memberportal/subscribe/identify/${activityId}/${slot}`
}

export const AUTOMATIC_PAYMENT_URL = `${BASE_URL}/memberportal/recurring`
// MEMBER_URLS = [f"{BASE_URL}/memberportal/subscribe/index/97990", f"{BASE_URL}/memberportal/subscribe/index/97991"]