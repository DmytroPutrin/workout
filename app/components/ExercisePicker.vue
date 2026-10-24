<script setup lang="ts">
import type { MuscleGroup } from '#shared/utils/muscle-groups'

const props = defineProps<{ addedIds: number[] }>()
const emit = defineEmits<{ select: [exercise: ExerciseRef] }>()

// Native <dialog>: showModal() gives focus trapping, Esc to close and a ::backdrop for free.
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const search = ref('')

// Loaded the first time the picker opens, not with the page
const { data: exercises, status, error, execute } = useFetch('/api/exercises', {
  immediate: false,
  lazy: true,
})

async function open() {
  dialog.value?.showModal()
  if (!exercises.value) await execute()
}

function close() {
  dialog.value?.close()
}

function choose(exercise: ExerciseRef) {
  emit('select', exercise)
  close()
}

// A click on the dialog element itself (not its content) is a click on the backdrop
function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) close()
}

const groups = computed(() => {
  const query = search.value.trim().toLowerCase()
  const byGroup = new Map<MuscleGroup, ExerciseRef[]>()
  for (const { id, name, muscleGroup } of exercises.value ?? []) {
    if (query && !name.toLowerCase().includes(query)) continue
    byGroup.set(muscleGroup, [...(byGroup.get(muscleGroup) ?? []), { id, name, muscleGroup }])
  }
  return MUSCLE_GROUPS.filter((group) => byGroup.has(group)).map((group) => ({
    key: group,
    label: MUSCLE_GROUP_LABELS[group],
    exercises: byGroup.get(group)!,
  }))
})

defineExpose({ open })
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-black/50 dark:bg-zinc-900 dark:text-zinc-100"
    aria-labelledby="picker-title"
    @click="onDialogClick"
    @close="search = ''"
  >
    <div class="flex max-h-[80dvh] flex-col">
      <div class="flex items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 id="picker-title" class="font-semibold">Add exercise</h2>
        <button type="button" class="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" @click="close">
          Close
        </button>
      </div>

      <div class="px-4 pt-3">
        <label for="exercise-search" class="sr-only">Search exercises</label>
        <input id="exercise-search" v-model="search" type="search" class="input" placeholder="Search…" autocomplete="off" />
      </div>

      <div class="flex-1 overflow-y-auto px-4 py-3">
        <p v-if="status === 'pending'" class="py-6 text-center text-sm text-zinc-500">Loading…</p>
        <p v-else-if="error" class="alert-error">Couldn't load exercises.</p>
        <p v-else-if="groups.length === 0" class="py-6 text-center text-sm text-zinc-500">
          No exercises match “{{ search }}”.
        </p>

        <section v-for="group in groups" :key="group.key" class="mb-4 last:mb-0">
          <h3 class="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600">{{ group.label }}</h3>
          <ul>
            <li v-for="exercise in group.exercises" :key="exercise.id">
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-zinc-100 disabled:cursor-default disabled:text-zinc-400 disabled:hover:bg-transparent dark:hover:bg-zinc-800"
                :disabled="props.addedIds.includes(exercise.id)"
                @click="choose(exercise)"
              >
                {{ exercise.name }}
                <span v-if="props.addedIds.includes(exercise.id)" class="text-xs">Added</span>
              </button>
            </li>
          </ul>
        </section>
      </div>

      <p class="border-t border-zinc-200 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800">
        Missing one? Add it in your <NuxtLink to="/exercises" class="link">exercise library</NuxtLink>.
      </p>
    </div>
  </dialog>
</template>
