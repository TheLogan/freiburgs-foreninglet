<script setup lang="ts">
const { isAuthed } = useAuth()
</script>

<template>
  <v-container
    v-if="!isAuthed"
    class="fill-height d-flex align-center justify-center"
    fluid
  >
    <LoginForm />
  </v-container>

  <v-container v-else class="py-6">
    <header class="mb-6">
      <h1 class="text-h4 font-weight-medium mb-1">
        Dashboard
      </h1>
      <p class="text-body-2 text-medium-emphasis mb-0">
        Your Foreninglet profile and enrolled events.
      </p>
    </header>

    <v-row>
      <v-col cols="12" lg="5">
        <UserInfo />
      </v-col>
      <v-col cols="12" lg="7">
        <UserEvents />
      </v-col>
    </v-row>
  </v-container>
</template>
