<script setup lang="ts">
import { useTheme } from 'vuetify'

const theme = useTheme()

function toggleTheme() {
  theme.change(theme.global.current.value.dark ? 'light' : 'dark')
}
</script>

<template>
  <v-app>
    <v-app-bar elevation="1" color="surface">
      <v-app-bar-title class="text-truncate">
        Freiburgs Foreninglet
      </v-app-bar-title>

      <v-spacer />

      <v-btn
        :icon="theme.global.current.value.dark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
        variant="text"
        aria-label="Toggle light/dark theme"
        @click="toggleTheme"
      />
    </v-app-bar>

    <v-main>
      <NuxtPage />
    </v-main>
  </v-app>
</template>
