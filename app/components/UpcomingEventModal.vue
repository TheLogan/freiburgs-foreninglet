<script setup lang="ts">
import { BASE_URL } from '#shared/constants/foreninglet'
import type { UpcomingEvent } from '#shared/types/event'
import type { SubscribeFormField } from '#shared/types/subscribe'

const props = defineProps<{
  modelValue: boolean
  event: UpcomingEvent | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const {
  form,
  loading,
  postingComment,
  deletingComment,
  deletingCommentHref,
  commentPending,
  error,
  successMessage,
  loadSubscribeForm,
  postComment,
  followSubscribeLink,
  resetSubscribe,
} = useEventSubscribe()

const formValues = ref<Record<string, string>>({})
const subscribeContentRef = ref<HTMLElement | null>(null)
const commentsHtmlRef = ref<HTMLElement | null>(null)

const hasSubscribeContent = computed(
  () =>
    Boolean(
      form.value?.metadataHtml
      || form.value?.infoHtml
      || form.value?.commentsHtml,
    ),
)

const visibleFields = computed(() =>
  form.value?.fields.filter((field) => field.type !== 'hidden') ?? [],
)

const hiddenFields = computed(() =>
  form.value?.fields.filter((field) => field.type === 'hidden') ?? [],
)

function displayDates(event: UpcomingEvent): string {
  return event.dateRange ?? event.startDate ?? ''
}

function close() {
  emit('update:modelValue', false)
}

function initFormValues(fields: SubscribeFormField[]) {
  const values: Record<string, string> = {}
  for (const field of fields) {
    values[field.name] = field.value ?? ''
  }
  formValues.value = values
}

function checkboxModel(field: SubscribeFormField): boolean {
  return Boolean(formValues.value[field.name])
}

function setCheckbox(field: SubscribeFormField, checked: boolean) {
  formValues.value[field.name] = checked ? (field.value || 'true') : ''
}

function buildSubmitPayload(): Record<string, string> {
  const payload: Record<string, string> = { ...formValues.value }
  for (const field of hiddenFields.value) {
    payload[field.name] = field.value ?? payload[field.name] ?? ''
  }
  return payload
}

function clearCommentField() {
  const textarea = form.value?.fields.find((field) => field.type === 'textarea')
  if (textarea) {
    formValues.value[textarea.name] = ''
  }
}

async function handlePostComment() {
  if (!props.event) return
  const ok = await postComment(props.event.id, buildSubmitPayload())
  if (ok) {
    clearCommentField()
    emit('success')
  }
}

async function refreshComments() {
  if (!props.event?.id || loading.value || postingComment.value) return
  await loadSubscribeForm(props.event.id)
}

function isDeleteCommentAction(anchor: HTMLAnchorElement, href: string): boolean {
  const label = anchor.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  if (/^delete comment$/i.test(label) || /^slet\s+kommentar$/i.test(label)) {
    return true
  }
  const lower = href.toLowerCase()
  return (
    (/slet|delete|remove/i.test(lower) && /kommentar|comment/i.test(lower))
    || lower.includes('deletecomment')
  )
}

function isInterceptedLink(href: string): boolean {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return false
  }
  if (href.startsWith('/memberportal/')) return true
  try {
    const url = new URL(href, BASE_URL)
    return url.origin === new URL(BASE_URL).origin && url.pathname.startsWith('/memberportal/')
  } catch {
    return false
  }
}

function applyCommentDeletingState() {
  const root = commentsHtmlRef.value
  if (!root) return

  for (const el of root.querySelectorAll('.comment--deleting')) {
    el.classList.remove('comment--deleting')
  }

  if (!deletingComment.value || !deletingCommentHref.value) return

  const href = deletingCommentHref.value
  let target =
    root.querySelector<HTMLElement>(
      `.comment[data-delete-href="${CSS.escape(href)}"]`,
    )
    ?? null

  if (!target) {
    for (const link of root.querySelectorAll<HTMLAnchorElement>('a.comment-delete-link')) {
      if (link.getAttribute('href') === href) {
        target = link.closest<HTMLElement>('.comment')
        break
      }
    }
  }

  target?.classList.add('comment--deleting')
}

async function onSubscribeContentClick(event: MouseEvent) {
  const anchor = (event.target as HTMLElement).closest('a')
  if (!anchor || !subscribeContentRef.value?.contains(anchor)) return

  const href = anchor.getAttribute('href')
  if (!href || !isInterceptedLink(href)) return

  event.preventDefault()
  event.stopPropagation()

  if (
    !props.event?.id
    || loading.value
    || postingComment.value
    || deletingComment.value
  ) {
    return
  }

  const isDelete = isDeleteCommentAction(anchor, href)
  await followSubscribeLink(props.event.id, href, { deletingComment: isDelete })
}

