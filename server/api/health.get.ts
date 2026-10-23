import { sql } from 'drizzle-orm'

// GET /api/health — quick check that the server can reach the database.
export default defineEventHandler(async () => {
  try {
    await useDb().run(sql`select 1`)
    return { status: 'ok', database: 'connected' }
  } catch (error) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Database unavailable',
      cause: error,
    })
  }
})
