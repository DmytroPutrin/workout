import { and, countDistinct, desc, eq, isNotNull, max } from 'drizzle-orm'
import { exercises, workouts, workoutSets } from '~~/server/database/schema'

// GET /api/progress — exercises you've logged in finished workouts,
// most recently trained first. Feeds the exercise picker on the progress page.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const lastTrained = max(workouts.startedAt)

  return useDb()
    .select({
      id: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      sessions: countDistinct(workouts.id),
      lastTrainedAt: lastTrained,
    })
    .from(workoutSets)
    .innerJoin(workouts, eq(workoutSets.workoutId, workouts.id))
    .innerJoin(exercises, eq(workoutSets.exerciseId, exercises.id))
    .where(and(eq(workouts.userId, user.id), isNotNull(workouts.finishedAt)))
    .groupBy(exercises.id)
    .orderBy(desc(lastTrained), exercises.name)
})
