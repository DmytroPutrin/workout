<script setup lang="ts">
useHead({ title: 'History · Workout Tracker' })

const PAGE_SIZE = 20

// First page is rendered on the server; "Load more" fetches the next pages in the browser
const { data: firstPage, error } = await useFetch('/api/workouts', { query: { limit: PAGE_SIZE } })

const items = ref<WorkoutListItem[]>(firstPage.value?.items ?? [])
const nextCursor = ref<string | null>(firstPage.value?.nextCursor ?? null)
const loadingMore = ref(false)
const loadError = ref('')

async function loadMore() {
  if (!nextCursor.value) return
  loadingMore.value = true
  loadError.value = ''
  try {
    const page = await $fetch('/api/workouts', { query: { limit: PAGE_SIZE, cursor: nextCursor.value } })
    items.value = [...items.value, ...page.items]
    nextCursor.value = page.nextCursor
  } catch (err) {
    loadError.value = getApiErrorMessage(err)
  } finally {
    loadingMore.value = false
  }
}
</script>

<template>
  <section>
    <h1 class="text-2xl font-bold tracking-tight">History</h1>

    <p v-if="error" class="alert-error mt-6">Couldn't load your workouts.</p>

    <div
      v-else-if="items.length === 0"
      class="mt-6 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700"
    >
      No finished workouts yet.
      <NuxtLink to="/" class="link">Start one</NuxtLink> and it will show up here.
    </div>

    <template v-else>
      <ul class="mt-6 space-y-3">
        <li v-for="workout in items" :key="workout.id">
          <WorkoutCard :workout="workout" />
        </li>
      </ul>

      <p v-if="loadError" role="alert" class="alert-error mt-4">{{ loadError }}</p>

      <button v-if="nextCursor" type="button" class="btn-secondary mt-6 w-full" :disabled="loadingMore" @click="loadMore">
        {{ loadingMore ? 'Loading…' : 'Load more' }}
      </button>
    </template>
  </section>
</template>
