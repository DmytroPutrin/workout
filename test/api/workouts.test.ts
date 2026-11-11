import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { registerUser, startApp, type ApiClient, type TestApp } from '../helpers/app'

let app: TestApp
let bench: number
let squat: number

before(async () => {
  app = await startApp()
  const { client } = await registerUser(app)
  const exercises = (await client.get('/api/exercises')).body as { id: number; name: string }[]
  bench = exercises.find((e) => e.name === 'Bench Press')!.id
  squat = exercises.find((e) => e.name === 'Back Squat')!.id
})
after(async () => {
  await app?.stop()
})

async function startWorkout(client: ApiClient) {
  const response = await client.post('/api/workouts')
  assert.ok([200, 201].includes(response.status), JSON.stringify(response.body))
  return response.body.workout.id as number
}

describe('starting a workout', () => {
  it('starts, then resumes the same workout', async () => {
    const { client } = await registerUser(app)
    assert.deepEqual((await client.get('/api/workouts/active')).body, { workout: null })

    const first = await client.post('/api/workouts')
    assert.equal(first.status, 201)
    assert.equal(first.body.resumed, false)
    assert.equal(first.body.workout.finishedAt, null)
    assert.ok(!('userId' in first.body.workout), 'userId is not exposed')

    const again = await client.post('/api/workouts')
    assert.equal(again.status, 200)
    assert.equal(again.body.resumed, true)
    assert.equal(again.body.workout.id, first.body.workout.id)
  })

  it('creates exactly one workout when "Start" is tapped many times at once', async () => {
    const { client, id: userId } = await registerUser(app)
    const responses = await Promise.all(Array.from({ length: 8 }, () => client.post('/api/workouts')))

    assert.deepEqual(responses.filter((r) => r.status >= 400), [])
    assert.equal(new Set(responses.map((r) => r.body.workout.id)).size, 1)
    const rows = await app.db.execute({ sql: 'select count(*) as n from workouts where user_id = ?', args: [userId] })
    assert.equal(Number(rows.rows[0]?.n), 1)
  })
})

describe('logging sets', () => {
  it('logs sets in order with the exercise name', async () => {
    const { client } = await registerUser(app)
    const workoutId = await startWorkout(client)

    const first = await client.post(`/api/workouts/${workoutId}/sets`, { exerciseId: bench, reps: 8, weightKg: 60 })
    const second = await client.post(`/api/workouts/${workoutId}/sets`, { exerciseId: bench, reps: 6, weightKg: 62.499999 })
    assert.equal(first.status, 201)
    assert.equal(first.body.exerciseName, 'Bench Press')
    assert.deepEqual([first.body.setOrder, second.body.setOrder], [1, 2])
    assert.equal(second.body.weightKg, 62.5)

    const detail = await client.get(`/api/workouts/${workoutId}`)
    assert.deepEqual(detail.body.sets.map((s: { reps: number }) => s.reps), [8, 6])
  })

  it('returns field errors for invalid sets', async () => {
    const { client } = await registerUser(app)
    const workoutId = await startWorkout(client)
    const response = await client.post(`/api/workouts/${workoutId}/sets`, { exerciseId: bench, reps: 0, weightKg: -5 })
    assert.equal(response.status, 400)
    assert.deepEqual(response.body.data.fieldErrors, { reps: ['At least 1 rep'], weightKg: ["Weight can't be negative"] })
  })

  it('edits and deletes sets', async () => {
    const { client } = await registerUser(app)
    const workoutId = await startWorkout(client)
    const set = (await client.post(`/api/workouts/${workoutId}/sets`, { exerciseId: squat, reps: 5, weightKg: 100 })).body

    const edited = await client.patch(`/api/sets/${set.id}`, { reps: 6 })
    assert.deepEqual(edited.body, { id: set.id, reps: 6, weightKg: 100 })

    assert.equal((await client.delete(`/api/sets/${set.id}`)).status, 204)
    assert.deepEqual((await client.get(`/api/workouts/${workoutId}`)).body.sets, [])
  })

  it("can't use another user's custom exercise", async () => {
    const owner = await registerUser(app, 'owner')
    const custom = (await owner.client.post('/api/exercises', { name: 'Secret Lift', muscleGroup: 'back' })).body

    const { client } = await registerUser(app)
    const workoutId = await startWorkout(client)
    const response = await client.post(`/api/workouts/${workoutId}/sets`, { exerciseId: custom.id, reps: 5, weightKg: 10 })
    assert.equal(response.status, 400)
    assert.equal(response.body.message, 'Unknown exercise')
  })
})

