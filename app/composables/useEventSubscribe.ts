import type {
  PaymentCheckout,
  PaymentCheckoutResponse,
  PostCommentResponse,
  SubscribeForm,
} from '#shared/types/subscribe'
import { getFetchErrorMessage } from '~/utils/errors'

type SubscribeStatus = 'idle' | 'loading' | 'posting' | 'error'

function normalizeMatchText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

function commentsHtmlIncludesText(
  commentsHtml: string | undefined,
  commentText: string,
): boolean {
  const needle = normalizeMatchText(commentText)
  if (!needle) return true
  if (!commentsHtml) return false
  const haystack = normalizeMatchText(commentsHtml.replace(/<[^>]+>/g, ' '))
  return haystack.includes(needle)
}

function extractCommentText(
  fields: Record<string, string>,
  loadedForm?: SubscribeForm | null,
): string {
  const textarea = loadedForm?.fields.find((field) => field.type === 'textarea')
  if (textarea?.name) {
    const value = fields[textarea.name]?.trim()
    if (value) return value
  }

  let longest = ''
  for (const value of Object.values(fields)) {
    const trimmed = value.trim()
    if (trimmed.length > longest.length) {
      longest = trimmed
    }
  }
  return longest
}

export function useEventSubscribe() {
  const form = useState<SubscribeForm | null>('subscribe-form', () => null)
  const status = useState<SubscribeStatus>('subscribe-status', () => 'idle')
  const error = useState<string | null>('subscribe-error', () => null)
  const successMessage = useState<string | null>(
    'subscribe-success',
    () => null,
  )
  const commentPending = useState<boolean>(
    'subscribe-comment-pending',
    () => false,
  )
  const pendingCommentText = useState<string | null>(
    'subscribe-pending-comment-text',
    () => null,
  )
  const deletingComment = useState<boolean>(
    'subscribe-deleting-comment',
    () => false,
  )
  const deletingCommentHref = useState<string | null>(
    'subscribe-deleting-comment-href',
    () => null,
  )
  const checkout = useState<PaymentCheckout | null>('subscribe-checkout', () => null)
  const checkoutLoading = useState<boolean>(
    'subscribe-checkout-loading',
    () => false,
  )
  const checkoutError = useState<string | null>(
    'subscribe-checkout-error',
    () => null,
  )

  const loading = computed(() => status.value === 'loading')
  const postingComment = computed(() => status.value === 'posting')

  function syncCommentPendingState(loaded: SubscribeForm | null) {
    if (!commentPending.value || !pendingCommentText.value) return
    if (commentsHtmlIncludesText(loaded?.commentsHtml, pendingCommentText.value)) {
      commentPending.value = false
      pendingCommentText.value = null
    }
  }

  async function loadSubscribeForm(activityId: string) {
    const hadForm = form.value !== null
    status.value = 'loading'
    error.value = null
    if (!hadForm) {
      successMessage.value = null
      commentPending.value = false
      pendingCommentText.value = null
      form.value = null
    }

    try {
      const data = await $fetch<{ form: SubscribeForm }>(
        `/api/events/${activityId}/subscribe`,
      )
      form.value = data.form
      syncCommentPendingState(data.form)
      status.value = 'idle'
    } catch (e) {
      status.value = hadForm ? 'idle' : 'error'
      error.value = getFetchErrorMessage(e, 'Could not load activity page.')
    }
  }

  async function postComment(
    activityId: string,
    fields: Record<string, string>,
  ): Promise<boolean> {
    status.value = 'posting'
    error.value = null
    successMessage.value = null
    commentPending.value = false

    try {
      const result = await $fetch<PostCommentResponse>(
        `/api/events/${activityId}/comment`,
        { method: 'POST', body: { fields } },
      )

      if (result.success) {
        const postedText = extractCommentText(fields, form.value)
        if (result.form) {
          form.value = result.form
        }
        commentPending.value = result.commentPending ?? false
        pendingCommentText.value = commentPending.value ? postedText : null
        if (result.form) {
          syncCommentPendingState(result.form)
        }
        successMessage.value = result.message
        status.value = 'idle'
        return true
      }

      status.value = 'error'
      error.value = result.message
      return false
    } catch (e) {
      status.value = 'error'
      error.value = getFetchErrorMessage(e, 'Could not post comment.')
      return false
    }
  }

  async function followSubscribeLink(
    activityId: string,
    url: string,
    options?: { deletingComment?: boolean },
  ) {
    const isDelete = options?.deletingComment ?? false
    deletingComment.value = isDelete
    deletingCommentHref.value = isDelete ? url : null
    if (!isDelete) {
      status.value = 'loading'
    }
    error.value = null
    successMessage.value = null

    try {
      const data = await $fetch<{ form: SubscribeForm }>(
        `/api/events/${activityId}/subscribe/link`,
        { method: 'POST', body: { url } },
      )
      form.value = data.form
      syncCommentPendingState(data.form)
      if (deletingComment.value) {
        successMessage.value = 'Comment deleted.'
      }
      status.value = 'idle'
      return true
    } catch (e) {
      status.value = 'idle'
      error.value = getFetchErrorMessage(
        e,
        deletingComment.value
          ? 'Could not delete comment.'
          : 'That action could not be completed.',
      )
      return false
    } finally {
      deletingComment.value = false
    }
  }

  async function loadPaymentCheckout(activityId: string, slot?: string) {
    checkoutLoading.value = true
    checkoutError.value = null

    try {
      const query = slot ? { slot } : undefined
      const data = await $fetch<PaymentCheckoutResponse>(
        `/api/events/${activityId}/subscribe/checkout`,
        { query },
      )
      checkout.value = data.checkout
      return true
    } catch (e) {
      checkout.value = null
      checkoutError.value = getFetchErrorMessage(
        e,
        'Could not load payment checkout.',
      )
      return false
    } finally {
      checkoutLoading.value = false
    }
  }

  function clearCheckout() {
    checkout.value = null
    checkoutError.value = null
  }

  function resetSubscribe() {
    form.value = null
    status.value = 'idle'
    error.value = null
    successMessage.value = null
    commentPending.value = false
    pendingCommentText.value = null
    deletingComment.value = false
    deletingCommentHref.value = null
    checkout.value = null
    checkoutLoading.value = false
    checkoutError.value = null
  }

  return {
    form,
    loading,
    postingComment,
    deletingComment,
    deletingCommentHref,
    commentPending,
    error,
    successMessage,
    checkout,
    checkoutLoading,
    checkoutError,
    loadSubscribeForm,
    postComment,
    followSubscribeLink,
    loadPaymentCheckout,
    clearCheckout,
    resetSubscribe,
  }
}
