import { count, eq } from 'drizzle-orm'
import { workouts, workoutSets } from '~~/server/database/schema'

// PATCH /api/workouts/:id — update notes and/or finish the workout.
//   { "notes": "Felt strong" }   { "finish": true }   or both
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const workoutId = getIdParam(event)
  const body = await readBodyWith(event, updateWorkoutSchema)
  const db = useDb()

  const workout = await requireOwnedWorkout(user.id, workoutId)
  const changes: Partial<typeof workouts.$inferInsert> = {}

  if (body.notes !== undefined) {
    // Store "no notes" as NULL rather than an empty string
    changes.notes = body.notes || null
  }

  if (body.finish) {
    if (workout.finishedAt) {
      throw createError({ statusCode: 409, message: 'This workout is already finished' })
    }

    const result = await db
      .select({ sets: count() })
      .from(workoutSets)
      .where(eq(workoutSets.workoutId, workoutId))
      .get()

    if (!result?.sets) {
      throw createError({
        statusCode: 400,
        message: 'Log at least one set before finishing, or discard the workout',
      })
    }
    changes.finishedAt = new Date()
  }

  const updated = await db
    .update(workouts)
    .set(changes)
    .where(eq(workouts.id, workoutId))
    .returning(workoutColumns)
    .get()

  return { workout: updated }
})
