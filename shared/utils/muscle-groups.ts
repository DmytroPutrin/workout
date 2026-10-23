// Lives in shared/ so both the Vue app and the server can import it.
// Nuxt auto-imports everything in shared/utils.
export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'full_body',
] as const

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  legs: 'Legs',
  shoulders: 'Shoulders',
  arms: 'Arms',
  core: 'Core',
  full_body: 'Full body',
}
