import { defineConfig } from 'drizzle-kit'

// drizzle-kit runs outside Nuxt, so load .env ourselves (Node 21.7+).
try {
  process.loadEnvFile()
} catch {
  // no .env file: fall back to the default below
}

export default defineConfig({
  // 'turso' is the libSQL dialect: works with local `file:` URLs and hosted Turso databases
  dialect: 'turso',
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dbCredentials: {
    url: process.env.NUXT_DATABASE_URL ?? 'file:local.db',
    authToken: process.env.NUXT_DATABASE_AUTH_TOKEN || undefined,
  },
})
