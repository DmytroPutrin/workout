import type { InjectionKey } from 'vue'
import type { InternalApi } from 'nitropack'
import type { MuscleGroup } from '#shared/utils/muscle-groups'

// Response types come straight from the server route files, so if an API response
// changes shape, TypeScript flags every place in the UI that needs updating.
export type WorkoutDetail = InternalApi['/api/workouts/:id']['get']
export type WorkoutSetRow = WorkoutDetail['sets'][number]

export type ExerciseRef = { id: number; name: string; muscleGroup: MuscleGroup }

export type ExerciseGroup = {
  exerciseId: number
  exerciseName: string
  muscleGroup: MuscleGroup
  sets: WorkoutSetRow[]
}

/**
 * All state and actions for one workout page.
 *
 * This plays the role a Pinia store would: components read from it and call its
 * actions. Its state only lives as long as the page, and it is shared with child
 * components through provide/inject (see `workoutKey`).
 *
 * Every action calls the API first and updates local state only after the server
 * confirms. If a request fails, the action throws and the UI stays correct.
 */
export async function useWorkout(workoutId: number) {
  const { data, error } = await useFetch(`/api/workouts/${workoutId}`)

  if (error.value || !data.value) {
    throw createError({
      statusCode: error.value?.statusCode ?? 500,
      statusMessage: getApiErrorMessage(error.value, 'Could not load this workout'),
      fatal: true,
    })
  }

  // Exercises picked in the UI that have no sets yet. They only exist in the browser
  // until their first set is logged.
  const pendingExercises = ref<ExerciseRef[]>([])

  const workout = computed(() => data.value!.workout)
  const sets = computed(() => data.value?.sets ?? [])
  const isActive = computed(() => !workout.value.finishedAt)

  /** Sets grouped by exercise, in the order each exercise was first logged. */
  const groups = computed<ExerciseGroup[]>(() => {
    const byExercise = new Map<number, ExerciseGroup>()
    for (const set of sets.value) {
      let group = byExercise.get(set.exerciseId)
      if (!group) {
        group = { exerciseId: set.exerciseId, exerciseName: set.exerciseName, muscleGroup: set.muscleGroup, sets: [] }
        byExercise.set(set.exerciseId, group)
      }
      group.sets.push(set)
    }
    for (const exercise of pendingExercises.value) {
      if (!byExercise.has(exercise.id)) {
        byExercise.set(exercise.id, {
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          muscleGroup: exercise.muscleGroup,
          sets: [],
        })
      }
    }
    return [...byExercise.values()]
  })

  function update(change: (current: WorkoutDetail) => WorkoutDetail) {
    if (data.value) data.value = change(data.value)
  }

  function addExercise(exercise: ExerciseRef) {
    if (groups.value.some((group) => group.exerciseId === exercise.id)) return
    pendingExercises.value = [...pendingExercises.value, exercise]
  }

  function removePendingExercise(exerciseId: number) {
    pendingExercises.value = pendingExercises.value.filter((exercise) => exercise.id !== exerciseId)
  }

  async function addSet(input: AddSetInput) {
    const set = await $fetch(`/api/workouts/${workoutId}/sets`, { method: 'POST', body: input })
    update((current) => ({ ...current, sets: [...current.sets, set] }))
    removePendingExercise(input.exerciseId)
  }

  async function updateSet(setId: number, changes: UpdateSetInput) {
    const updated = await $fetch(`/api/sets/${setId}`, { method: 'PATCH', body: changes })
    update((current) => ({
      ...current,
      sets: current.sets.map((set) => (set.id === setId ? { ...set, ...updated } : set)),
    }))
  }

  async function deleteSet(setId: number) {
    await $fetch(`/api/sets/${setId}`, { method: 'DELETE' })
    update((current) => ({ ...current, sets: current.sets.filter((set) => set.id !== setId) }))
  }

  async function saveNotes(notes: string) {
    const result = await $fetch(`/api/workouts/${workoutId}`, { method: 'PATCH', body: { notes } })
    update((current) => ({ ...current, workout: result.workout }))
  }

  async function finish() {
    const result = await $fetch(`/api/workouts/${workoutId}`, { method: 'PATCH', body: { finish: true } })
    pendingExercises.value = []
    update((current) => ({ ...current, workout: result.workout }))
  }

  async function discard() {
    await $fetch(`/api/workouts/${workoutId}`, { method: 'DELETE' })
    await navigateTo('/')
  }

  return {
    workout,
    sets,
    groups,
    isActive,
    addExercise,
    removePendingExercise,
    addSet,
    updateSet,
    deleteSet,
    saveNotes,
    finish,
    discard,
  }
}

export type WorkoutSession = Awaited<ReturnType<typeof useWorkout>>

/** provide(workoutKey, session) in the page; inject(workoutKey) in child components. */
export const workoutKey: InjectionKey<WorkoutSession> = Symbol('workout')