watch(
  [deletingComment, deletingCommentHref, () => form.value?.commentsHtml],
  () => {
    nextTick(applyCommentDeletingState)
  },
)

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) {
      resetSubscribe()
      formValues.value = {}
      return
    }
    if (props.event?.id) {
      await loadSubscribeForm(props.event.id)
    }
  },
)

watch(
  form,
  (loaded) => {
    if (loaded) {
      initFormValues(loaded.fields)
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
          v-if="successMessage && !loading"
          type="success"
          variant="tonal"
          class="mb-4"
          density="compact"
        >
          {{ successMessage }}
        </v-alert>

        <v-alert
          v-if="postingComment"
          type="info"
          variant="tonal"
          class="mb-4"
          density="compact"
        >
          Posting comment and updating the list…
        </v-alert>

        <template v-if="form">
          <div
            v-if="hasSubscribeContent"
            ref="subscribeContentRef"
            class="mb-4"
            :class="{ 'subscribe-content--busy': loading || postingComment }"
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

            <div v-if="form.commentsHtml || commentPending">
              <div class="d-flex align-center mb-2 ga-2">
                <div class="text-overline text-medium-emphasis">
                  Comments
                </div>
                <v-spacer />
                <v-btn
                  v-if="commentPending"
                  size="small"
                  variant="text"
                  :loading="loading"
                  :disabled="loading || postingComment"
                  @click="refreshComments"
                >
                  Refresh
                </v-btn>
              </div>
              <div
                v-if="form.commentsHtml"
                ref="commentsHtmlRef"
                class="subscribe-comments rounded pa-3"
                v-html="form.commentsHtml"
              />
              <v-alert
                v-else-if="commentPending"
                type="info"
                variant="tonal"
                density="compact"
              >
                Your comment was submitted. Refresh to check if it has appeared.
              </v-alert>
            </div>
          </div>

          <v-form @submit.prevent="handlePostComment">
            <div class="text-overline text-medium-emphasis mb-2">
              Add a comment
            </div>
            <template
              v-for="field in visibleFields"
              :key="field.name"
            >
              <v-checkbox
                v-if="field.type === 'checkbox'"
                :model-value="checkboxModel(field)"
                :label="field.label"
                :disabled="field.disabled || postingComment || loading"
                hide-details="auto"
                class="mb-2"
                @update:model-value="setCheckbox(field, Boolean($event))"
              />

              <v-radio-group
                v-else-if="field.type === 'radio' && field.options?.length"
                v-model="formValues[field.name]"
                :label="field.label"
                :disabled="field.disabled || postingComment || loading"
                hide-details="auto"
                class="mb-2"
              >
                <v-radio
                  v-for="option in field.options"
                  :key="`${field.name}-${option.value}`"
                  :label="option.label"
                  :value="option.value"
                />
              </v-radio-group>

              <v-select
                v-else-if="field.type === 'select' && field.options?.length"
                v-model="formValues[field.name]"
                :label="field.label"
                :items="field.options"
                item-title="label"
                item-value="value"
                :disabled="field.disabled || postingComment || loading"
                :required="field.required"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                class="mb-2"
              />

              <v-textarea
                v-else-if="field.type === 'textarea'"
                v-model="formValues[field.name]"
                :label="field.label"
                :disabled="field.disabled || postingComment || loading"
                :required="field.required"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                rows="3"
                class="mb-2"
              />

              <v-text-field
                v-else
                v-model="formValues[field.name]"
                :label="field.label"
                :type="field.type === 'unknown' ? 'text' : field.type"
                :disabled="field.disabled || postingComment || loading"
                :required="field.required"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                class="mb-2"
              />
            </template>

            <v-btn
              v-if="visibleFields.length"
              type="submit"
              color="primary"
              variant="flat"
              class="mt-2"
              :loading="postingComment"
              :disabled="loading || postingComment"
            >
              {{ postingComment ? 'Posting…' : 'Post comment' }}
            </v-btn>
          </v-form>
        </template>

      </v-card-text>

      <v-divider />

      <v-card-actions class="pa-4">
        <v-btn
          variant="text"
          @click="close"
        >
          Close
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

.subscribe-comments :deep(.comment.comment--deleting) {
  pointer-events: none;
}

.subscribe-comments :deep(.comment.comment--deleting::after) {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: 8px;
  background: rgba(var(--v-theme-surface), 0.88);
}

.subscribe-comments :deep(.comment.comment--deleting::before) {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 3;
  width: 28px;
  height: 28px;
  margin: -14px 0 0 -14px;
  border: 3px solid rgba(var(--v-theme-primary), 0.2);
  border-top-color: rgb(var(--v-theme-primary));
  border-radius: 50%;
  animation: comment-delete-spin 0.75s linear infinite;
}

@keyframes comment-delete-spin {
  to {
    transform: rotate(360deg);
  }
}

.subscribe-comments :deep(.comment-delete-link) {
  color: rgb(var(--v-theme-error));
  font-weight: 500;
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
</style>
