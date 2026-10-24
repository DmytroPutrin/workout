<script setup lang="ts">
const props = defineProps<{ startedAt: string }>()

// null until mounted: the server renders a placeholder, and the clock starts in the
// browser. Rendering the time on the server would never match the client's first
// render a moment later, which Vue reports as a hydration mismatch.
const now = ref<number | null>(null)
let interval: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  now.value = Date.now()
  interval = setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => clearInterval(interval))

const elapsed = computed(() =>
  now.value === null ? '–:––' : formatClock(now.value - new Date(props.startedAt).getTime()),
)
</script>

<template>
  <span class="tabular-nums" role="timer">{{ elapsed }}</span>
</template>
