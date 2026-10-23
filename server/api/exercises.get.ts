import { asc, eq, isNull, or, sql } from 'drizzle-orm'
import { exercises } from '~~/server/database/schema'

// GET /api/exercises — built-in exercises plus the logged-in user's custom ones.
export default defineEventHandler(async (event) => {
  // Responds with 401 if there's no valid session
  const { user } = await requireUserSession(event)

  return useDb()
    .select({
      id: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      // The WHERE below only lets through built-ins (null) or this user's rows,
      // so a non-null user_id means "custom"
      isCustom: sql<boolean>`${exercises.userId} is not null`.mapWith(Boolean),
    })
    .from(exercises)
    .where(or(isNull(exercises.userId), eq(exercises.userId, user.id)))
    .orderBy(asc(exercises.muscleGroup), asc(exercises.name))
})
