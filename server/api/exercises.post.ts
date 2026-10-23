import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { exercises } from '~~/server/database/schema'

// POST /api/exercises — add a custom exercise for the logged-in user.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const { name, muscleGroup } = await readBodyWith(event, createExerciseSchema)
  const db = useDb()

  // Case-insensitive check against built-ins and the user's own exercises,
  // so "bench press" can't duplicate "Bench Press"
  const duplicate = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(
      and(
        sql`lower(${exercises.name}) = ${name.toLowerCase()}`,
        or(isNull(exercises.userId), eq(exercises.userId, user.id)),
      ),
    )
    .get()

  if (duplicate) {
    throw createError({ statusCode: 409, message:`"${name}" is already in your library` })
  }

  const exercise = await db
    .insert(exercises)
    .values({ name, muscleGroup, userId: user.id })
    .returning({ id: exercises.id, name: exercises.name, muscleGroup: exercises.muscleGroup })
    .get()

  setResponseStatus(event, 201)
  return { ...exercise, isCustom: true }
})
