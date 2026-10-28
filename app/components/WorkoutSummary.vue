<script setup lang="ts">
const props = defineProps<{
  workout: WorkoutDetail['workout']
  groups: ExerciseGroup[]
}>()

const allSets = computed(() => props.groups.flatMap((group) => group.sets))

const stats = computed(() => [
  {
    label: 'Duration',
    value: props.workout.finishedAt
      ? formatDuration(new Date(props.workout.finishedAt).getTime() - new Date(props.workout.startedAt).getTime())
      : '–',
  },
  { label: 'Exercises', value: String(props.groups.length) },
  { label: 'Sets', value: String(allSets.value.length) },
  { label: 'Volume', value: `${formatNumber(totalVolume(allSets.value))} kg` },
])

/** Heaviest set; on a tie, the one with more reps. */
function bestSetId(sets: WorkoutSetRow[]) {
  let best: WorkoutSetRow | undefined
  for (const set of sets) {
    if (!best || set.weightKg > best.weightKg || (set.weightKg === best.weightKg && set.reps > best.reps)) {
      best = set
    }
  }
  return best?.id
}
</script>

<template>
  <section>
    <p class="text-sm font-medium text-brand-600">Workout complete</p>
    <h1 class="mt-1 text-2xl font-bold tracking-tight">
      <NuxtTime :datetime="workout.startedAt" weekday="long" day="numeric" month="long" />
    </h1>
    <p class="mt-1 text-sm text-zinc-500">
      Started at <NuxtTime :datetime="workout.startedAt" hour="2-digit" minute="2-digit" />
    </p>

    <dl class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <dt class="text-xs text-zinc-500">{{ stat.label }}</dt>
        <dd class="mt-1 text-lg font-semibold tabular-nums">{{ stat.value }}</dd>
      </div>
    </dl>

    <div class="mt-6 space-y-3">
      <article
        v-for="group in groups"
        :key="group.exerciseId"
        class="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 class="font-semibold">{{ group.exerciseName }}</h2>
        <ol class="mt-2 flex flex-wrap gap-2">
          <li
            v-for="set in group.sets"
            :key="set.id"
            class="rounded-md px-2 py-1 text-sm tabular-nums"
            :class="
              set.id === bestSetId(group.sets) && group.sets.length > 1
                ? 'bg-brand-500/15 font-medium text-brand-600'
                : 'bg-zinc-100 dark:bg-zinc-800'
            "
          >
            {{ formatSet(set) }}
          </li>
        </ol>
      </article>
    </div>

    <div v-if="workout.notes" class="mt-6">
      <h2 class="text-sm font-semibold">Notes</h2>
      <p class="mt-1 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">{{ workout.notes }}</p>
    </div>
  </section>
</template>
