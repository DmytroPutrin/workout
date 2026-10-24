import { and, eq, isNull } from 'drizzle-orm'
import { exercises, workouts, workoutSets } from '~~/server/database/schema'

/** The workout fields the API returns. `userId` stays on the server. */
export const workoutColumns = {
  id: workouts.id,
  startedAt: workouts.startedAt,
  finishedAt: workouts.finishedAt,
  notes: workouts.notes,
}

/** A logged set, joined with its exercise so the client can show the name. */
export const setColumns = {
  id: workoutSets.id,
  exerciseId: workoutSets.exerciseId,
  exerciseName: exercises.name,
  muscleGroup: exercises.muscleGroup,
  setOrder: workoutSets.setOrder,
  reps: workoutSets.reps,
  weightKg: workoutSets.weightKg,
}

export function selectSets() {
  return useDb()
    .select(setColumns)
    .from(workoutSets)
    .innerJoin(exercises, eq(workoutSets.exerciseId, exercises.id))
}

export function findActiveWorkout(userId: number) {
  return useDb()
    .select(workoutColumns)
    .from(workouts)
    .where(and(eq(workouts.userId, userId), isNull(workouts.finishedAt)))
    .get()
}

/**
 * Loads a workout that belongs to this user, or throws 404.
 * 404 rather than 403 on purpose: a 403 would confirm to someone guessing IDs
 * that workout 123 exists and belongs to another user.
 */
export async function requireOwnedWorkout(userId: number, workoutId: number) {
  const workout = await useDb()
    .select(workoutColumns)
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .get()

  if (!workout) {
    throw createError({ statusCode: 404, message: 'Workout not found' })
  }
  return workout
}

/** Like requireOwnedWorkout, but also rejects finished workouts (they're read-only for now). */
export async function requireActiveWorkout(userId: number, workoutId: number) {
  const workout = await requireOwnedWorkout(userId, workoutId)
  if (workout.finishedAt) {
    throw createError({ statusCode: 409, message: 'This workout is already finished' })
  }
  return workout
}

/**
 * Loads a set the user may change: it must belong to one of their workouts,
 * and that workout must still be in progress. The ownership check goes through
 * the parent workout, because sets don't store a user_id themselves.
 */
export async function requireEditableSet(userId: number, setId: number) {
  const row = await useDb()
    .select({ id: workoutSets.id, finishedAt: workouts.finishedAt })
    .from(workoutSets)
    .innerJoin(workouts, eq(workoutSets.workoutId, workouts.id))
    .where(and(eq(workoutSets.id, setId), eq(workouts.userId, userId)))
    .get()

  if (!row) {
    throw createError({ statusCode: 404, message: 'Set not found' })
  }
  if (row.finishedAt) {
    throw createError({ statusCode: 409, message: 'This workout is already finished' })
  }
  return row
}
