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

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type CreateExerciseInput = z.infer<typeof createExerciseSchema>
