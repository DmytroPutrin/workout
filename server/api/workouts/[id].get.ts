import { asc, eq } from 'drizzle-orm'
import { workoutSets } from '~~/server/database/schema'

// GET /api/workouts/:id — a workout with all its sets, in the order they were logged.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const workoutId = getIdParam(event)

  const workout = await requireOwnedWorkout(user.id, workoutId)
  const sets = await selectSets()
    .where(eq(workoutSets.workoutId, workoutId))
    .orderBy(asc(workoutSets.setOrder), asc(workoutSets.id))

  return { workout, sets }
})
