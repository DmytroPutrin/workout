<script setup lang="ts">
const props = defineProps<{ group: ExerciseGroup }>()

// Provided by pages/workouts/[id].vue
const session = inject(workoutKey)!

// What you did last time for this exercise. Lazy: the card renders straight away
// and the hint appears when it arrives.
const { data: lastTime } = useFetch(() => `/api/exercises/${props.group.exerciseId}/last`, { lazy: true })

// ---- Adding a set -----------------------------------------------------------
// '' while the input is empty: v-model.number leaves non-numbers as the raw string
const form = reactive<{ weightKg: number | ''; reps: number | '' }>({ weightKg: '', reps: '' })
const formError = ref('')
const adding = ref(false)

// Pre-fill with your previous set in this workout, or your first set last time.
// Only while the inputs are empty, so this never overwrites what you've typed.
function prefill() {
  if (form.weightKg !== '' || form.reps !== '') return
  const source = props.group.sets.at(-1) ?? lastTime.value?.last?.sets[0]
  if (source) {
    form.weightKg = source.weightKg
    form.reps = source.reps
  }
}
watch(lastTime, prefill, { immediate: true })

async function addSet() {
  formError.value = ''
  const parsed = addSetSchema.safeParse({ exerciseId: props.group.exerciseId, ...form })
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message ?? 'Check the values'
    return
  }

  adding.value = true
  try {
    // The inputs keep their values: the next set is usually the same weight and reps
    await session.addSet(parsed.data)
  } catch (error) {
    formError.value = getApiErrorMessage(error)
  } finally {
    adding.value = false
  }
}

// ---- Editing and deleting sets ----------------------------------------------
const editingId = ref<number | null>(null)
const editForm = reactive<{ weightKg: number | ''; reps: number | '' }>({ weightKg: '', reps: '' })
const rowError = ref('')
const busyId = ref<number | null>(null)

function startEdit(set: WorkoutSetRow) {
  editingId.value = set.id
  editForm.weightKg = set.weightKg
  editForm.reps = set.reps
  rowError.value = ''
}

function cancelEdit() {
  editingId.value = null
  rowError.value = ''
}

async function saveEdit(setId: number) {
  const parsed = updateSetSchema.safeParse({ ...editForm })
  if (!parsed.success) {
    rowError.value = parsed.error.issues[0]?.message ?? 'Check the values'
    return
  }
  busyId.value = setId
  try {
    await session.updateSet(setId, parsed.data)
    cancelEdit()
  } catch (error) {
    rowError.value = getApiErrorMessage(error)
  } finally {
    busyId.value = null
  }
}

async function removeSet(setId: number) {
  rowError.value = ''
  busyId.value = setId
  try {
    await session.deleteSet(setId)
  } catch (error) {
    rowError.value = getApiErrorMessage(error)
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <article class="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
    <header class="flex items-start justify-between gap-3">
      <div>
        <h2 class="font-semibold">{{ group.exerciseName }}</h2>
        <p class="text-xs text-zinc-500">{{ MUSCLE_GROUP_LABELS[group.muscleGroup] }}</p>
      </div>
      <button
        v-if="group.sets.length === 0"
        type="button"
        class="text-xs text-zinc-500 hover:text-red-600"
        @click="session.removePendingExercise(group.exerciseId)"
      >
        Remove
      </button>
    </header>

    <p v-if="lastTime?.last" class="mt-2 text-xs text-zinc-500">
      Last time: {{ lastTime.last.sets.map(formatSet).join(' · ') }}
    </p>

    <!-- Logged sets -->
    <ol v-if="group.sets.length" class="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
      <li v-for="(set, index) in group.sets" :key="set.id" class="flex items-center gap-3 py-2 text-sm">
        <span class="w-6 text-xs font-medium text-zinc-400 tabular-nums">{{ index + 1 }}</span>

        <template v-if="editingId === set.id">
          <form class="flex flex-1 items-center gap-2" novalidate @submit.prevent="saveEdit(set.id)">
            <input
              v-model.number="editForm.weightKg"
              type="number"
              inputmode="decimal"
              step="0.5"
              min="0"
              class="input w-20 py-1"
              aria-label="Weight in kg"
            />
            <span class="text-zinc-400">×</span>
            <input
              v-model.number="editForm.reps"
              type="number"
              inputmode="numeric"
              step="1"
              min="1"
              class="input w-16 py-1"
              aria-label="Reps"
            />
            <button type="submit" class="link ml-auto text-xs" :disabled="busyId === set.id">Save</button>
            <button type="button" class="text-xs text-zinc-500" @click="cancelEdit">Cancel</button>
          </form>
        </template>

        <template v-else>
          <span class="flex-1 tabular-nums">{{ formatSet(set) }}</span>
          <template v-if="session.isActive.value">
            <button type="button" class="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" @click="startEdit(set)">
              Edit
            </button>
            <button
              type="button"
              class="text-xs text-zinc-500 hover:text-red-600"
              :disabled="busyId === set.id"
              :aria-label="`Delete set ${index + 1}`"
              @click="removeSet(set.id)"
            >
              Delete
            </button>
          </template>
        </template>
      </li>
    </ol>
    <p v-if="rowError" role="alert" class="field-error">{{ rowError }}</p>

    <!-- Add a set -->
    <form class="mt-3 flex items-end gap-2" novalidate @submit.prevent="addSet">
      <label class="flex-1">
        <span class="mb-1 block text-xs text-zinc-500">Weight (kg)</span>
        <input v-model.number="form.weightKg" type="number" inputmode="decimal" step="0.5" min="0" class="input" placeholder="0" />
      </label>
      <label class="flex-1">
        <span class="mb-1 block text-xs text-zinc-500">Reps</span>
        <input v-model.number="form.reps" type="number" inputmode="numeric" step="1" min="1" class="input" placeholder="8" />
      </label>
      <button type="submit" class="btn-primary shrink-0" :disabled="adding">
        {{ adding ? 'Adding…' : 'Add set' }}
      </button>
    </form>
    <p v-if="formError" role="alert" class="field-error">{{ formError }}</p>
  </article>
</template>
