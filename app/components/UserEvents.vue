<script setup lang="ts">
const { isAuthed } = useAuth()
const { userEvents, loading, error, getUserEvents } = useUserEvents()

const headers = [
  { title: 'Team ID', key: 'teamId', width: '120px' },
  { title: 'Event', key: 'name' },
  { title: 'Date', key: 'date', width: '140px' },
] as const

const eventCount = computed(() => userEvents.value.length)

watch(isAuthed, (authed) => {
  if (authed) {
    getUserEvents()
  }
}, { immediate: true })
</script>

<template>
  <v-card class="user-events-card" elevation="1">
    <v-card-title class="d-flex align-center flex-wrap ga-2 py-4">
      <v-icon
        icon="mdi-calendar-multiple"
        class="mr-1"
        color="primary"
      />
      <span>Enrolled events</span>
      <v-chip
        v-if="!loading && eventCount > 0"
        size="small"
        variant="tonal"
        color="primary"
      >
        {{ eventCount }}
      </v-chip>
      <v-spacer />
      <v-progress-circular
        v-if="loading"
        indeterminate
        size="22"
        width="2"
        color="primary"
      />
    </v-card-title>

    <v-card-subtitle class="pb-0">
      Teams and upcoming dates from Foreninglet
    </v-card-subtitle>

    <v-divider class="mt-3" />

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      class="ma-4"
      density="compact"
      role="alert"
    >
      {{ error }}
    </v-alert>

    <v-data-table
      :headers="[...headers]"
      :items="userEvents"
      :loading="loading"
      loading-text="Loading events…"
      no-data-text="No enrolled events found."
      item-value="teamId"
      hover
      density="comfortable"
      class="user-events-table"
    >
      <template #item.teamId="{ value }">
        <span class="text-medium-emphasis font-weight-medium">{{ value }}</span>
      </template>

      <template #item.name="{ value }">
        <span class="font-weight-medium">{{ value }}</span>
      </template>

      <template #item.date="{ value }">
        <v-chip
          v-if="value"
          size="small"
          variant="tonal"
          prepend-icon="mdi-calendar-outline"
          label
        >
          {{ value }}
        </v-chip>
      </template>

      <template #bottom />
    </v-data-table>
  </v-card>
</template>

<style scoped>
.user-events-table :deep(thead th) {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.user-events-table :deep(tbody tr:hover) {
  background: rgba(var(--v-theme-primary), 0.04);
}
</style>
