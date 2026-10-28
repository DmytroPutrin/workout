<script setup lang="ts">
useHead({ title: 'Workout Tracker' })

// Both requests run in parallel rather than one after the other
const [{ data: active }, { data: recent }] = await Promise.all([
  useFetch('/api/workouts/active'),
  useFetch('/api/workouts', { query: { limit: 3 } }),
])
const activeWorkout = computed(() => active.value?.workout ?? null)
const recentWorkouts = computed(() => recent.value?.items ?? [])

const starting = ref(false)
const startError = ref('')

async function startWorkout() {
  startError.value = ''
  starting.value = true
  try {
    // Returns the in-progress workout instead if there already is one
    const { workout } = await $fetch('/api/workouts', { method: 'POST' })
    await navigateTo(`/workouts/${workout.id}`)
  } catch (error) {
    startError.value = getApiErrorMessage(error)
    starting.value = false
  }
}
</script>

<template>
  <section>
    <div
      v-if="activeWorkout"
      class="rounded-2xl border border-brand-500/40 bg-brand-500/10 p-6"
    >
      <p class="text-sm font-medium text-brand-600">Workout in progress</p>
      <p class="mt-1 text-4xl font-bold tracking-tight">
        <WorkoutTimer :started-at="activeWorkout.startedAt" />
      </p>
      <NuxtLink :to="`/workouts/${activeWorkout.id}`" class="btn-primary mt-5 w-full sm:w-auto">
        Resume workout
      </NuxtLink>
    </div>

    <div v-else class="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h1 class="text-2xl font-bold tracking-tight">Ready to train?</h1>
      <p class="mt-1 text-sm text-zinc-500">Start a session and log your sets as you go.</p>
      <button type="button" class="btn-primary mt-5 w-full py-3 text-base sm:w-auto" :disabled="starting" @click="startWorkout">
        {{ starting ? 'Starting…' : 'Start workout' }}
      </button>
      <p v-if="startError" role="alert" class="alert-error mt-4">{{ startError }}</p>
    </div>

    <template v-if="recentWorkouts.length">
      <div class="mt-8 flex items-baseline justify-between">
        <h2 class="text-sm font-semibold">Recent workouts</h2>
        <NuxtLink to="/history" class="link text-sm">See all</NuxtLink>
      </div>
      <ul class="mt-3 space-y-3">
        <li v-for="workout in recentWorkouts" :key="workout.id">
          <WorkoutCard :workout="workout" />
        </li>
      </ul>
    </template>
  </section>
</template>
