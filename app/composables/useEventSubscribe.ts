import type {
  PaymentCheckout,
  PaymentCheckoutResponse,
  SubscribeForm,
} from '#shared/types/subscribe'
import { getFetchErrorMessage } from '~/utils/errors'

type SubscribeStatus = 'idle' | 'loading' | 'error'

export function useEventSubscribe() {
  const form = useState<SubscribeForm | null>('subscribe-form', () => null)
  const status = useState<SubscribeStatus>('subscribe-status', () => 'idle')
  const error = useState<string | null>('subscribe-error', () => null)
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

  async function loadSubscribeForm(activityId: string) {
    const hadForm = form.value !== null
    status.value = 'loading'
    error.value = null
    if (!hadForm) {
      form.value = null
    }

    try {
      const data = await $fetch<{ form: SubscribeForm }>(
        `/api/events/${activityId}/subscribe`,
      )
      form.value = data.form
      status.value = 'idle'
    } catch (e) {
      status.value = hadForm ? 'idle' : 'error'
      error.value = getFetchErrorMessage(e, 'Could not load activity page.')
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
    checkout.value = null
    checkoutLoading.value = false
    checkoutError.value = null
  }

  return {
    form,
    loading,
    error,
    checkout,
    checkoutLoading,
    checkoutError,
    loadSubscribeForm,
    loadPaymentCheckout,
    clearCheckout,
    resetSubscribe,
  }
}
