import { eq } from 'drizzle-orm'
import { users } from '~~/server/database/schema'

// A real hash of a throwaway password, computed once. When the email doesn't exist
// we still verify against it, so "unknown email" and "wrong password" take the same
// time and an attacker can't use response timing to discover which emails are registered.
let dummyHash: Promise<string> | undefined
const getDummyHash = () => (dummyHash ??= hashPassword('not-a-real-password'))

// POST /api/auth/login
export default defineEventHandler(async (event) => {
  const { email, password } = await readBodyWith(event, loginSchema)

  const user = await useDb()
    .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .get()

  const valid = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password)

  // Same message for both cases: don't reveal whether the email exists
  if (!user || !valid) {
    throw createError({ statusCode: 401, message:'Invalid email or password' })
  }

  const sessionUser = { id: user.id, email: user.email }
  await setUserSession(event, { user: sessionUser, loggedInAt: Date.now() })
  return { user: sessionUser }
})
