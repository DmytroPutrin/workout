<script setup lang="ts">
const props = defineProps<{ workout: WorkoutListItem }>()

const duration = computed(() =>
  props.workout.finishedAt
    ? formatDuration(new Date(props.workout.finishedAt).getTime() - new Date(props.workout.startedAt).getTime())
    : null,
)

// "Bench Press, Back Squat, Deadlift +2"
const exerciseSummary = computed(() => {
  const names = props.workout.exercises
  return names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3}` : names.join(', ')
})
</script>

<template>
  <NuxtLink
    :to="`/workouts/${workout.id}`"
    class="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-brand-500/50 dark:border-zinc-800 dark:bg-zinc-900"
  >
    <div class="flex items-baseline justify-between gap-3">
      <p class="font-semibold">
        <NuxtTime :datetime="workout.startedAt" weekday="short" day="numeric" month="short" />
      </p>
      <p class="text-xs text-zinc-500">
        <NuxtTime :datetime="workout.startedAt" hour="2-digit" minute="2-digit" />
        <template v-if="duration"> · {{ duration }}</template>
      </p>
    </div>
    <p v-if="exerciseSummary" class="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-400">{{ exerciseSummary }}</p>
    <p class="mt-2 text-xs text-zinc-500 tabular-nums">
      {{ workout.exerciseCount }} {{ workout.exerciseCount === 1 ? 'exercise' : 'exercises' }} ·
      {{ workout.setCount }} {{ workout.setCount === 1 ? 'set' : 'sets' }} ·
      {{ formatNumber(workout.volumeKg) }} kg volume
    </p>
  </NuxtLink>
</template>
