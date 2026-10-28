<script setup lang="ts">
// A small dependency-free SVG line chart.
//  - x is proportional to time, so a two-week gap looks like a gap
//  - hover or drag (touch) shows the nearest point in a tooltip
//  - the data is also rendered as a visually hidden table for screen readers
//
// It renders only in the browser: it needs its real pixel width (ResizeObserver),
// and dates are formatted in the viewer's locale and time zone, which the
// server can't know. The server renders a placeholder of the same height.

type ChartPoint = { id: number; date: string; value: number }

const props = defineProps<{
  points: ChartPoint[]
  unit: string
  label: string
  highlightId?: number | null
}>()

const HEIGHT = 240
const MARGIN = { top: 16, right: 16, bottom: 28, left: 48 }

const container = useTemplateRef<HTMLDivElement>('container')
const width = ref(0)
let observer: ResizeObserver | undefined

onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry) width.value = entry.contentRect.width
  })
  if (container.value) observer.observe(container.value)
})
onBeforeUnmount(() => observer?.disconnect())

const innerWidth = computed(() => Math.max(0, width.value - MARGIN.left - MARGIN.right))
const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom
const bottom = MARGIN.top + innerHeight

// ---- Scales -------------------------------------------------------------------

/** Rounds a raw step to 1, 2, 2.5 or 5 × 10ⁿ so axis labels are readable numbers. */
function niceStep(raw: number) {
  const power = 10 ** Math.floor(Math.log10(raw))
  const n = raw / power
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * power
}

const yScale = computed(() => {
  const values = props.points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  // A flat line still needs some vertical room
  const span = max - min || Math.abs(max) * 0.2 || 1
  const step = niceStep(span / 4)
  // Not starting at 0 on purpose: progress on a 100 kg lift is a few kg,
  // which would be invisible on a 0–100 axis
  const lo = Math.max(0, Math.floor((min - span * 0.1) / step) * step)
  const hi = Math.max(lo + step, Math.ceil((max + span * 0.1) / step) * step)
  const ticks: number[] = []
  for (let tick = lo; tick <= hi + step / 2; tick += step) ticks.push(Math.round(tick * 100) / 100)
  return { lo, hi, ticks }
})

const yOf = (value: number) => {
  const { lo, hi } = yScale.value
  return bottom - ((value - lo) / (hi - lo)) * innerHeight
}

const coords = computed(() => {
  const times = props.points.map((p) => new Date(p.date).getTime())
  const first = Math.min(...times)
  const last = Math.max(...times)
  return props.points.map((point, i) => ({
    ...point,
    x: MARGIN.left + (last === first ? innerWidth.value / 2 : ((times[i]! - first) / (last - first)) * innerWidth.value),
    y: yOf(point.value),
  }))
})

const linePath = computed(() => coords.value.map((c, i) => `${i ? 'L' : 'M'}${c.x},${c.y}`).join(' '))

const areaPath = computed(() => {
  const first = coords.value[0]
  const last = coords.value.at(-1)
  if (!first || !last || coords.value.length < 2) return ''
  return `${linePath.value} L${last.x},${bottom} L${first.x},${bottom} Z`
})

// ---- Labels -------------------------------------------------------------------

const spanDays = computed(() => {
  const times = props.points.map((p) => new Date(p.date).getTime())
  return (Math.max(...times) - Math.min(...times)) / 86_400_000
})

const axisDate = computed(
  () =>
    new Intl.DateTimeFormat(
      undefined,
      spanDays.value > 300 ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' },
    ),
)
const fullDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

/**
 * Date labels that don't collide. Points can be close together in time (two
 * workouts in three days), so labels are chosen by pixel distance, not by index:
 * walk left to right and keep a label only if it is far enough from the last one.
 * The newest date is always shown, replacing its neighbour if they're too close.
 */
