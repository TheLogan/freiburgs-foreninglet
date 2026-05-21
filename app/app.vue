<script setup lang="ts">
import { useTheme } from 'vuetify'

const { isAuthed, user, logout } = useAuth()
const theme = useTheme()

function toggleTheme() {
  theme.change(theme.global.current.value.dark ? 'light' : 'dark')
}
</script>

<template>
  <v-app>
    <v-app-bar :elevation="isAuthed ? 1 : 0" color="surface">
      <v-app-bar-title class="text-truncate">
        Freiburgs Foreninglet
      </v-app-bar-title>

      <template v-if="isAuthed">
        <v-chip
          v-if="user?.name"
          class="ml-2 d-none d-sm-inline-flex"
          size="small"
          variant="tonal"
        >
          {{ user.name }}
        </v-chip>
      </template>

      <v-spacer />

      <v-btn
        :icon="theme.global.current.value.dark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
        variant="text"
        aria-label="Toggle light/dark theme"
        @click="toggleTheme"
      />

      <v-btn
        v-if="isAuthed"
        variant="text"
        class="ml-1"
        @click="logout"
      >
        Log out
      </v-btn>
    </v-app-bar>

    <v-main>
      <NuxtPage />
    </v-main>
  </v-app>
</template>
