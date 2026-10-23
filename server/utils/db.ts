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
    _db = drizzle(client, { schema })
  }
  return _db
}
