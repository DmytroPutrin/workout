import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { MUSCLE_GROUPS } from '../../shared/utils/muscle-groups'

// SQLite stores timestamps as unix seconds; mode: 'timestamp' maps them to JS Date objects.
const createdAt = () =>
  integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: createdAt(),
})

export const exercises = sqliteTable(
  'exercises',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    muscleGroup: text('muscle_group', { enum: MUSCLE_GROUPS }).notNull(),
    // null = built-in exercise visible to everyone; set = a user's custom exercise
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [index('exercises_user_idx').on(t.userId)],
)

export const workouts = sqliteTable(
  'workouts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startedAt: integer('started_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    // null while the workout is in progress
    finishedAt: integer('finished_at', { mode: 'timestamp' }),
    notes: text('notes'),
  },
  (t) => [
    index('workouts_user_started_idx').on(t.userId, t.startedAt),
    // At most one unfinished workout per user. A *partial* unique index only covers
    // rows matching the WHERE clause, so finished workouts don't count. Because the
    // database enforces it, even two "Start workout" requests at the same moment
    // (a double tap) can't both create one.
    uniqueIndex('workouts_one_active_per_user_idx')
      .on(t.userId)
      .where(sql`finished_at is null`),
  ],
)

export const workoutSets = sqliteTable(
  'workout_sets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    workoutId: integer('workout_id')
      .notNull()
      .references(() => workouts.id, { onDelete: 'cascade' }),
    // restrict: an exercise that has logged sets can't be deleted by accident
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    setOrder: integer('set_order').notNull(),
    reps: integer('reps').notNull(),
    weightKg: real('weight_kg').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index('workout_sets_workout_idx').on(t.workoutId),
    // speeds up progress queries: "all sets of exercise X"
    index('workout_sets_exercise_idx').on(t.exerciseId),
  ],
)

export type User = typeof users.$inferSelect
export type Exercise = typeof exercises.$inferSelect
export type Workout = typeof workouts.$inferSelect
export type WorkoutSet = typeof workoutSets.$inferSelect
