export interface UserEvent {
  teamId: string
  name: string
  date: string
}

export interface EventsResponse {
  userEvents: UserEvent[]
}
