// Plain string formatting on purpose (no toLocaleString): the server and the browser
// can have different locales, and "62.5" on the server vs "62,5" in the browser would
// cause a hydration mismatch. Dates and times use <NuxtTime>, which handles this for us.

/** 62.5 -> "62.5", 60 -> "60". Weights are stored with at most 2 decimals. */
export function formatNumber(value: number) {
  return String(Math.round(value * 100) / 100)
}

/** 0 kg is how bodyweight exercises are logged. */
export function formatWeight(kg: number) {
  return kg === 0 ? 'BW' : `${formatNumber(kg)} kg`
}

export function formatSet(set: { reps: number; weightKg: number }) {
  return `${formatWeight(set.weightKg)} × ${set.reps}`
}

/** Stopwatch style: "4:05", "42:13", "1:02:03". */
export function formatClock(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

/** Summary style: "42 min", "1 h 05 min". */
export function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours} h ${String(minutes).padStart(2, '0')} min` : `${minutes} min`
}

/** Total weight moved: sum of reps × weight. */
export function totalVolume(sets: { reps: number; weightKg: number }[]) {
  return sets.reduce((sum, set) => sum + set.reps * set.weightKg, 0)
}
