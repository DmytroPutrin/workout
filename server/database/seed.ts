/**
 * Seeds the built-in exercise library.
 * Safe to run more than once: exercises that already exist are skipped.
 *
 *   npm run db:seed
 */
import { createClient } from '@libsql/client'
import { and, eq, isNull } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import type { MuscleGroup } from '../../shared/utils/muscle-groups'
import { exercises } from './schema'

try {
  process.loadEnvFile()
} catch {
  // no .env file: use the default URL
}

const BUILT_IN_EXERCISES: { name: string; muscleGroup: MuscleGroup }[] = [
  // Chest
  { name: 'Bench Press', muscleGroup: 'chest' },
  { name: 'Incline Dumbbell Press', muscleGroup: 'chest' },
  { name: 'Dumbbell Fly', muscleGroup: 'chest' },
  { name: 'Push-up', muscleGroup: 'chest' },
  { name: 'Dips', muscleGroup: 'chest' },
  // Back
  { name: 'Deadlift', muscleGroup: 'back' },
  { name: 'Pull-up', muscleGroup: 'back' },
  { name: 'Barbell Row', muscleGroup: 'back' },
  { name: 'Lat Pulldown', muscleGroup: 'back' },
  { name: 'Seated Cable Row', muscleGroup: 'back' },
  // Legs
  { name: 'Back Squat', muscleGroup: 'legs' },
  { name: 'Front Squat', muscleGroup: 'legs' },
  { name: 'Romanian Deadlift', muscleGroup: 'legs' },
  { name: 'Leg Press', muscleGroup: 'legs' },
  { name: 'Walking Lunge', muscleGroup: 'legs' },
  { name: 'Leg Curl', muscleGroup: 'legs' },
  { name: 'Calf Raise', muscleGroup: 'legs' },
  // Shoulders
  { name: 'Overhead Press', muscleGroup: 'shoulders' },
  { name: 'Dumbbell Shoulder Press', muscleGroup: 'shoulders' },
  { name: 'Lateral Raise', muscleGroup: 'shoulders' },
  { name: 'Face Pull', muscleGroup: 'shoulders' },
  // Arms
  { name: 'Barbell Curl', muscleGroup: 'arms' },
  { name: 'Hammer Curl', muscleGroup: 'arms' },
  { name: 'Triceps Pushdown', muscleGroup: 'arms' },
  { name: 'Skull Crusher', muscleGroup: 'arms' },
  // Core
  { name: 'Plank', muscleGroup: 'core' },
  { name: 'Hanging Leg Raise', muscleGroup: 'core' },
  { name: 'Cable Crunch', muscleGroup: 'core' },
  // Full body
  { name: 'Kettlebell Swing', muscleGroup: 'full_body' },
  { name: 'Clean and Press', muscleGroup: 'full_body' },
]

async function seed() {
  const client = createClient({
    url: process.env.NUXT_DATABASE_URL ?? 'file:local.db',
    authToken: process.env.NUXT_DATABASE_AUTH_TOKEN || undefined,
  })
  const db = drizzle(client)

  let inserted = 0
  for (const exercise of BUILT_IN_EXERCISES) {
    const existing = await db
      .select({ id: exercises.id })
      .from(exercises)
      .where(and(eq(exercises.name, exercise.name), isNull(exercises.userId)))
      .get()

    if (!existing) {
      await db.insert(exercises).values(exercise)
      inserted++
    }
  }

  console.log(
    `Seed complete: ${inserted} exercises added, ${BUILT_IN_EXERCISES.length - inserted} already existed.`,
  )
  client.close()
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
