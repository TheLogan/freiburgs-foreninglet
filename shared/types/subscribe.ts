export type SubscribeFieldType =
  | 'hidden'
  | 'text'
  | 'email'
  | 'tel'
  | 'number'
  | 'password'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'unknown'

export interface SubscribeFieldOption {
  value: string
  label: string
}

export interface SubscribeFormField {
  name: string
  label: string
  type: SubscribeFieldType
  value: string
  required: boolean
  disabled: boolean
  options?: SubscribeFieldOption[]
}

export interface SubscribeForm {
  action: string
  method: 'GET' | 'POST'
  fields: SubscribeFormField[]
  pageTitle?: string
  /** Date, time, price, location, etc. from the Foreninglet sign-up page */
  metadataHtml?: string
  /** Free-text description from the sign-up page (excludes metadata and comments) */
  infoHtml?: string
  /** Member comment threads from the sign-up page */
  commentsHtml?: string
}

export interface SubscribeFormResponse {
  form: SubscribeForm
}

export interface SubscribeLinkBody {
  url: string
}

export interface PostCommentBody {
  fields: Record<string, string>
}

export interface PostCommentResponse {
  success: boolean
  message: string
  form?: SubscribeForm
  /** True when the comment was accepted but not yet visible in the HTML feed */
  commentPending?: boolean
}
