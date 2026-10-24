import { z } from 'zod'
import { MUSCLE_GROUPS } from './muscle-groups'

// Shared between client and server: the form validates with the same rules
// the API enforces, so error messages match and nothing drifts apart.

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address' }))

export const registerSchema = z.object({
  email,
  password: z
    .string()
    .min(8, { error: 'Password must be at least 8 characters' })
    .max(128, { error: 'Password must be at most 128 characters' }),
})

// Login doesn't re-check password strength: old accounts may predate a rule change.
export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: 'Enter your password' }),
})

export const createExerciseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: 'Name must be at least 2 characters' })
    .max(60, { error: 'Name must be at most 60 characters' }),
  muscleGroup: z.enum(MUSCLE_GROUPS, { error: 'Pick a muscle group' }),
})

// ---- Workouts & sets -------------------------------------------------------

const reps = z
  .number({ error: 'Enter reps' })
  .int({ error: 'Reps must be a whole number' })
  .min(1, { error: 'At least 1 rep' })
  .max(1000, { error: 'At most 1000 reps' })

const weightKg = z
  .number({ error: 'Enter a weight (0 for bodyweight)' })
  .min(0, { error: "Weight can't be negative" })
  .max(1000, { error: 'At most 1000 kg' })
  // Store at most 2 decimals, so 62.499999 from float maths becomes 62.5
  .transform((value) => Math.round(value * 100) / 100)

export const addSetSchema = z.object({
  exerciseId: z.number({ error: 'Pick an exercise' }).int().positive(),
  reps,
  weightKg,
})

export const updateSetSchema = z
  .object({ reps, weightKg })
  .partial()
  .refine((body) => body.reps !== undefined || body.weightKg !== undefined, {
    error: 'Nothing to update',
  })

export const updateWorkoutSchema = z
  .object({
    notes: z.string().trim().max(2000, { error: 'Notes must be at most 2000 characters' }).nullable(),
    finish: z.literal(true),
  })
  .partial()
  .refine((body) => body.notes !== undefined || body.finish !== undefined, {
    error: 'Nothing to update',
  })

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type CreateExerciseInput = z.infer<typeof createExerciseSchema>
export type AddSetInput = z.input<typeof addSetSchema>
export type UpdateSetInput = z.input<typeof updateSetSchema>
export type UpdateWorkoutInput = z.input<typeof updateWorkoutSchema>
