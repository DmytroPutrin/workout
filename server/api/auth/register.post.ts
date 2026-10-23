import { eq } from 'drizzle-orm'
import { users } from '~~/server/database/schema'

const EMAIL_TAKEN = 'An account with this email already exists'

// POST /api/auth/register — create an account and log the user in.
export default defineEventHandler(async (event) => {
  const { email, password } = await readBodyWith(event, registerSchema)
  const db = useDb()

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).get()
  if (existing) {
    throw createError({ statusCode: 409, message: EMAIL_TAKEN })
  }

  // hashPassword (scrypt) is provided by nuxt-auth-utils
  const passwordHash = await hashPassword(password)

  let user: { id: number; email: string }
  try {
    user = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning({ id: users.id, email: users.email })
      .get()
  } catch (error) {
    // Two sign-ups with the same email at the same moment: the UNIQUE index catches it
    if (isUniqueViolation(error)) {
      throw createError({ statusCode: 409, message: EMAIL_TAKEN })
    }
    throw error
  }

  await setUserSession(event, { user, loggedInAt: Date.now() })
  setResponseStatus(event, 201)
  return { user }
})