describe('finishing a workout', () => {
  it("won't finish an empty workout", async () => {
    const { client } = await registerUser(app)
    const workoutId = await startWorkout(client)
    const response = await client.patch(`/api/workouts/${workoutId}`, { finish: true })
    assert.equal(response.status, 400)
  })

  it('finishes, becomes read-only, and feeds the "last time" hint', async () => {
    const { client } = await registerUser(app)
    const workoutId = await startWorkout(client)
    const set = (await client.post(`/api/workouts/${workoutId}/sets`, { exerciseId: bench, reps: 5, weightKg: 80 })).body

    // Sets from a workout in progress don't count as "last time"
    assert.deepEqual((await client.get(`/api/exercises/${bench}/last`)).body, { last: null })

    const finished = await client.patch(`/api/workouts/${workoutId}`, { finish: true, notes: '  Strong day ' })
    assert.equal(finished.status, 200)
    assert.ok(finished.body.workout.finishedAt)
    assert.equal(finished.body.workout.notes, 'Strong day')
    assert.deepEqual((await client.get('/api/workouts/active')).body, { workout: null })

    assert.equal((await client.post(`/api/workouts/${workoutId}/sets`, { exerciseId: bench, reps: 1, weightKg: 1 })).status, 409)
    assert.equal((await client.patch(`/api/sets/${set.id}`, { reps: 1 })).status, 409)
    assert.equal((await client.patch(`/api/workouts/${workoutId}`, { finish: true })).status, 409)

    const last = (await client.get(`/api/exercises/${bench}/last`)).body.last
    assert.equal(last.workoutId, workoutId)
    assert.deepEqual(last.sets, [{ reps: 5, weightKg: 80 }])
  })

  it('discards a workout together with its sets', async () => {
    const { client } = await registerUser(app)
    const workoutId = await startWorkout(client)
    await client.post(`/api/workouts/${workoutId}/sets`, { exerciseId: bench, reps: 5, weightKg: 80 })

    assert.equal((await client.delete(`/api/workouts/${workoutId}`)).status, 204)
    assert.equal((await client.get(`/api/workouts/${workoutId}`)).status, 404)
    const rows = await app.db.execute({ sql: 'select count(*) as n from workout_sets where workout_id = ?', args: [workoutId] })
    assert.equal(Number(rows.rows[0]?.n), 0)
  })
})

describe("other users' data", () => {
  it('is invisible: 404 for reads and writes, nothing changes', async () => {
    const owner = await registerUser(app, 'owner')
    const workoutId = await startWorkout(owner.client)
    const set = (await owner.client.post(`/api/workouts/${workoutId}/sets`, { exerciseId: bench, reps: 5, weightKg: 80 })).body

    const { client } = await registerUser(app, 'intruder')
    assert.equal((await client.get(`/api/workouts/${workoutId}`)).status, 404)
    assert.equal((await client.patch(`/api/workouts/${workoutId}`, { notes: 'hi' })).status, 404)
    assert.equal((await client.delete(`/api/workouts/${workoutId}`)).status, 404)
    assert.equal((await client.post(`/api/workouts/${workoutId}/sets`, { exerciseId: bench, reps: 1, weightKg: 1 })).status, 404)
    assert.equal((await client.patch(`/api/sets/${set.id}`, { reps: 99 })).status, 404)
    assert.equal((await client.delete(`/api/sets/${set.id}`)).status, 404)

    const detail = await owner.client.get(`/api/workouts/${workoutId}`)
    assert.deepEqual(detail.body.sets.map((s: { reps: number }) => s.reps), [5])
  })

  it('shows the error page for a workout that is not yours', async () => {
    const owner = await registerUser(app, 'owner')
    const workoutId = await startWorkout(owner.client)
    const { client } = await registerUser(app, 'intruder')
    const page = await client.page(`/workouts/${workoutId}`)
    assert.equal(page.status, 404)
  })
})

describe('route parameters', () => {
  it('rejects ids that are not positive integers', async () => {
    const { client } = await registerUser(app)
    for (const id of ['abc', '0', '-1', '1.5']) {
      assert.equal((await client.get(`/api/workouts/${id}`)).status, 400, id)
    }
  })
})
