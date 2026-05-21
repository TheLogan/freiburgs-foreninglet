<script setup lang="ts">
const { isAuthed } = useAuth()
const { memberships, loading, error, getMemberships } = useData()

const headers = [
  { title: 'Team ID', key: 'teamId' },
  { title: 'Activity', key: 'name' },
  { title: 'Date', key: 'date' },
] as const

watch(isAuthed, (authed) => {
  if (authed) {
    getMemberships()
  }
}, { immediate: true })
</script>

<template>
  <v-card>
    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      class="mb-4"
      density="compact"
      role="alert"
    >
      {{ error }}
    </v-alert>

    <v-data-table
      :headers="headers"
      :items="memberships"
      :loading="loading"
      loading-text="Loading activities…"
      no-data-text="No enrolled activities found."
      item-value="teamId"
      hover
    />
  </v-card>
</template>
