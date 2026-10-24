import { eq } from 'drizzle-orm'
import { workouts, workoutSets } from '~~/server/database/schema'

// DELETE /api/workouts/:id — discard a workout and its sets.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const workoutId = getIdParam(event)

  await requireOwnedWorkout(user.id, workoutId)

  // The schema says ON DELETE CASCADE, but we delete the sets explicitly anyway, so this
  // never depends on foreign keys being switched on. batch() runs both statements in one
  // transaction: either both deletes happen or neither does.
  const db = useDb()
  await db.batch([
    db.delete(workoutSets).where(eq(workoutSets.workoutId, workoutId)),
    db.delete(workouts).where(eq(workouts.id, workoutId)),
  ])

  return sendNoContent(event)
})
