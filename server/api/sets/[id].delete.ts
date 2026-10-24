import { eq } from 'drizzle-orm'
import { workoutSets } from '~~/server/database/schema'

// DELETE /api/sets/:id
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const setId = getIdParam(event)

  await requireEditableSet(user.id, setId)
  await useDb().delete(workoutSets).where(eq(workoutSets.id, setId))

  return sendNoContent(event)
})
