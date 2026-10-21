<script setup lang="ts">
import { BASE_URL } from '#shared/constants/foreninglet'
import type { UpcomingEvent } from '#shared/types/event'

const props = defineProps<{
  modelValue: boolean
  event: UpcomingEvent | null
  startAtCheckout?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const {
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
} = useEventSubscribe()

const subscribeContentRef = ref<HTMLElement | null>(null)
const acceptedTerms = ref(false)
const showTermsError = ref(false)
const isCheckoutStep = computed(() => checkout.value !== null)

const openingCheckout = computed(
  () =>
    Boolean(props.startAtCheckout)
    && checkoutLoading.value
    && !checkout.value,
)

const acceptTermsLabel = computed(
  () =>
    checkout.value?.acceptTermsLabel?.trim()
    || 'Jeg accepterer handelsbetingelser',
)

const conditionsErrorText = computed(
  () =>
    checkout.value?.conditionsErrorMessage?.trim()
    || 'Du skal godkende betingelserne for at komme videre',
)

const hasSubscribeContent = computed(
  () =>
    Boolean(
      form.value?.metadataHtml
      || form.value?.infoHtml
      || form.value?.commentsHtml,
    ),
)

function displayDates(event: UpcomingEvent): string {
  return event.dateRange ?? event.startDate ?? ''
}

function close() {
  emit('update:modelValue', false)
}

async function handleSubscribe() {
  if (!props.event?.id || props.event.status !== 'available') return
  const ok = await loadPaymentCheckout(props.event.id)
  if (ok) {
    acceptedTerms.value = false
    showTermsError.value = false
  }
}

function backToDetails() {
  clearCheckout()
  acceptedTerms.value = false
  showTermsError.value = false
  if (props.event?.id && !form.value) {
    void loadSubscribeForm(props.event.id)
  }
}

function continueToPayment() {
  if (!acceptedTerms.value) {
    showTermsError.value = true
    return
  }
  const url = checkout.value?.paymentUrl
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

watch(acceptedTerms, (checked) => {
  if (checked) showTermsError.value = false
})

function resolveForeningletUrl(href: string): string | null {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return null
  }
  try {
    const url = new URL(href, BASE_URL)
    return url.origin === new URL(BASE_URL).origin ? url.href : null
  } catch {
    return null
  }
}

/** Links in the scraped HTML point at Foreninglet; open them there instead of on this site. */
function onSubscribeContentClick(event: MouseEvent) {
  const anchor = (event.target as HTMLElement).closest('a')
  if (!anchor || !subscribeContentRef.value?.contains(anchor)) return

  const url = resolveForeningletUrl(anchor.getAttribute('href') ?? '')
  if (!url) return

  event.preventDefault()
  event.stopPropagation()
  window.open(url, '_blank', 'noopener,noreferrer')
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) {
      resetSubscribe()
      acceptedTerms.value = false
      showTermsError.value = false
      return
    }
    if (!props.event?.id) return

    if (props.startAtCheckout) {
      const ok = await loadPaymentCheckout(props.event.id)
      if (ok) {
        acceptedTerms.value = false
        showTermsError.value = false
      }
      void loadSubscribeForm(props.event.id)
    } else {
      await loadSubscribeForm(props.event.id)
    }
  },
)
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="640"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card v-if="event">
      <v-card-title class="d-flex align-center py-4">
        <v-icon
          icon="mdi-calendar-text"
          class="mr-2"
          color="primary"
        />
        <span class="text-truncate">{{ event.name }}</span>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          aria-label="Close"
          @click="close"
        />
      </v-card-title>

      <v-divider />

      <v-card-text class="pt-4">
        <v-skeleton-loader
          v-if="openingCheckout"
          type="article, paragraph@2"
        />

        <template v-else-if="isCheckoutStep && checkout">
          <div class="text-h6 mb-1">
            {{ checkout.pageTitle || event.name }}
          </div>
          <div
            v-if="checkout.memberName"
            class="text-subtitle-1 mb-1"
          >
            {{ checkout.memberName }}
          </div>
          <div
            v-if="checkout.invoiceNumber"
            class="text-caption text-medium-emphasis mb-4"
          >
            Fakturanr.: {{ checkout.invoiceNumber }}
          </div>

          <v-table
            v-if="checkout.lineItems.length"
            density="compact"
            class="checkout-table mb-4"
          >
            <thead>
              <tr>
                <th class="text-left">
                  Tekst
                </th>
                <th class="text-right">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in checkout.lineItems"
                :key="index"
              >
                <td>{{ row.text }}</td>
                <td class="text-right">
                  {{ row.amount }}
                </td>
              </tr>
              <tr v-if="checkout.total">
                <td class="font-weight-bold">
                  Total
                </td>
                <td class="text-right font-weight-bold">
                  {{ checkout.total }}
                </td>
              </tr>
            </tbody>
          </v-table>

          <div
            v-if="checkout.noticeHtml"
            class="text-body-2 checkout-notice mb-4"
            v-html="checkout.noticeHtml"
          />

          <v-checkbox
            v-model="acceptedTerms"
            :label="acceptTermsLabel"
            hide-details="auto"
            class="mb-2"
          />

          <v-alert
            v-if="showTermsError"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-4"
            role="alert"
          >
            {{ conditionsErrorText }}
          </v-alert>

          <v-expansion-panels
            v-if="checkout.termsHtml"
            class="checkout-terms"
          >
            <v-expansion-panel>
              <v-expansion-panel-title>
                Handelsbetingelser
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <div
                  class="checkout-terms__body text-body-2"
                  v-html="checkout.termsHtml"
                />
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </template>

        <template v-else>
          <div class="mb-4">
            <div
              v-if="displayDates(event)"
              class="text-body-2 text-medium-emphasis"
            >
              {{ displayDates(event) }}
            </div>
            <div class="d-flex flex-wrap ga-2 mt-2">
              <v-chip
                v-if="event.location"
                size="small"
                variant="tonal"
                prepend-icon="mdi-map-marker-outline"
              >
                {{ event.location }}
              </v-chip>
              <v-chip
                v-if="event.price"
                size="small"
                variant="tonal"
                prepend-icon="mdi-currency-usd"
              >
                {{ event.price }}
              </v-chip>
              <v-chip
                v-if="event.seats"
                size="small"
                variant="tonal"
              >
                {{ event.seats }}
              </v-chip>
            </div>
          </div>

          <v-skeleton-loader
            v-if="loading && !form"
            type="article, paragraph@3"
          />

          <v-alert
            v-if="error && !loading"
            type="error"
            variant="tonal"
            class="mb-4"
            density="compact"
            role="alert"
          >
            {{ error }}
          </v-alert>

          <v-alert
            v-if="checkoutError"
            type="error"
            variant="tonal"
            class="mb-4"
            density="compact"
            role="alert"
          >
            {{ checkoutError }}
          </v-alert>

          <template v-if="form">
          <div
            v-if="hasSubscribeContent"
            ref="subscribeContentRef"
            class="mb-4"
            :class="{ 'subscribe-content--busy': loading }"
            @click="onSubscribeContentClick"
          >
            <div
              v-if="form.metadataHtml"
              class="mb-4"
            >
              <div class="text-overline text-medium-emphasis mb-2">
                Event details
              </div>
              <div
                class="subscribe-metadata rounded pa-3"
                v-html="form.metadataHtml"
              />
            </div>

            <div
              v-if="form.infoHtml"
              class="mb-4"
            >
              <div class="text-overline text-medium-emphasis mb-2">
                Information
              </div>
              <div
                class="subscribe-info rounded pa-3"
                v-html="form.infoHtml"
              />
            </div>

            <div v-if="form.commentsHtml">
              <div class="text-overline text-medium-emphasis mb-2">
                Comments
              </div>
              <div
                class="subscribe-comments rounded pa-3"
                v-html="form.commentsHtml"
              />
            </div>
          </div>
          </template>
        </template>

      </v-card-text>

      <v-divider />

      <v-card-actions class="pa-4">
        <v-btn
          variant="text"
          :disabled="checkoutLoading"
          @click="isCheckoutStep ? backToDetails() : close()"
        >
          {{ isCheckoutStep ? 'Back' : 'Close' }}
        </v-btn>
        <v-spacer />
        <v-btn
          v-if="isCheckoutStep"
          color="primary"
          variant="flat"
          @click="continueToPayment"
        >
          Videre til betaling
        </v-btn>
        <v-btn
          v-else-if="event.status === 'available'"
          color="primary"
          variant="flat"
          :loading="checkoutLoading"
          :disabled="loading || checkoutLoading"
          @click="handleSubscribe"
        >
          Register
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.subscribe-metadata,
.subscribe-info,
.subscribe-comments {
  font-size: 0.875rem;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.87);
}

