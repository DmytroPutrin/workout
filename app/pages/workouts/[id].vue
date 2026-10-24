<script setup lang="ts">
const route = useRoute()
const session = await useWorkout(Number(route.params.id))
provide(workoutKey, session)

const { workout, sets, groups, isActive } = session

useHead({ title: () => (isActive.value ? 'Workout in progress' : 'Workout summary') + ' · Workout Tracker' })

const picker = useTemplateRef('picker')
const addedIds = computed(() => groups.value.map((group) => group.exerciseId))

// ---- Notes: saved when the textarea loses focus ------------------------------
const notes = ref(workout.value.notes ?? '')
const notesState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')

async function saveNotes() {
  if (notes.value.trim() === (workout.value.notes ?? '')) return
  notesState.value = 'saving'
  try {
    await session.saveNotes(notes.value)
    notesState.value = 'saved'
  } catch {
    notesState.value = 'error'
  }
}

// ---- Finish / discard ---------------------------------------------------------
const actionError = ref('')
const finishing = ref(false)
const confirmingDiscard = ref(false)
const discarding = ref(false)

async function finish() {
  actionError.value = ''
  finishing.value = true
  try {
    await saveNotes()
    await session.finish()
    // The page now renders the summary instead of the logger
    window.scrollTo({ top: 0 })
  } catch (error) {
    actionError.value = getApiErrorMessage(error)
  } finally {
    finishing.value = false
  }
}

// Two-step button instead of window.confirm(): the first tap arms it, the second discards
async function discard() {
  if (!confirmingDiscard.value) {
    confirmingDiscard.value = true
    setTimeout(() => (confirmingDiscard.value = false), 4000)
    return
  }
  actionError.value = ''
  discarding.value = true
  try {
    await session.discard()
  } catch (error) {
    actionError.value = getApiErrorMessage(error)
    discarding.value = false
  }
}
</script>

<template>
  <WorkoutSummary v-if="!isActive" :workout="workout" :groups="groups" />

  <section v-else>
    <div class="flex items-end justify-between gap-4">
      <div>
        <p class="text-sm font-medium text-brand-600">Workout in progress</p>
        <h1 class="mt-1 text-3xl font-bold tracking-tight">
          <WorkoutTimer :started-at="workout.startedAt" />
        </h1>
      </div>
      <p class="text-right text-sm text-zinc-500">
        Started <NuxtTime :datetime="workout.startedAt" hour="2-digit" minute="2-digit" /><br />
        {{ sets.length }} {{ sets.length === 1 ? 'set' : 'sets' }}
      </p>
    </div>

    <div class="mt-6 space-y-4">
      <ExerciseSetsCard v-for="group in groups" :key="group.exerciseId" :group="group" />

      <p
        v-if="groups.length === 0"
        class="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700"
      >
        Add your first exercise to start logging sets.
      </p>

      <button
        type="button"
        class="w-full rounded-xl border-2 border-dashed border-brand-500/50 py-3 text-sm font-medium text-brand-600 hover:bg-brand-500/10"
        @click="picker?.open()"
      >
        + Add exercise
      </button>
    </div>

    <div class="mt-8">
      <label for="notes" class="flex items-baseline justify-between text-sm font-medium">
        Notes
        <span class="text-xs font-normal text-zinc-500" aria-live="polite">
          {{ { idle: '', saving: 'Saving…', saved: 'Saved', error: "Couldn't save" }[notesState] }}
        </span>
      </label>
      <textarea
        id="notes"
        v-model="notes"
        rows="3"
        maxlength="2000"
        class="input mt-1.5"
        placeholder="How did it feel? Anything to remember next time?"
        @blur="saveNotes"
      />
    </div>

    <p v-if="actionError" role="alert" class="alert-error mt-6">{{ actionError }}</p>

    <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
      <button
        type="button"
        class="btn-secondary"
        :class="confirmingDiscard && 'border-red-500 text-red-600'"
        :disabled="discarding"
        @click="discard"
      >
        {{ discarding ? 'Discarding…' : confirmingDiscard ? 'Tap again to discard' : 'Discard workout' }}
      </button>
      <button type="button" class="btn-primary" :disabled="finishing || sets.length === 0" @click="finish">
        {{ finishing ? 'Finishing…' : 'Finish workout' }}
      </button>
    </div>

    <ExercisePicker ref="picker" :added-ids="addedIds" @select="session.addExercise" />
  </section>
</template>
