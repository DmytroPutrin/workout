import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addSetSchema,
  createExerciseSchema,
  loginSchema,
  registerSchema,
  updateSetSchema,
  updateWorkoutSchema,
} from '../../shared/utils/validation'

// These schemas run in the browser (instant form feedback) and on the server
// (the real gatekeeper), so a regression here breaks both sides at once.

/** The first error message for a field, or undefined if the field is valid. */
function fieldError(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }, field: string) {
  return result.error?.issues.find((issue) => issue.path[0] === field)?.message
}

describe('registerSchema', () => {
  it('trims and lowercases the email', () => {
    const result = registerSchema.parse({ email: '  Dmytro@Example.COM ', password: 'longenough' })
    assert.equal(result.email, 'dmytro@example.com')
  })

  it('rejects invalid emails', () => {
    for (const email of ['', 'not-an-email', 'a@', '@b.com']) {
      const result = registerSchema.safeParse({ email, password: 'longenough' })
      assert.equal(fieldError(result, 'email'), 'Enter a valid email address', email)
    }
  })

  it('requires 8 to 128 characters of password', () => {
    assert.equal(fieldError(registerSchema.safeParse({ email: 'a@b.co', password: '1234567' }), 'password'), 'Password must be at least 8 characters')
    assert.equal(fieldError(registerSchema.safeParse({ email: 'a@b.co', password: 'x'.repeat(129) }), 'password'), 'Password must be at most 128 characters')
    assert.equal(registerSchema.safeParse({ email: 'a@b.co', password: '12345678' }).success, true)
  })
})

describe('loginSchema', () => {
  it("doesn't enforce password length, only presence", () => {
    assert.equal(loginSchema.safeParse({ email: 'a@b.co', password: 'short' }).success, true)
    assert.equal(fieldError(loginSchema.safeParse({ email: 'a@b.co', password: '' }), 'password'), 'Enter your password')
  })
})

describe('createExerciseSchema', () => {
  it('trims the name and accepts known muscle groups', () => {
    assert.deepEqual(createExerciseSchema.parse({ name: '  Hip Thrust ', muscleGroup: 'legs' }), {
      name: 'Hip Thrust',
      muscleGroup: 'legs',
    })
  })

  it('rejects unknown muscle groups and too-short names', () => {
    assert.equal(fieldError(createExerciseSchema.safeParse({ name: 'Hip Thrust', muscleGroup: 'glutes' }), 'muscleGroup'), 'Pick a muscle group')
    assert.equal(fieldError(createExerciseSchema.safeParse({ name: ' a ', muscleGroup: 'legs' }), 'name'), 'Name must be at least 2 characters')
  })
})

describe('addSetSchema', () => {
  it('rounds the weight to 2 decimals', () => {
    assert.equal(addSetSchema.parse({ exerciseId: 1, reps: 5, weightKg: 62.499999 }).weightKg, 62.5)
    assert.equal(addSetSchema.parse({ exerciseId: 1, reps: 5, weightKg: 0.1 + 0.2 }).weightKg, 0.3)
  })

  it('allows 0 kg for bodyweight exercises', () => {
    assert.equal(addSetSchema.parse({ exerciseId: 1, reps: 20, weightKg: 0 }).weightKg, 0)
  })

  it('rejects bad reps and weights with readable messages', () => {
    const cases: [object, string, string][] = [
      [{ exerciseId: 1, reps: 0, weightKg: 50 }, 'reps', 'At least 1 rep'],
      [{ exerciseId: 1, reps: 2.5, weightKg: 50 }, 'reps', 'Reps must be a whole number'],
      [{ exerciseId: 1, reps: '8', weightKg: 50 }, 'reps', 'Enter reps'],
      [{ exerciseId: 1, reps: 8, weightKg: -1 }, 'weightKg', "Weight can't be negative"],
      [{ exerciseId: 1, reps: 8, weightKg: 1001 }, 'weightKg', 'At most 1000 kg'],
      [{ exerciseId: 1, reps: 8 }, 'weightKg', 'Enter a weight (0 for bodyweight)'],
      [{ reps: 8, weightKg: 50 }, 'exerciseId', 'Pick an exercise'],
    ]
    for (const [input, field, message] of cases) {
      assert.equal(fieldError(addSetSchema.safeParse(input), field), message, JSON.stringify(input))
    }
  })
})

describe('updateSetSchema', () => {
  it('accepts a partial update', () => {
    assert.deepEqual(updateSetSchema.parse({ reps: 10 }), { reps: 10 })
  })

  it('rejects an empty update', () => {
    const result = updateSetSchema.safeParse({})
    assert.equal(result.success, false)
    assert.equal(result.error?.issues[0]?.message, 'Nothing to update')
  })
})

describe('updateWorkoutSchema', () => {
  it('trims notes and only accepts finish: true', () => {
    assert.deepEqual(updateWorkoutSchema.parse({ notes: '  felt good ' }), { notes: 'felt good' })
    assert.equal(updateWorkoutSchema.safeParse({ finish: false }).success, false)
    assert.equal(updateWorkoutSchema.safeParse({}).success, false)
  })

  it('allows clearing notes with null', () => {
    assert.deepEqual(updateWorkoutSchema.parse({ notes: null }), { notes: null })
  })
})
