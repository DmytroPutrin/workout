import { createClient } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import * as schema from '../database/schema'

let _db: LibSQLDatabase<typeof schema> | undefined

/**
 * Lazily creates one database connection per server process.
 * Available in every server route without importing it,
 * thanks to Nitro's auto-imports from server/utils.
 */
export function useDb() {
  if (!_db) {
    const config = useRuntimeConfig()
    const client = createClient({
      url: config.databaseUrl,
      authToken: config.databaseAuthToken || undefined,
    })

    // SQLite only enforces foreign keys when the connection turns them on. Without
    // this, ON DELETE CASCADE / RESTRICT in the schema would silently do nothing.
    // For a local file the client applies this immediately, before any query runs.
    client.execute('PRAGMA foreign_keys = ON').catch((error) => {
      console.error('[db] Could not enable foreign keys:', error)
    })

    _db = drizzle(client, { schema })
  }
  return _db
}
