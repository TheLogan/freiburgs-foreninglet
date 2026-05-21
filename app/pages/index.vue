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
    <h1 class="text-h5 font-weight-medium mb-1">
      Your activities
    </h1>
    <p class="text-body-2 text-medium-emphasis mb-6">
      Enrolled teams and upcoming dates from Foreninglet.
    </p>
    <Activities />
  </v-container>
</template>
