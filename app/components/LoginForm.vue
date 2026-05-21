<script setup lang="ts">
import { getFetchErrorMessage } from '~/utils/errors'

const { login } = useAuth()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true

  if (!username.value.trim() || !password.value) {
    error.value = 'Please fill in all fields.'
    loading.value = false
    return
  }

  try {
    await login(username.value.trim(), password.value)
  } catch (e) {
    error.value = getFetchErrorMessage(e, 'Login failed.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-card
    class="mx-auto"
    max-width="420"
    width="100%"
    title="Sign in"
    subtitle="Use your Foreninglet API credentials"
  >
    <v-card-text>
      <v-form @submit.prevent="handleSubmit">
        <v-text-field
          v-model="username"
          label="Username"
          name="username"
          autocomplete="username"
          placeholder="API username"
          prepend-inner-icon="mdi-account"
          class="mb-2"
          :disabled="loading"
          required
        />

        <v-text-field
          v-model="password"
          label="Password"
          name="password"
          type="password"
          autocomplete="current-password"
          placeholder="API password"
          prepend-inner-icon="mdi-lock"
          :disabled="loading"
          required
        />

        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          class="mt-4"
          density="compact"
          role="alert"
        >
          {{ error }}
        </v-alert>

        <v-btn
          type="submit"
          color="primary"
          block
          size="large"
          class="mt-6"
          :loading="loading"
        >
          Sign in
        </v-btn>
      </v-form>
    </v-card-text>
  </v-card>
</template>
