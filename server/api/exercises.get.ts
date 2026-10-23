import { asc, isNull } from 'drizzle-orm'
import { exercises } from '~~/server/database/schema'

// GET /api/exercises — the built-in exercise library.
// In Milestone 2 this will also return the logged-in user's custom exercises.
export default defineEventHandler(async () => {
  return useDb()
    .select({
      id: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
    })
    .from(exercises)
    .where(isNull(exercises.userId))
    .orderBy(asc(exercises.muscleGroup), asc(exercises.name))
})
