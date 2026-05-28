<script setup lang="ts">
import type { UserInfo } from '#shared/types/userInfo'

const { isAuthed } = useAuth()
const { userInfo, loading, error, getUserInfo } = useUserInfo()

interface InfoField {
  label: string
  value: string
  icon: string
}

interface InfoSection {
  title: string
  fields: InfoField[]
}

function hasText(value: string | undefined): value is string {
  return Boolean(value?.trim())
}

function buildSections(info: UserInfo): InfoSection[] {
  const sections: InfoSection[] = [
    {
      title: 'Contact',
      fields: [
        { label: 'Email', value: info.email, icon: 'mdi-email-outline' },
        { label: 'Phone', value: info.phoneNo, icon: 'mdi-phone-outline' },
      ],
    },
    {
      title: 'Address',
      fields: [
        { label: 'Street', value: info.address, icon: 'mdi-home-outline' },
        {
          label: 'Postcode & city',
          value: [info.postcode, info.city].filter(Boolean).join(' '),
          icon: 'mdi-map-marker-outline',
        },
      ],
    },
    {
      title: 'Other',
      fields: [
        { label: 'Pronouns', value: info.pronouns, icon: 'mdi-account-voice' },
        { label: 'Special needs', value: info.specialNeeds, icon: 'mdi-heart-outline' },
        { label: 'Gender', value: info.gender, icon: 'mdi-gender-male-female' },
      ],
    },
  ]

  const parentFields: InfoField[] = []
  if (hasText(info.parentsName)) {
    parentFields.push({
      label: 'Parent / guardian',
      value: info.parentsName,
      icon: 'mdi-account-supervisor-outline',
    })
  }
  if (hasText(info.parentsPhoneNo)) {
    parentFields.push({
      label: 'Parent phone',
      value: info.parentsPhoneNo,
      icon: 'mdi-phone-outline',
    })
  }
  if (hasText(info.parentsEmail)) {
    parentFields.push({
      label: 'Parent email',
      value: info.parentsEmail,
      icon: 'mdi-email-outline',
    })
  }
  if (parentFields.length) {
    sections.splice(1, 0, { title: 'Parents / guardians', fields: parentFields })
  }

  return sections
    .map((section) => ({
      ...section,
      fields: section.fields.filter((field) => hasText(field.value)),
    }))
    .filter((section) => section.fields.length > 0)
}

const displayName = computed(() => {
  const info = userInfo.value
  if (!info) return ''
  return info.nickname?.trim() || info.legalName?.trim() || 'Member'
})

const initials = computed(() => {
  const name = displayName.value
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? ''
    const last = parts[parts.length - 1]?.[0] ?? ''
    const combined = (first + last).toUpperCase()
    if (combined) return combined
  }
  return name.slice(0, 2).toUpperCase() || '?'
})

const sections = computed(() =>
  userInfo.value ? buildSections(userInfo.value) : [],
)

const showEmpty = computed(
  () => !loading.value && !error.value && !userInfo.value,
)

watch(isAuthed, (authed) => {
  if (authed) {
    getUserInfo()
  }
}, { immediate: true })
</script>

<template>
  <v-card class="user-info-card" elevation="1">
    <v-card-title class="d-flex align-center py-4">
      <v-icon
        icon="mdi-account-circle-outline"
        class="mr-2"
        color="primary"
      />
      <span>Profile</span>
      <v-spacer />
      <v-progress-circular
        v-if="loading"
        indeterminate
        size="22"
        width="2"
        color="primary"
      />
    </v-card-title>

    <v-divider />

    <v-card-text class="pa-0">
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

      <div v-if="loading && !userInfo" class="pa-4">
        <div class="d-flex align-center mb-4">
          <v-skeleton-loader type="avatar" />
          <div class="ml-4 flex-grow-1">
            <v-skeleton-loader type="heading" width="60%" />
            <v-skeleton-loader type="text" width="40%" class="mt-2" />
          </div>
        </div>
        <v-skeleton-loader type="paragraph@3" />
      </div>

      <template v-else-if="userInfo">
        <div class="profile-header pa-4 pb-2">
          <v-avatar color="primary" size="56" variant="tonal">
            <span class="text-h6 font-weight-medium">{{ initials }}</span>
          </v-avatar>
          <div class="profile-header__text ml-4">
            <div class="text-h6 font-weight-medium">
              {{ displayName }}
            </div>
            <div
              v-if="userInfo.legalName && userInfo.nickname?.trim()"
              class="text-body-2 text-medium-emphasis"
            >
              {{ userInfo.legalName }}
            </div>
            <div class="d-flex flex-wrap ga-2 mt-2">
              <v-chip
                v-if="userInfo.birthDate"
                size="small"
                variant="tonal"
                prepend-icon="mdi-cake-variant-outline"
              >
                {{ userInfo.birthDate }}
              </v-chip>
              <v-chip
                v-if="userInfo.handicap"
                size="small"
                variant="tonal"
                color="secondary"
                prepend-icon="mdi-golf"
              >
                Handicap
              </v-chip>
              <v-chip
                size="small"
                variant="tonal"
                :color="userInfo.autoPaymentEnabled ? 'success' : 'default'"
                :prepend-icon="userInfo.autoPaymentEnabled ? 'mdi-credit-card-check-outline' : 'mdi-credit-card-off-outline'"
              >
                {{ userInfo.autoPaymentEnabled ? 'Auto-pay on' : 'Auto-pay off' }}
              </v-chip>
            </div>
          </div>
        </div>

        <v-divider class="mx-4" />

        <div
          v-for="(section, index) in sections"
          :key="section.title"
          class="px-2 pb-2"
        >
          <div class="text-overline text-medium-emphasis px-4 pt-4 pb-1">
            {{ section.title }}
          </div>
          <v-list density="compact" class="bg-transparent py-0">
            <v-list-item
              v-for="field in section.fields"
              :key="`${section.title}-${field.label}`"
              :prepend-icon="field.icon"
              class="py-1"
            >
              <v-list-item-title class="text-caption text-medium-emphasis">
                {{ field.label }}
              </v-list-item-title>
              <v-list-item-subtitle class="text-body-2 text-high-emphasis">
                {{ field.value }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
          <v-divider
            v-if="index < sections.length - 1"
            class="mx-4"
          />
        </div>
      </template>

      <v-card-text
        v-else-if="showEmpty"
        class="text-body-2 text-medium-emphasis text-center py-8"
      >
        No profile information available.
      </v-card-text>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.profile-header {
  display: flex;
  align-items: center;
}

.profile-header__text {
  min-width: 0;
}
</style>
