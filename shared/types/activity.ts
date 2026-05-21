export interface Activity {
  teamId: string
  name: string
  date: string
}

export interface ActivitiesResponse {
  activities: Activity[]
}
