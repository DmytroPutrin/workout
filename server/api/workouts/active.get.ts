// GET /api/workouts/active — the user's unfinished workout, if there is one.
// Wrapped in an object (rather than returning null) so the response is always JSON.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const workout = await findActiveWorkout(user.id)
  return { workout: workout ?? null }
})
