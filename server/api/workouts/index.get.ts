import { and, asc, count, countDistinct, desc, eq, inArray, isNotNull, lt, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { exercises, workouts, workoutSets } from '~~/server/database/schema'

// Cursor = "<startedAt in unix seconds>_<id>" of the last workout on the previous page
const CURSOR_PATTERN = /^(\d+)_(\d+)$/

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().regex(CURSOR_PATTERN, { error: 'Invalid cursor' }).optional(),
})

/**
 * GET /api/workouts?limit=20&cursor=… — finished workouts, newest first.
 *
 * Uses *keyset* pagination rather than OFFSET: each page continues "after the last
 * workout you saw" (WHERE (started_at, id) < cursor). OFFSET makes the database
 * read and skip every earlier row, and if a workout is added or deleted between
 * page loads, OFFSET shifts and shows duplicates or skips items. A cursor doesn't.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const { limit, cursor } = getQueryWith(event, querySchema)
  const db = useDb()

  let afterCursor
  if (cursor) {
    const [, seconds, id] = cursor.match(CURSOR_PATTERN)!
    const startedAt = new Date(Number(seconds) * 1000)
    // id breaks ties between workouts started in the same second
    afterCursor = or(
      lt(workouts.startedAt, startedAt),
      and(eq(workouts.startedAt, startedAt), lt(workouts.id, Number(id))),
    )
  }

  // One row per workout with its totals, computed by the database (GROUP BY)
  const rows = await db
    .select({
      ...workoutColumns,
      setCount: count(workoutSets.id),
      exerciseCount: countDistinct(workoutSets.exerciseId),
      volumeKg: sql<number>`coalesce(sum(${workoutSets.reps} * ${workoutSets.weightKg}), 0)`.mapWith(Number),
    })
    .from(workouts)
    .leftJoin(workoutSets, eq(workoutSets.workoutId, workouts.id))
    .where(and(eq(workouts.userId, user.id), isNotNull(workouts.finishedAt), afterCursor))
    .groupBy(workouts.id)
    .orderBy(desc(workouts.startedAt), desc(workouts.id))
    // Ask for one extra row: if it comes back, there is another page
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const page = rows.slice(0, limit)

  // Exercise names per workout, in the order they were first logged.
  // A second small query is simpler than squeezing this into the GROUP BY above.
  const names = new Map<number, string[]>()
  if (page.length) {
    const firstSetOrder = sql`min(${workoutSets.setOrder})`
    const exerciseRows = await db
      .select({ workoutId: workoutSets.workoutId, name: exercises.name })
      .from(workoutSets)
      .innerJoin(exercises, eq(workoutSets.exerciseId, exercises.id))
      .where(inArray(workoutSets.workoutId, page.map((w) => w.id)))
      .groupBy(workoutSets.workoutId, exercises.id)
      .orderBy(asc(firstSetOrder))

    for (const { workoutId, name } of exerciseRows) {
      names.set(workoutId, [...(names.get(workoutId) ?? []), name])
    }
  }

  const last = page.at(-1)
  return {
    items: page.map((workout) => ({ ...workout, exercises: names.get(workout.id) ?? [] })),
    nextCursor: hasMore && last ? `${Math.floor(last.startedAt.getTime() / 1000)}_${last.id}` : null,
  }
})
