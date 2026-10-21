export interface UpcomingEvent {
  id: string              // from subscribe URL, e.g. "205658"
  name: string
  status: 'available' | 'sold_out' | 'unknown'
  price?: string          // e.g. "575,00 DKK"
  startDate?: string      // e.g. "5. maj 2027, kl. 09:00"
  dateRange?: string      // multi-day events, e.g. "5. maj 2027, kl. 09:00 - 9. maj 2027, kl. 12:00"
  location?: string       // "Mødested" when given, otherwise the event's location
  seats?: string          // e.g. "22 ledige pladser"
  signupDeadline?: string // "Tilmeldingsfrist", e.g. "23. okt. 2026, kl. 23:45"
  subscribeUrl: string
}

export interface UpcomingEventResponse {
  upcomingEvents: UpcomingEvent[]
}
