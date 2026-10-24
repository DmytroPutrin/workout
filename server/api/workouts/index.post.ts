import { workouts } from '~~/server/database/schema'

// POST /api/workouts — start a workout.
// "Start or resume": if one is already in progress, return it instead of creating
// a second. That makes the endpoint safe to call twice (e.g. a double tap).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const active = await findActiveWorkout(user.id)
  if (active) {
    return { workout: active, resumed: true }
  }

  try {
    const workout = await useDb()
      .insert(workouts)
      .values({ userId: user.id })
      .returning(workoutColumns)
      .get()

    setResponseStatus(event, 201)
    return { workout, resumed: false }
  } catch (error) {
    // Two requests passed the check above at the same moment. The partial unique
    // index (one unfinished workout per user) rejected the second insert,
    // so return the workout the first request created.
    if (isUniqueViolation(error)) {
      const existing = await findActiveWorkout(user.id)
      if (existing) {
        return { workout: existing, resumed: true }
      }
    }
    throw error
  }
})
