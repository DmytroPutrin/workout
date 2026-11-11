/**
 * Starts the real production build (.output/server/index.mjs) for API tests.
 *
 * Each test file gets its own server and its own fresh SQLite database:
 *   1. apply the same migrations production uses (server/database/migrations)
 *   2. run the real seed script for the built-in exercises
 *   3. start the server on a free port and wait for /api/health
 *
 * Nothing is mocked, so the tests exercise everything the browser would:
 * routing, the auth session cookie, validation, error responses and SQL.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer, type AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'

const ROOT = resolve(import.meta.dirname, '../..')
const SERVER_ENTRY = join(ROOT, '.output/server/index.mjs')
const SESSION_PASSWORD = 'test-only-session-password-0123456789abcdef'

export type TestApp = {
  baseUrl: string
  /** Direct database access, for arranging data the API can't create (e.g. past dates) */
  db: Client
  client: () => ApiClient
  stop: () => Promise<void>
}

export async function startApp(): Promise<TestApp> {
  if (!existsSync(SERVER_ENTRY)) {
    throw new Error('No production build found. Run `npm run build` before `npm run test:api`.')
  }

  const dir = mkdtempSync(join(tmpdir(), 'workout-test-'))
  const dbUrl = `file:${join(dir, 'test.db')}`

  const setup = createClient({ url: dbUrl })
  await migrate(drizzle(setup), { migrationsFolder: join(ROOT, 'server/database/migrations') })
  setup.close()

  await run(process.execPath, ['--import', 'tsx', 'server/database/seed.ts'], { NUXT_DATABASE_URL: dbUrl })

  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const server = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: String(port),
      NUXT_DATABASE_URL: dbUrl,
      NUXT_SESSION_PASSWORD: SESSION_PASSWORD,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let logs = ''
  server.stdout?.on('data', (chunk) => (logs += chunk))
  server.stderr?.on('data', (chunk) => (logs += chunk))

  await waitUntilHealthy(baseUrl, server, () => logs)

  const db = createClient({ url: dbUrl })
  return {
    baseUrl,
    db,
    client: () => createApiClient(baseUrl),
    async stop() {
      db.close()
      if (server.exitCode === null) {
        server.kill()
        await once(server, 'exit')
      }
      // Surface server-side crashes (500s) that a test might otherwise swallow
      if (/\[unhandled\]|\[fatal\]/.test(logs)) console.error('Server logged errors:\n' + logs)
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

// ---- HTTP client with a cookie jar for the session ------------------------------

export type ApiResponse = {
  status: number
  // Tests assert on many different response shapes; `any` keeps them readable
  body: any
  headers: Headers
}

export type ApiClient = ReturnType<typeof createApiClient>

export function createApiClient(baseUrl: string) {
  let sessionCookie = ''

  async function request(method: string, path: string, body?: unknown, accept = 'application/json'): Promise<ApiResponse> {
    const headers: Record<string, string> = { accept }
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (sessionCookie) headers.cookie = sessionCookie

    const response = await fetch(baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      redirect: 'manual',
    })

    // Behave like a browser: remember the session cookie, forget it when cleared
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0] ?? ''
      const [name, ...rest] = pair.split('=')
      if (name !== 'nuxt-session') continue
      const cleared = rest.join('=') === '' || /max-age=0/i.test(cookie)
      sessionCookie = cleared ? '' : pair
    }

    const text = await response.text()
    const isJson = response.headers.get('content-type')?.includes('json')
    return { status: response.status, body: isJson && text ? JSON.parse(text) : text, headers: response.headers }
  }

  return {
    get: (path: string) => request('GET', path),
    post: (path: string, body?: unknown) => request('POST', path, body ?? {}),
    patch: (path: string, body: unknown) => request('PATCH', path, body),
    delete: (path: string) => request('DELETE', path),
    /** Requests a page as a browser would (HTML, server-side rendered) */
    page: (path: string) => request('GET', path, undefined, 'text/html'),
    setSessionCookie: (value: string) => (sessionCookie = value),
    get hasSession() {
      return sessionCookie !== ''
    },
  }
}

/** Registers a new user with a unique email and returns a logged-in client. */
export async function registerUser(app: TestApp, name = 'user') {
  const client = app.client()
  const email = `${name}-${crypto.randomUUID().slice(0, 8)}@example.com`
  const response = await client.post('/api/auth/register', { email, password: 'correct-horse-battery' })
  if (response.status !== 201) throw new Error(`Register failed: ${response.status} ${JSON.stringify(response.body)}`)
  return { client, email, id: response.body.user.id as number }
}

// ---- internals -----------------------------------------------------------------------

function run(command: string, args: string[], env: Record<string, string>) {
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: 'pipe' })
    let output = ''
    child.stdout.on('data', (chunk) => (output += chunk))
    child.stderr.on('data', (chunk) => (output += chunk))
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolvePromise() : reject(new Error(`${args.join(' ')} exited with ${code}:\n${output}`)),
    )
  })
}

function freePort() {
  return new Promise<number>((resolvePromise, reject) => {
    const probe = createServer()
    probe.on('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo
      probe.close(() => resolvePromise(port))
    })
  })
}

async function waitUntilHealthy(baseUrl: string, server: ChildProcess, logs: () => string) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Server exited with ${server.exitCode}:\n${logs()}`)
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) return
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  server.kill()
  throw new Error(`Server didn't become healthy within 30 s:\n${logs()}`)
}
