import { and, eq, isNull, max, or } from 'drizzle-orm'
import { exercises, workoutSets } from '~~/server/database/schema'

// POST /api/workouts/:id/sets — log a set.
//   { "exerciseId": 1, "reps": 8, "weightKg": 60 }
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const workoutId = getIdParam(event)
  const { exerciseId, reps, weightKg } = await readBodyWith(event, addSetSchema)
  const db = useDb()

  await requireActiveWorkout(user.id, workoutId)

  // The exercise must be one this user can see: built-in, or their own custom one.
  // Without this check, anyone could log sets against another user's private exercise.
  const exercise = await db
    .select({ name: exercises.name, muscleGroup: exercises.muscleGroup })
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), or(isNull(exercises.userId), eq(exercises.userId, user.id))))
    .get()

  if (!exercise) {
    throw createError({ statusCode: 400, message: 'Unknown exercise' })
  }

  // Next position in this workout. If two sets arrive at the same moment they can
  // share a number; that's harmless because reads also sort by id as a tie-breaker.
  const last = await db
    .select({ setOrder: max(workoutSets.setOrder) })
    .from(workoutSets)
    .where(eq(workoutSets.workoutId, workoutId))
    .get()

  const set = await db
    .insert(workoutSets)
    .values({ workoutId, exerciseId, reps, weightKg, setOrder: (last?.setOrder ?? 0) + 1 })
    .returning({
      id: workoutSets.id,
      exerciseId: workoutSets.exerciseId,
      setOrder: workoutSets.setOrder,
      reps: workoutSets.reps,
      weightKg: workoutSets.weightKg,
    })
    .get()

  setResponseStatus(event, 201)
  // Same shape as the sets in GET /api/workouts/:id, so the client can just append it
  return { ...set, exerciseName: exercise.name, muscleGroup: exercise.muscleGroup }
})