const MIN_LABEL_GAP = 64
const xLabels = computed(() => {
  const all = coords.value
  const kept: typeof all = []
  for (const point of all) {
    const previous = kept.at(-1)
    if (!previous || point.x - previous.x >= MIN_LABEL_GAP) kept.push(point)
  }
  const newest = all.at(-1)
  if (newest && kept.at(-1) !== newest) {
    if (kept.length > 1 && newest.x - kept.at(-1)!.x < MIN_LABEL_GAP) kept.pop()
    kept.push(newest)
  }
  return kept.map((point, position) => ({
    key: point.id,
    x: point.x,
    text: axisDate.value.format(new Date(point.date)),
    anchor: kept.length === 1 ? 'middle' : position === 0 ? 'start' : position === kept.length - 1 ? 'end' : 'middle',
  }))
})

const formatValue = (value: number) => `${formatNumber(value)} ${props.unit}`

// ---- Interaction ----------------------------------------------------------------

const activeIndex = ref<number | null>(null)
const active = computed(() => (activeIndex.value === null ? null : (coords.value[activeIndex.value] ?? null)))

function onPointer(event: PointerEvent) {
  const x = event.clientX - (event.currentTarget as SVGSVGElement).getBoundingClientRect().left
  let nearest = 0
  coords.value.forEach((c, i) => {
    if (Math.abs(c.x - x) < Math.abs(coords.value[nearest]!.x - x)) nearest = i
  })
  activeIndex.value = nearest
}

// Keep the tooltip inside the chart near the edges
const tooltipLeft = computed(() => (active.value ? Math.min(Math.max(active.value.x, 70), width.value - 70) : 0))
</script>

<template>
  <div ref="container" class="relative" :style="{ height: `${HEIGHT}px` }">
    <svg
      v-if="width > 0 && points.length"
      :width="width"
      :height="HEIGHT"
      role="img"
      :aria-label="label"
      class="block touch-pan-y select-none"
      @pointermove="onPointer"
      @pointerdown="onPointer"
      @pointerleave="activeIndex = null"
    >
      <!-- Horizontal grid lines and y-axis values -->
      <g v-for="tick in yScale.ticks" :key="tick">
        <line :x1="MARGIN.left" :x2="width - MARGIN.right" :y1="yOf(tick)" :y2="yOf(tick)" class="stroke-zinc-200 dark:stroke-zinc-800" />
        <text :x="MARGIN.left - 8" :y="yOf(tick)" text-anchor="end" dominant-baseline="middle" class="fill-zinc-400 text-[11px]">
          {{ formatNumber(tick) }}
        </text>
      </g>

      <path v-if="areaPath" :d="areaPath" class="fill-brand-500/10" />
      <path :d="linePath" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" class="stroke-brand-600" />

      <line v-if="active" :x1="active.x" :x2="active.x" :y1="MARGIN.top" :y2="bottom" class="stroke-zinc-300 dark:stroke-zinc-600" stroke-dasharray="3 3" />

      <circle
        v-for="(c, i) in coords"
        :key="c.id"
        :cx="c.x"
        :cy="c.y"
        :r="c.id === highlightId || i === activeIndex ? 5 : 3.5"
        stroke-width="2"
        :class="
          c.id === highlightId
            ? 'fill-brand-600 stroke-white dark:stroke-zinc-900'
            : 'fill-white stroke-brand-600 dark:fill-zinc-900'
        "
      />

      <text
        v-for="xLabel in xLabels"
        :key="xLabel.key"
        :x="xLabel.x"
        :y="HEIGHT - 6"
        :text-anchor="xLabel.anchor"
        class="fill-zinc-400 text-[11px]"
      >
        {{ xLabel.text }}
      </text>
    </svg>

    <div v-else class="h-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />

    <div
      v-if="active"
      class="pointer-events-none absolute rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
      :style="{ left: `${tooltipLeft}px`, top: `${active.y - 12}px`, transform: 'translate(-50%, -100%)' }"
    >
      <div class="font-semibold tabular-nums">{{ formatValue(active.value) }}</div>
      <div class="opacity-70">{{ fullDate.format(new Date(active.date)) }}</div>
    </div>

    <table v-if="width > 0" class="sr-only">
      <caption>{{ label }}</caption>
      <thead>
        <tr><th scope="col">Date</th><th scope="col">Value</th></tr>
      </thead>
      <tbody>
        <tr v-for="point in points" :key="point.id">
          <td>{{ fullDate.format(new Date(point.date)) }}</td>
          <td>{{ formatValue(point.value) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
