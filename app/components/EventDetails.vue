<script setup lang="ts">
import { BASE_URL } from '#shared/constants/foreninglet'
import type { SubscribeForm } from '#shared/types/subscribe'
import { getFetchErrorMessage } from '~/utils/errors'

const props = defineProps<{ eventId: string }>()

const form = ref<SubscribeForm | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const contentRef = ref<HTMLElement | null>(null)

onMounted(async () => {
  try {
    const data = await $fetch<{ form: SubscribeForm }>(`/api/events/${props.eventId}/subscribe`)
    form.value = data.form
  } catch (e) {
    error.value = getFetchErrorMessage(e, 'Could not load event details.')
  } finally {
    loading.value = false
  }
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

/** Links in the scraped HTML point at Foreninglet; open them there instead of inside the embed. */
function onContentClick(event: MouseEvent) {
  const anchor = (event.target as HTMLElement).closest('a')
  if (!anchor || !contentRef.value?.contains(anchor)) return

  const url = resolveForeningletUrl(anchor.getAttribute('href') ?? '')
  if (!url) return

  event.preventDefault()
  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div>
    <v-skeleton-loader
      v-if="loading"
      type="paragraph@2"
      class="bg-transparent"
    />

    <v-alert
      v-else-if="error"
      type="error"
      variant="tonal"
      density="compact"
      role="alert"
    >
      {{ error }}
    </v-alert>

    <div
      v-else-if="form?.infoHtml || form?.commentsHtml"
      ref="contentRef"
      @click="onContentClick"
    >
      <section
        v-if="form.infoHtml"
        class="mb-4"
      >
        <h4 class="details__heading">
          About this event
        </h4>
        <div
          class="details__info"
          v-html="form.infoHtml"
        />
      </section>

      <section v-if="form.commentsHtml">
        <h4 class="details__heading">
          Comments
        </h4>
        <div
          class="details__comments"
          v-html="form.commentsHtml"
        />
      </section>
    </div>

    <p
      v-else
      class="details__empty"
    >
      No further details for this event.
    </p>
  </div>
</template>

<style scoped>
.details__heading {
  margin: 0 0 8px;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.details__info,
.details__comments {
  font-size: 0.9375rem;
  line-height: 1.6;
}

.details__info :deep(p) {
  margin: 0 0 0.75rem;
}

.details__info :deep(p:last-child) {
  margin-bottom: 0;
}

.details__info :deep(a),
.details__comments :deep(a) {
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
  text-underline-offset: 2px;
}

.details__info :deep(img) {
  max-width: 100%;
  height: auto;
}

.details__empty {
  margin: 0;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

/* The shared profile's own delete controls must not be shown to visitors. */
.details__comments :deep(.comment-delete-link) {
  display: none;
}

.details__comments :deep(.show-all-comments) {
  margin: 0 0 0.75rem;
}

.details__comments :deep(.comment) {
  display: block;
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 4px;
  background: rgb(var(--v-theme-background));
}

.details__comments :deep(.comment:last-child) {
  margin-bottom: 0;
}

.details__comments :deep(.comment .hidden-xs),
.details__comments :deep(.comment .col-sm-1) {
  display: none;
}

.details__comments :deep(.comment .col-sm-11) {
  width: 100%;
  max-width: 100%;
  padding: 0;
  float: none;
}

.details__comments :deep(.comment .row) {
  margin: 0 0 4px;
}

.details__comments :deep(.comment b) {
  font-weight: 500;
}

.details__comments :deep(.comment small) {
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 0.75rem;
}

.details__comments :deep(.comment p) {
  margin: 6px 0 0;
  white-space: pre-wrap;
}
</style>
