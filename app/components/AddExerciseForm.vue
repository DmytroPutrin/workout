<script setup lang="ts">
import { z } from 'zod'
import type { MuscleGroup } from '#shared/utils/muscle-groups'

const emit = defineEmits<{ created: [] }>()

const form = reactive<{ name: string; muscleGroup: MuscleGroup | '' }>({ name: '', muscleGroup: '' })
const fieldErrors = ref<Record<string, string>>({})
const formError = ref('')
const submitting = ref(false)

async function onSubmit() {
  formError.value = ''
  fieldErrors.value = {}

  const parsed = createExerciseSchema.safeParse(form)
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>
    fieldErrors.value = Object.fromEntries(
      Object.entries(flat).map(([field, messages]) => [field, messages?.[0] ?? '']),
    )
    return
  }

  submitting.value = true
  try {
    await $fetch('/api/exercises', { method: 'POST', body: parsed.data })
    form.name = ''
    form.muscleGroup = ''
    emit('created')
  } catch (error) {
    fieldErrors.value = getApiFieldErrors(error)
    formError.value = getApiErrorMessage(error)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form
    class="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    novalidate
    @submit.prevent="onSubmit"
  >
    <h2 class="text-sm font-semibold">Add a custom exercise</h2>

    <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
      <div class="flex-1">
        <label for="exercise-name" class="sr-only">Exercise name</label>
        <input
          id="exercise-name"
          v-model="form.name"
          class="input"
          placeholder="e.g. Bulgarian Split Squat"
          :aria-invalid="!!fieldErrors.name"
        />
        <p v-if="fieldErrors.name" class="field-error">{{ fieldErrors.name }}</p>
      </div>

      <div class="sm:w-44">
        <label for="exercise-group" class="sr-only">Muscle group</label>
        <select id="exercise-group" v-model="form.muscleGroup" class="input" :aria-invalid="!!fieldErrors.muscleGroup">
          <option value="" disabled>Muscle group</option>
          <option v-for="group in MUSCLE_GROUPS" :key="group" :value="group">
            {{ MUSCLE_GROUP_LABELS[group] }}
          </option>
        </select>
        <p v-if="fieldErrors.muscleGroup" class="field-error">{{ fieldErrors.muscleGroup }}</p>
      </div>

      <button type="submit" class="btn-primary" :disabled="submitting">
        {{ submitting ? 'Adding…' : 'Add' }}
      </button>
    </div>

    <p v-if="formError && !Object.keys(fieldErrors).length" role="alert" class="alert-error mt-3">
      {{ formError }}
    </p>
  </form>
</template>
