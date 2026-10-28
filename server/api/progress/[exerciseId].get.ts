import { and, asc, count, eq, isNotNull, isNull, max, or, sql } from 'drizzle-orm'
import { exercises, workouts, workoutSets } from '~~/server/database/schema'

const round1 = (value: number) => Math.round(value * 10) / 10

/**
 * GET /api/progress/:exerciseId — one data point per finished workout that
 * included this exercise, oldest first, plus personal records.
 *
 * Estimated 1RM (one-rep max) uses the Epley formula: weight × (1 + reps / 30).
 * It lets a set of 5 × 100 kg and a set of 8 × 90 kg be compared on one scale.
 * A true single (1 rep) counts as-is.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const exerciseId = getIdParam(event, 'exerciseId')
  const db = useDb()

  // Built-in or your own; anything else is "not found"
  const exercise = await db
    .select({ id: exercises.id, name: exercises.name, muscleGroup: exercises.muscleGroup })
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), or(isNull(exercises.userId), eq(exercises.userId, user.id))))
    .get()

  if (!exercise) {
    throw createError({ statusCode: 404, message: 'Exercise not found' })
  }

  const { reps, weightKg } = workoutSets
  const rows = await db
    .select({
      workoutId: workouts.id,
      date: workouts.startedAt,
      sets: count(),
      maxWeightKg: max(weightKg),
      estimated1RmKg: sql<number>`max(case when ${reps} = 1 then ${weightKg} else ${weightKg} * (1 + ${reps} / 30.0) end)`.mapWith(Number),
      volumeKg: sql<number>`sum(${reps} * ${weightKg})`.mapWith(Number),
      totalReps: sql<number>`sum(${reps})`.mapWith(Number),
    })
    .from(workoutSets)
    .innerJoin(workouts, eq(workoutSets.workoutId, workouts.id))
    .where(
      and(eq(workouts.userId, user.id), isNotNull(workouts.finishedAt), eq(workoutSets.exerciseId, exerciseId)),
    )
    .groupBy(workouts.id)
    .orderBy(asc(workouts.startedAt), asc(workouts.id))

  const points = rows.map((row) => ({
    ...row,
    maxWeightKg: row.maxWeightKg ?? 0,
    estimated1RmKg: round1(row.estimated1RmKg),
    volumeKg: round1(row.volumeKg),
  }))

  // The first workout that reached the top value wins ties: that's when the PR was set
  const recordFor = (metric: 'maxWeightKg' | 'estimated1RmKg' | 'volumeKg' | 'totalReps') => {
    let best: (typeof points)[number] | undefined
    for (const point of points) {
      if (!best || point[metric] > best[metric]) best = point
    }
    return best && best[metric] > 0 ? { value: best[metric], date: best.date, workoutId: best.workoutId } : null
  }

  return {
    exercise,
    points,
    records: {
      maxWeightKg: recordFor('maxWeightKg'),
      estimated1RmKg: recordFor('estimated1RmKg'),
      volumeKg: recordFor('volumeKg'),
      totalReps: recordFor('totalReps'),
    },
  }
})
