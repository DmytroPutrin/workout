import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { registerUser, startApp, type TestApp } from '../helpers/app'

let app: TestApp
before(async () => {
  app = await startApp()
})
after(async () => {
  await app?.stop()
})

describe('health and seed', () => {
  it('reports the database as connected', async () => {
    const response = await app.client().get('/api/health')
    assert.equal(response.status, 200)
    assert.deepEqual(response.body, { status: 'ok', database: 'connected' })
  })

  it('has the 30 built-in exercises after seeding', async () => {
    const { client } = await registerUser(app)
    const response = await client.get('/api/exercises')
    assert.equal(response.status, 200)
    assert.equal(response.body.length, 30)
    assert.ok(response.body.every((exercise: { isCustom: boolean }) => exercise.isCustom === false))
  })
})

describe('registration', () => {
  it('creates an account, starts a session and stores only a hash', async () => {
    const client = app.client()
    const response = await client.post('/api/auth/register', { email: '  New.User@Example.com ', password: 'correct-horse-battery' })

    assert.equal(response.status, 201)
    assert.equal(response.body.user.email, 'new.user@example.com')
    assert.equal(client.hasSession, true)

    const session = await client.get('/api/_auth/session')
    assert.equal(session.body.user.id, response.body.user.id)

    const row = await app.db.execute({ sql: 'select password_hash from users where id = ?', args: [response.body.user.id] })
    const hash = String(row.rows[0]?.password_hash)
    assert.ok(!hash.includes('correct-horse-battery'))
    assert.ok(hash.length > 40)
  })

  it('rejects a duplicate email regardless of case', async () => {
    const { email } = await registerUser(app)
    const response = await app.client().post('/api/auth/register', { email: email.toUpperCase(), password: 'another-password' })
    assert.equal(response.status, 409)
    assert.equal(response.body.message, 'An account with this email already exists')
  })

  it('returns field errors the form can show (production error format)', async () => {
    const response = await app.client().post('/api/auth/register', { email: 'nope', password: 'short' })
    assert.equal(response.status, 400)
    assert.deepEqual(response.body.data.fieldErrors, {
      email: ['Enter a valid email address'],
      password: ['Password must be at least 8 characters'],
    })
  })

  it('handles a body that is not JSON', async () => {
    const response = await app.client().post('/api/auth/register', '{not json')
    assert.equal(response.status, 400)
  })
})

describe('login and logout', () => {
  it('logs in with the right password', async () => {
    const { email } = await registerUser(app)
    const client = app.client()
    const response = await client.post('/api/auth/login', { email, password: 'correct-horse-battery' })
    assert.equal(response.status, 200)
    assert.equal(response.body.user.email, email)
    assert.equal((await client.get('/api/workouts/active')).status, 200)
  })

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const { email } = await registerUser(app)
    const wrongPassword = await app.client().post('/api/auth/login', { email, password: 'wrong-password' })
    const unknownEmail = await app.client().post('/api/auth/login', { email: 'nobody@example.com', password: 'wrong-password' })
    assert.equal(wrongPassword.status, 401)
    assert.equal(unknownEmail.status, 401)
    assert.equal(wrongPassword.body.message, 'Invalid email or password')
    assert.equal(unknownEmail.body.message, wrongPassword.body.message)
  })

  it('logs out', async () => {
    const { client } = await registerUser(app)
    const response = await client.delete('/api/_auth/session')
    assert.equal(response.status, 200)
    assert.equal(client.hasSession, false)
    assert.equal((await client.get('/api/exercises')).status, 401)
  })
})

describe('protected routes', () => {
  it('returns 401 without a session', async () => {
    const client = app.client()
    for (const path of ['/api/exercises', '/api/workouts', '/api/workouts/active', '/api/progress']) {
      assert.equal((await client.get(path)).status, 401, path)
    }
  })

  it('rejects a forged session cookie', async () => {
    const client = app.client()
    client.setSessionCookie('nuxt-session=Fe26.2**forged**cookie')
    assert.equal((await client.get('/api/exercises')).status, 401)
  })
})

describe('server-rendered pages', () => {
  it('sends logged-out visitors to /login, remembering where they were going', async () => {
    const client = app.client()

    const home = await client.page('/')
    assert.ok([302, 307].includes(home.status), `status ${home.status}`)
    assert.equal(new URL(home.headers.get('location')!, app.baseUrl).pathname, '/login')

    const history = await client.page('/history')
    const location = new URL(history.headers.get('location')!, app.baseUrl)
    assert.equal(location.pathname, '/login')
    assert.equal(location.searchParams.get('redirect'), '/history')
  })

  it('renders the login page', async () => {
    const response = await app.client().page('/login')
    assert.equal(response.status, 200)
    assert.match(response.body, /Welcome back/)
  })

  it('renders the home page for a logged-in user and keeps them off /login', async () => {
    const { client } = await registerUser(app)

    const home = await client.page('/')
    assert.equal(home.status, 200)
    assert.match(home.body, /Ready to train\?/)

    const login = await client.page('/login')
    assert.ok([302, 307].includes(login.status), `status ${login.status}`)
    assert.equal(new URL(login.headers.get('location')!, app.baseUrl).pathname, '/')
  })
})
