<script setup lang="ts">
import type { UpcomingEvent } from "#shared/types/event";

const { isAuthed } = useAuth();
const { events, loading, error, getUpcomingEvents } = useUpcomingEvents();

const subscribeModalOpen = ref(false);
const selectedEvent = ref<UpcomingEvent | null>(null);

function openSubscribe(event: UpcomingEvent) {
  selectedEvent.value = event;
  subscribeModalOpen.value = true;
}

function onSubscribeSuccess() {
  getUpcomingEvents();
}

const search = ref("");
const page = ref(1);
const itemsPerPage = ref(25);

const itemsPerPageOptions = [
  { value: 10, title: "10" },
  { value: 25, title: "25" },
  { value: 50, title: "50" },
  { value: 100, title: "100" },
] as const;

const headers = [
  { title: "Event", key: "name", minWidth: "180px" },
  { title: "Dates", key: "dates", minWidth: "160px" },
  { title: "Location", key: "location", minWidth: "140px" },
  { title: "Price", key: "price", width: "120px" },
  { title: "Status", key: "status", width: "120px" },
  { title: "", key: "actions", width: "100px", sortable: false },
] as const;

const eventCount = computed(() => events.value.length);

const filteredEvents = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return events.value;

  return events.value.filter((event) => {
    const haystack = [
      event.name,
      event.location,
      event.instructor,
      event.price,
      event.seats,
      event.dateRange,
      event.startDate,
      statusLabel(event.status),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });
});

const filteredCount = computed(() => filteredEvents.value.length);

const noDataText = computed(() =>
  search.value.trim()
    ? "No events match your search."
    : "No upcoming events found.",
);

function displayDates(event: UpcomingEvent): string {
  return event.dateRange ?? event.startDate ?? "—";
}

function statusLabel(status: UpcomingEvent["status"]): string {
  if (status === "available") return "Available";
  if (status === "sold_out") return "Sold out";
  return "Unknown";
}

function statusColor(status: UpcomingEvent["status"]): string {
  if (status === "available") return "success";
  if (status === "sold_out") return "error";
  return "default";
}

watch(search, () => {
  page.value = 1;
});

watch(
  isAuthed,
  (authed) => {
    if (authed) {
      getUpcomingEvents();
    }
  },
  { immediate: true },
);
</script>

<template>
  <v-card class="upcoming-events-card" elevation="1">
    <v-card-title class="d-flex align-center flex-wrap ga-2 py-4">
      <v-icon icon="mdi-calendar-star" class="mr-1" color="primary" />
      <span>Upcoming events</span>
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
      Open activities you can register for on Foreninglet
    </v-card-subtitle>

    <v-card-text v-if="eventCount > 0 || search" class="pt-4 pb-0">
      <v-text-field
        v-model="search"
        prepend-inner-icon="mdi-magnify"
        label="Search events"
        placeholder="Name, location, instructor, dates…"
        clearable
        hide-details
        density="comfortable"
        variant="outlined"
      />
      <p
        v-if="search.trim()"
        class="text-caption text-medium-emphasis mt-2 mb-0"
      >
        Showing {{ filteredCount }} of {{ eventCount }} events
      </p>
    </v-card-text>

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
      v-model:page="page"
      v-model:items-per-page="itemsPerPage"
      :headers="headers"
      :items="filteredEvents"
      :items-per-page-options="itemsPerPageOptions"
      :loading="loading"
      :loading-text="loading ? 'Loading upcoming events…' : undefined"
      :no-data-text="noDataText"
      item-value="id"
      hover
      density="comfortable"
      class="upcoming-events-table"
    >
      <template #item.name="{ item }">
          <v-btn variant="flat" @click="openSubscribe(item)">
            <span class="font-weight-medium d-block">{{ item.name }}</span>
            <span
              v-if="item.instructor"
              class="text-caption text-medium-emphasis"
            >
              {{ item.instructor }}
            </span>
            <span
              v-if="item.seats"
              class="text-caption text-medium-emphasis d-block"
            >
              {{ item.seats }}
            </span>
          </v-btn>
      </template>

      <template #item.dates="{ item }">
        <v-chip
          v-if="displayDates(item) !== '—'"
          size="small"
          variant="tonal"
          prepend-icon="mdi-calendar-outline"
          label
        >
          {{ displayDates(item) }}
        </v-chip>
        <span v-else class="text-medium-emphasis">—</span>
      </template>

      <template #item.location="{ value }">
        <span v-if="value" class="text-body-2">{{ value }}</span>
        <span v-else class="text-medium-emphasis">—</span>
      </template>

      <template #item.price="{ value }">
        <span v-if="value" class="text-body-2">{{ value }}</span>
        <span v-else class="text-medium-emphasis">—</span>
      </template>

      <template #item.status="{ item }">
        <v-chip
          :color="statusColor(item.status)"
          size="small"
          variant="tonal"
          label
        >
          {{ statusLabel(item.status) }}
        </v-chip>
      </template>

      <template #item.actions="{ item }">
        <v-btn
          v-if="item.status === 'available'"
          size="small"
          variant="tonal"
          color="primary"
          @click="openSubscribe(item)"
        >
          Register
        </v-btn>
      </template>
    </v-data-table>

    <UpcomingEventModal
      v-model="subscribeModalOpen"
      :event="selectedEvent"
      @success="onSubscribeSuccess"
    />
  </v-card>
</template>

<style scoped>
.upcoming-events-table :deep(thead th) {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.upcoming-events-table :deep(tbody tr:hover) {
  background: rgba(var(--v-theme-primary), 0.04);
}
</style>