.subscribe-metadata {
  background: rgba(var(--v-theme-primary), 0.06);
  border: 1px solid rgba(var(--v-theme-primary), 0.12);
}

.subscribe-metadata :deep(.row) {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin: 0;
}

.subscribe-metadata :deep(.col-lg-4),
.subscribe-metadata :deep(.col-lg-6),
.subscribe-metadata :deep(.col-lg-8) {
  flex: 1 1 160px;
  width: auto;
  max-width: 100%;
  padding: 0;
  float: none;
}

.subscribe-metadata :deep(.col-lg-4 > div),
.subscribe-metadata :deep(.activity-first-sub-column > div),
.subscribe-metadata :deep(.activity-second-sub-column > div) {
  margin-bottom: 6px;
}

.subscribe-metadata :deep(.col-lg-4 > div:last-child),
.subscribe-metadata :deep(.activity-first-sub-column > div:last-child),
.subscribe-metadata :deep(.activity-second-sub-column > div:last-child) {
  margin-bottom: 0;
}

.subscribe-metadata :deep(i.glyphicon),
.subscribe-metadata :deep(i.fa) {
  margin-right: 6px;
  opacity: 0.7;
}

.subscribe-info {
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.subscribe-comments {
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

/* The shared profile's own delete controls must not be shown to visitors. */
.subscribe-comments :deep(.comment-delete-link) {
  display: none;
}

.subscribe-comments :deep(.show-all-comments) {
  margin: 0 0 0.75rem;
}

.subscribe-comments :deep(.show-all-comments a) {
  font-weight: 500;
}

.subscribe-comments :deep(.comment) {
  position: relative;
  display: block;
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.subscribe-comments :deep(.comment:last-child) {
  margin-bottom: 0;
}

.subscribe-comments :deep(.comment .hidden-xs),
.subscribe-comments :deep(.comment .col-sm-1) {
  display: none;
}

.subscribe-comments :deep(.comment .col-sm-11) {
  width: 100%;
  max-width: 100%;
  padding: 0;
  float: none;
}

.subscribe-comments :deep(.comment .row) {
  margin: 0 0 4px;
}

.subscribe-comments :deep(.comment .row:last-child) {
  margin-bottom: 0;
}

.subscribe-comments :deep(.comment b) {
  font-weight: 600;
  font-size: 0.9375rem;
}

.subscribe-comments :deep(.comment small) {
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 0.75rem;
}

.subscribe-comments :deep(.comment p) {
  margin: 6px 0 0;
  white-space: pre-wrap;
}

.subscribe-info :deep(p) {
  margin: 0 0 0.75rem;
}

.subscribe-info :deep(p:last-child) {
  margin-bottom: 0;
}

.subscribe-metadata :deep(a),
.subscribe-info :deep(a),
.subscribe-comments :deep(a) {
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.subscribe-content--busy {
  opacity: 0.6;
  pointer-events: none;
}

.checkout-table :deep(th),
.checkout-table :deep(td) {
  border-bottom: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.checkout-notice :deep(strong) {
  font-weight: 600;
}

.checkout-terms__body {
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.87);
}
</style>
