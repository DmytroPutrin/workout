<script setup lang="ts">
import type { NuxtError } from '#app'

// Nuxt renders this instead of app.vue when a fatal error is thrown,
// e.g. opening /workouts/999 that doesn't exist or isn't yours.
const props = defineProps<{ error: NuxtError }>()

const title = computed(() => (props.error.statusCode === 404 ? 'Not found' : 'Something went wrong'))

useHead({ title: () => `${title.value} · Workout Tracker` })

function goHome() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center px-4">
    <div class="max-w-sm text-center">
      <p class="text-sm font-semibold text-brand-600">{{ error.statusCode }}</p>
      <h1 class="mt-2 text-2xl font-bold tracking-tight">{{ title }}</h1>
      <p class="mt-2 text-sm text-zinc-500">{{ error.statusMessage || error.message }}</p>
      <button type="button" class="btn-primary mt-6" @click="goHome">Back to home</button>
    </div>
  </div>
</template>
