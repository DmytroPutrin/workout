import { and, asc, desc, eq, isNotNull } from 'drizzle-orm'
import { workouts, workoutSets } from '~~/server/database/schema'

// GET /api/exercises/:id/last — what you did for this exercise in your most recent
// finished workout. Powers the "Last time: 60 kg × 8, 8, 6" hint and pre-fills the inputs.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const exerciseId = getIdParam(event)
  const db = useDb()

  // Filtering by the user's own workouts means this can never leak someone else's data,
  // even for an exercise ID that isn't theirs: the result would simply be empty.
  const lastWorkout = await db
    .select({ id: workouts.id, startedAt: workouts.startedAt })
    .from(workouts)
    .innerJoin(workoutSets, eq(workoutSets.workoutId, workouts.id))
    .where(
      and(
        eq(workouts.userId, user.id),
        isNotNull(workouts.finishedAt),
        eq(workoutSets.exerciseId, exerciseId),
      ),
    )
    .orderBy(desc(workouts.startedAt), desc(workouts.id))
    .limit(1)
    .get()

  if (!lastWorkout) {
    return { last: null }
  }

  const sets = await db
    .select({ reps: workoutSets.reps, weightKg: workoutSets.weightKg })
    .from(workoutSets)
    .where(and(eq(workoutSets.workoutId, lastWorkout.id), eq(workoutSets.exerciseId, exerciseId)))
    .orderBy(asc(workoutSets.setOrder), asc(workoutSets.id))

  return { last: { workoutId: lastWorkout.id, date: lastWorkout.startedAt, sets } }
})
