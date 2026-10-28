<script setup lang="ts">
useHead({ title: 'Progress · Workout Tracker' })

const route = useRoute()
const router = useRouter()

const METRICS = [
  { key: 'estimated1RmKg', label: 'Est. 1RM', unit: 'kg', hint: 'Estimated one-rep max of your best set (Epley formula)' },
  { key: 'maxWeightKg', label: 'Heaviest', unit: 'kg', hint: 'Heaviest weight lifted in the workout' },
  { key: 'volumeKg', label: 'Volume', unit: 'kg', hint: 'Sets × reps × weight, added up' },
  { key: 'totalReps', label: 'Reps', unit: 'reps', hint: 'Total reps in the workout' },
] as const
type MetricKey = (typeof METRICS)[number]['key']

// Exercises you have history for
const { data: exercises } = await useFetch('/api/progress')

// The selected exercise lives in the URL (?exercise=12), so the back button,
// reloads and shared links all keep it
const selectedId = computed(() => {
  const fromUrl = Number(route.query.exercise)
  const list = exercises.value ?? []
  return list.some((e) => e.id === fromUrl) ? fromUrl : (list[0]?.id ?? null)
})

function selectExercise(event: Event) {
  router.replace({ query: { ...route.query, exercise: (event.target as HTMLSelectElement).value } })
}

// Re-fetches automatically whenever selectedId changes (the URL getter is reactive)
const { data: progress, status } = await useFetch(() => `/api/progress/${selectedId.value}`, {
  immediate: selectedId.value !== null,
})

// Each time an exercise loads, start from the metric that suits it:
// bodyweight exercises (always 0 kg) have no weight to chart, so show reps
const metric = ref<MetricKey>('estimated1RmKg')
watch(
  progress,
  (value) => {
    if (!value) return
    const isBodyweight = value.points.every((p) => p.maxWeightKg === 0)
    metric.value = isBodyweight ? 'totalReps' : 'estimated1RmKg'
  },
  { immediate: true },
)

const metricInfo = computed(() => METRICS.find((m) => m.key === metric.value)!)

const chartPoints = computed(() =>
  (progress.value?.points ?? []).map((p) => ({ id: p.workoutId, date: p.date, value: p[metric.value] })),
)

const record = computed(() => progress.value?.records[metric.value] ?? null)

// Change between the first and the latest workout, e.g. "+12.5 kg"
const change = computed(() => {
  const points = chartPoints.value
  if (points.length < 2) return null
  const diff = points.at(-1)!.value - points[0]!.value
  return { text: `${diff > 0 ? '+' : ''}${formatNumber(diff)} ${metricInfo.value.unit}`, positive: diff > 0, since: points[0]!.date }
})

const recentSessions = computed(() => [...(progress.value?.points ?? [])].reverse().slice(0, 5))
</script>

<template>
  <section>
    <h1 class="text-2xl font-bold tracking-tight">Progress</h1>

    <div
      v-if="!exercises?.length"
      class="mt-6 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700"
    >
      Your progress shows up here once you've finished a workout.
      <NuxtLink to="/" class="link">Start one</NuxtLink>
    </div>

    <template v-else>
      <label for="progress-exercise" class="sr-only">Exercise</label>
      <select id="progress-exercise" class="input mt-4" :value="selectedId ?? undefined" @change="selectExercise">
        <option v-for="exercise in exercises" :key="exercise.id" :value="exercise.id">
          {{ exercise.name }} ({{ exercise.sessions }})
        </option>
      </select>

      <!-- Metric switcher -->
      <div role="group" aria-label="Metric" class="mt-4 grid grid-cols-4 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        <button
          v-for="m in METRICS"
          :key="m.key"
          type="button"
          :aria-pressed="metric === m.key"
          :title="m.hint"
          class="rounded-md px-2 py-1.5 text-xs font-medium sm:text-sm"
          :class="metric === m.key ? 'bg-white shadow-sm dark:bg-zinc-900' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'"
          @click="metric = m.key"
        >
          {{ m.label }}
        </button>
      </div>

      <div class="mt-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs text-zinc-500">{{ metricInfo.hint }}</p>
            <p v-if="record" class="mt-1 text-2xl font-bold tabular-nums">
              {{ formatNumber(record.value) }} <span class="text-base font-medium text-zinc-500">{{ metricInfo.unit }}</span>
            </p>
            <p v-if="record" class="text-xs text-zinc-500">
              Best · <NuxtTime :datetime="record.date" day="numeric" month="short" year="numeric" />
            </p>
          </div>
          <p
            v-if="change"
            class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
            :class="change.positive ? 'bg-brand-500/15 text-brand-600' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'"
          >
            {{ change.text }}
          </p>
        </div>

        <div class="mt-4">
          <div v-if="status === 'pending' && !progress" class="h-60 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <LineChart
            v-else-if="chartPoints.length"
            :points="chartPoints"
            :unit="metricInfo.unit"
            :highlight-id="record?.workoutId"
            :label="`${progress?.exercise.name}: ${metricInfo.label} per workout`"
          />
        </div>
        <p v-if="chartPoints.length === 1" class="mt-2 text-center text-xs text-zinc-500">
          Log this exercise in another workout to see a trend.
        </p>
      </div>

      <h2 class="mt-8 text-sm font-semibold">Recent sessions</h2>
      <ul class="mt-2 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        <li v-for="session in recentSessions" :key="session.workoutId">
          <NuxtLink :to="`/workouts/${session.workoutId}`" class="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
            <NuxtTime :datetime="session.date" weekday="short" day="numeric" month="short" />
            <span class="text-zinc-500 tabular-nums">
              {{ session.sets }} {{ session.sets === 1 ? 'set' : 'sets' }} · best {{ formatWeight(session.maxWeightKg) }}
              <template v-if="session.maxWeightKg > 0"> · e1RM {{ formatNumber(session.estimated1RmKg) }} kg</template>
            </span>
          </NuxtLink>
        </li>
      </ul>
    </template>
  </section>
</template>
