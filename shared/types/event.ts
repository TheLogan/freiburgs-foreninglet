export interface UpcomingEvent {
  id: string              // from subscribe URL, e.g. "205658"
  name: string
  status: 'available' | 'sold_out' | 'unknown' | string
  price?: string          // raw text: "75,00 DKK" or tiered HTML as text
  startDate?: string      // settlement-date-div text
  dateRange?: string      // e.g. "19. juli 2026 - 24. juli 2026"
  location?: string
  instructor?: string
  seats?: string          // e.g. "22 ledige pladser"
  subscribeUrl: string
}

export interface UpcomingEventResponse {
  upcomingEvents: UpcomingEvent[]
}