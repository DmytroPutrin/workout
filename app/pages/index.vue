<script setup lang="ts">
import type { MuscleGroup } from '#shared/utils/muscle-groups'

// useFetch infers the response type straight from server/api/exercises.get.ts,
// so `exercises` is fully typed without writing an interface by hand.
const { data: exercises, status, error, refresh } = await useFetch('/api/exercises')

const groups = computed(() => {
  const byGroup = new Map<MuscleGroup, { id: number; name: string }[]>()
  for (const exercise of exercises.value ?? []) {
    const list = byGroup.get(exercise.muscleGroup) ?? []
    list.push({ id: exercise.id, name: exercise.name })
    byGroup.set(exercise.muscleGroup, list)
  }
  // Keep the order defined in MUSCLE_GROUPS rather than alphabetical
  return MUSCLE_GROUPS.filter((group) => byGroup.has(group)).map((group) => ({
    key: group,
    label: MUSCLE_GROUP_LABELS[group],
    exercises: byGroup.get(group)!,
  }))
})
</script>

<template>
  <section>
    <h1 class="text-2xl font-bold tracking-tight">Exercise library</h1>
    <p class="mt-1 text-sm text-zinc-500">
      {{ exercises?.length ?? 0 }} built-in exercises loaded from the database.
    </p>

    <div v-if="status === 'pending'" class="mt-8 text-zinc-500">Loading…</div>

    <div
      v-else-if="error"
      class="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
    >
      <p class="font-medium">Couldn't load exercises.</p>
      <p class="mt-1">
        Did you run <code>npm run db:migrate</code> and <code>npm run db:seed</code>?
      </p>
      <button class="mt-3 underline" @click="refresh()">Try again</button>
    </div>

    <p v-else-if="groups.length === 0" class="mt-8 text-zinc-500">
      The library is empty. Run <code>npm run db:seed</code> to add the built-in exercises.
    </p>

    <div v-else class="mt-8 grid gap-4 sm:grid-cols-2">
      <article
        v-for="group in groups"
        :key="group.key"
        class="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 class="text-xs font-semibold uppercase tracking-wider text-brand-600">
          {{ group.label }}
        </h2>
        <ul class="mt-3 space-y-1.5">
          <li v-for="exercise in group.exercises" :key="exercise.id" class="text-sm">
            {{ exercise.name }}
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>
