<script setup lang="ts">
import type { MuscleGroup } from '#shared/utils/muscle-groups'

// useFetch infers the response type straight from server/api/exercises.get.ts,
// so `exercises` is fully typed without writing an interface by hand.
// During SSR it also forwards the session cookie, so the API knows who's asking.
const { data: exercises, status, error, refresh } = await useFetch('/api/exercises')

type ListItem = { id: number; name: string; isCustom: boolean }

const groups = computed(() => {
  const byGroup = new Map<MuscleGroup, ListItem[]>()
  for (const { id, name, isCustom, muscleGroup } of exercises.value ?? []) {
    const list = byGroup.get(muscleGroup) ?? []
    list.push({ id, name, isCustom })
    byGroup.set(muscleGroup, list)
  }
  // Keep the order defined in MUSCLE_GROUPS rather than alphabetical
  return MUSCLE_GROUPS.filter((group) => byGroup.has(group)).map((group) => ({
    key: group,
    label: MUSCLE_GROUP_LABELS[group],
    exercises: byGroup.get(group)!,
  }))
})

const customCount = computed(() => exercises.value?.filter((e) => e.isCustom).length ?? 0)
</script>

<template>
  <section>
    <h1 class="text-2xl font-bold tracking-tight">Exercise library</h1>
    <p class="mt-1 text-sm text-zinc-500">
      {{ exercises?.length ?? 0 }} exercises<template v-if="customCount">, {{ customCount }} of them yours</template>.
    </p>

    <AddExerciseForm class="mt-6" @created="refresh()" />

    <div v-if="status === 'pending' && !exercises" class="mt-8 text-zinc-500">Loading…</div>

    <div v-else-if="error" class="alert-error mt-8">
      <p class="font-medium">Couldn't load exercises.</p>
      <button class="mt-2 underline" @click="refresh()">Try again</button>
    </div>

    <p v-else-if="groups.length === 0" class="mt-8 text-zinc-500">
      The library is empty. Run <code>npm run db:seed</code> to add the built-in exercises.
    </p>

    <div v-else class="mt-6 grid gap-4 sm:grid-cols-2">
      <article
        v-for="group in groups"
        :key="group.key"
        class="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 class="text-xs font-semibold uppercase tracking-wider text-brand-600">
          {{ group.label }}
        </h2>
        <ul class="mt-3 space-y-1.5">
          <li v-for="exercise in group.exercises" :key="exercise.id" class="flex items-center gap-2 text-sm">
            {{ exercise.name }}
            <span
              v-if="exercise.isCustom"
              class="rounded-full bg-brand-500/15 px-2 py-0.5 text-[11px] font-medium text-brand-600"
            >
              Custom
            </span>
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>
