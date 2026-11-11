// Types for the '#drizzle-libsql' alias (see nuxt.config.ts). Both targets
// ('drizzle-orm/libsql' and 'drizzle-orm/libsql/web') have the same API.
// Only server/utils/db.ts uses it, but it lives in shared/types because the
// app's type-check also reaches db.ts (through the API response types).
declare module '#drizzle-libsql' {
  export { drizzle } from 'drizzle-orm/libsql'
}
