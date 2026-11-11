// '#drizzle-libsql' is an alias set in nuxt.config.ts: the HTTP-only driver on
// Vercel, the full driver (with local SQLite file support) everywhere else.
import { drizzle } from '#drizzle-libsql'
import * as schema from '../database/schema'

function createDb() {
  const config = useRuntimeConfig()
  const db = drizzle({
    connection: { url: config.databaseUrl, authToken: config.databaseAuthToken || undefined },
    schema,
  })

  // A local SQLite file only enforces foreign keys when the connection turns them
  // on. Without this, ON DELETE CASCADE / RESTRICT in the schema would do nothing.
  // (Turso is a remote server where each HTTP request is its own connection, so
  // the code never relies on this: deletes remove child rows explicitly.)
  if (config.databaseUrl.startsWith('file:')) {
    db.$client.execute('PRAGMA foreign_keys = ON').catch((error: unknown) => {
      console.error('[db] Could not enable foreign keys:', error)
    })
  }
  return db
}

let _db: ReturnType<typeof createDb> | undefined

/**
 * Lazily creates one database connection per server process.
 * Available in every server route without importing it,
 * thanks to Nitro's auto-imports from server/utils.
 */
export function useDb() {
  _db ??= createDb()
  return _db
}
