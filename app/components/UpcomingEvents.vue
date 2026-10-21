<script setup lang="ts">
import type { UpcomingEvent } from "#shared/types/event";

const { events, loading, error, getUpcomingEvents } = useUpcomingEvents();

/** Day and short month for the date tile, from e.g. "7. nov. 2026, kl. 17:00". */
function dateTile(event: UpcomingEvent): { day: string; month: string } | null {
  const match = event.startDate?.match(/^(\d{1,2})\.\s*([a-zæøå]+)/i);
  if (!match) return null;
  return { day: match[1]!, month: match[2]!.slice(0, 3) };
}

function displayDates(event: UpcomingEvent): string | undefined {
  return event.dateRange ?? event.startDate;
}

// Render the list on the server so the embed shows events immediately instead of a loading state.
await callOnce("upcoming-events", getUpcomingEvents);
</script>

<template>
  <section class="events" aria-labelledby="events-title">
    <header class="events__header">
      <h2 id="events-title" class="events__title">
        Kommende arrangementer
      </h2>
      <p class="events__lead">
        Tilmelding og betaling foregår på Foreninglet.
      </p>
    </header>

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

    <template v-if="loading && !events.length">
      <v-skeleton-loader
        v-for="n in 2"
        :key="n"
        type="list-item-avatar-three-line"
        class="event-card mb-3"
      />
    </template>

    <p
      v-else-if="!error && !events.length"
      class="events__empty"
    >
      Der er ingen kommende arrangementer lige nu. Kig forbi igen senere.
    </p>

    <article
      v-for="event in events"
      :key="event.id"
      class="event-card"
    >
      <div class="event-card__main">
        <div
          v-if="dateTile(event)"
          class="event-card__date"
          aria-hidden="true"
        >
          <span class="event-card__day">{{ dateTile(event)!.day }}</span>
          <span class="event-card__month">{{ dateTile(event)!.month }}</span>
        </div>

        <div class="event-card__body">
          <h3 class="event-card__name">
            {{ event.name }}
          </h3>
          <ul class="event-card__meta">
            <li v-if="displayDates(event)">
              <v-icon icon="mdi-calendar-outline" size="16" />
              {{ displayDates(event) }}
            </li>
            <li v-if="event.location">
              <v-icon icon="mdi-map-marker-outline" size="16" />
              {{ event.location }}
            </li>
            <li v-if="event.price">
              <v-icon icon="mdi-ticket-outline" size="16" />
              {{ event.price }}
            </li>
          </ul>
          <p
            v-if="event.seats || event.signupDeadline"
            class="event-card__seats"
          >
            <span v-if="event.seats">{{ event.seats }}</span>
            <span v-if="event.seats && event.signupDeadline"> · </span>
            <span v-if="event.signupDeadline">Tilmeldingsfrist {{ event.signupDeadline }}</span>
          </p>
        </div>

        <div class="event-card__actions">
          <v-chip
            v-if="event.status === 'sold_out'"
            color="error"
            variant="tonal"
            size="small"
            label
          >
            Udsolgt
          </v-chip>
          <v-btn
            v-else-if="event.status === 'available'"
            color="secondary"
            variant="flat"
            :href="event.subscribeUrl"
            target="_blank"
            rel="noopener noreferrer"
            append-icon="mdi-open-in-new"
          >
            Tilmeld
          </v-btn>
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.events {
  max-width: 960px;
  margin: 0 auto;
}

.events__header {
  margin-bottom: 24px;
}

.events__title {
  display: inline-block;
  font-size: 1.5rem;
  font-weight: 500;
  line-height: 1.3;
  padding-bottom: 6px;
  /* Same yellow underline as the active item in the site's navigation. */
  border-bottom: 4px solid rgb(var(--v-theme-secondary));
}

.events__lead {
  margin: 8px 0 0;
  color: rgba(var(--v-theme-on-background), 0.7);
}

.events__empty {
  padding: 32px 0;
  color: rgba(var(--v-theme-on-background), 0.7);
}

.event-card {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-divider));
  border-radius: 4px;
  margin-bottom: 12px;
  overflow: hidden;
}

.event-card__main {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 16px 20px;
  align-items: center;
  padding: 16px 20px;
}

.event-card__date {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 4px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  line-height: 1;
}

.event-card__day {
  font-size: 1.6rem;
  font-weight: 700;
}

.event-card__month {
  margin-top: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-secondary));
}

.event-card__name {
  font-size: 1.125rem;
  font-weight: 500;
  line-height: 1.35;
  margin: 0 0 6px;
}

.event-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.8);
}

.event-card__meta li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.event-card__seats {
  margin: 6px 0 0;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.event-card__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

@media (max-width: 600px) {
  .event-card__main {
    grid-template-columns: auto 1fr;
    align-items: start;
    gap: 12px 16px;
    padding: 16px;
  }

  .event-card__date {
    width: 52px;
    height: 52px;
  }

  .event-card__day {
    font-size: 1.3rem;
  }

  .event-card__actions {
    grid-column: 1 / -1;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}
</style>
