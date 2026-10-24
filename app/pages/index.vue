<script setup lang="ts">
useHead({ title: 'Workout Tracker' })

const { data } = await useFetch('/api/workouts/active')
const activeWorkout = computed(() => data.value?.workout ?? null)

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

    <NuxtLink
      to="/exercises"
      class="mt-4 flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 hover:border-brand-500/50 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <span>
        <span class="block font-medium">Exercise library</span>
        <span class="text-sm text-zinc-500">Browse exercises or add your own</span>
      </span>
      <span aria-hidden="true" class="text-zinc-400">→</span>
    </NuxtLink>
  </section>
</template>
