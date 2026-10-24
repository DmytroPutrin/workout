import { eq } from 'drizzle-orm'
import { workoutSets } from '~~/server/database/schema'

// PATCH /api/sets/:id — fix a typo in a logged set.
//   { "reps": 10 }   { "weightKg": 62.5 }   or both
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const setId = getIdParam(event)
  const changes = await readBodyWith(event, updateSetSchema)

  await requireEditableSet(user.id, setId)

  return useDb()
    .update(workoutSets)
    .set(changes)
    .where(eq(workoutSets.id, setId))
    .returning({ id: workoutSets.id, reps: workoutSets.reps, weightKg: workoutSets.weightKg })
    .get()
})
