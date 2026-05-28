export interface UserInfo {
  legalName: string
  birthDate: string
  autoPaymentEnabled: boolean
  parentsName?: string
  parentsPhoneNo?: string
  parentsEmail?: string
  nickname?: string
  
  address: string
  postcode: string
  city: string
  email: string
  phoneNo: string
  handicap: boolean
  gender: string
  specialNeeds: string
  pronouns: string
}

export interface UserInfoResponse {
  userInfo: UserInfo
}
