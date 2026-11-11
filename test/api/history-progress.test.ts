import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { registerUser, startApp, type ApiClient, type TestApp } from '../helpers/app'

// History needs workouts spread over weeks, which the API can't create (it always
// uses "now"), so this file arranges finished workouts directly in the database.

let app: TestApp
let client: ApiClient
let userId: number
const ids: Record<string, number> = {}
const workoutIds: number[] = [] // oldest first
const DAY = 86_400
const T0 = 1_790_000_000 // a fixed point in 2026 (unix seconds)

async function insertWorkout(startedAt: number, sets: [exercise: string, reps: number, weightKg: number][], finished = true) {
  const workout = await app.db.execute({
    sql: 'insert into workouts (user_id, started_at, finished_at) values (?, ?, ?) returning id',
    args: [userId, startedAt, finished ? startedAt + 3600 : null],
  })
  const workoutId = Number(workout.rows[0]!.id)
  for (const [i, [exercise, reps, weightKg]] of sets.entries()) {
    await app.db.execute({
      sql: 'insert into workout_sets (workout_id, exercise_id, set_order, reps, weight_kg) values (?, ?, ?, ?, ?)',
      args: [workoutId, ids[exercise]!, i + 1, reps, weightKg],
    })
  }
  return workoutId
}

before(async () => {
  app = await startApp()
  ;({ client, id: userId } = await registerUser(app))
  for (const exercise of (await client.get('/api/exercises')).body) ids[exercise.name] = exercise.id

  // Day 0: bench 100×5 ×2 + squat 80×8   Day 1: bench 105×3, 120×1
  workoutIds.push(await insertWorkout(T0, [['Bench Press', 5, 100], ['Bench Press', 5, 100], ['Back Squat', 8, 80]]))
  workoutIds.push(await insertWorkout(T0 + DAY, [['Bench Press', 3, 105], ['Bench Press', 1, 120]]))
  // 23 more, one bench set each. Days 5 and 6 start in the same second to test tie-breaking.
  for (let day = 2; day < 25; day++) {
    workoutIds.push(await insertWorkout(T0 + (day === 6 ? 5 : day) * DAY, [['Bench Press', 10, 60]]))
  }
  workoutIds.push(await insertWorkout(T0 + 30 * DAY, [['Push-up', 20, 0], ['Push-up', 15, 0]]))
  // In progress: never listed in history or progress
  await insertWorkout(T0 + 40 * DAY, [['Deadlift', 5, 200]], false)
})
after(async () => {
  await app?.stop()
})

async function allPages(limit: number) {
  const items = []
  let cursor: string | null = null
  let pages = 0
  do {
    const response = await client.get(`/api/workouts?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`)
    assert.equal(response.status, 200)
    items.push(...response.body.items)
    cursor = response.body.nextCursor
    pages++
  } while (cursor && pages < 50)
  return { items, pages }
}

describe('GET /api/workouts (history)', () => {
  it('returns every finished workout exactly once, newest first, across pages', async () => {
    const expected = (
      await app.db.execute({
        sql: 'select id from workouts where user_id = ? and finished_at is not null order by started_at desc, id desc',
        args: [userId],
      })
    ).rows.map((row) => Number(row.id))

    const { items, pages } = await allPages(7)
    assert.deepEqual(items.map((w: { id: number }) => w.id), expected)
    assert.equal(pages, Math.ceil(expected.length / 7))
  })

  it('defaults to pages of 20', async () => {
    const response = await client.get('/api/workouts')
    assert.equal(response.body.items.length, 20)
    assert.ok(response.body.nextCursor)
  })

  it('includes totals and exercise names', async () => {
    const { items } = await allPages(50)
    const day0 = items.find((w: { id: number }) => w.id === workoutIds[0])
    assert.equal(day0.setCount, 3)
    assert.equal(day0.exerciseCount, 2)
    assert.equal(day0.volumeKg, 1640)
    assert.deepEqual(day0.exercises, ['Bench Press', 'Back Squat'])
  })

  it('only shows your own workouts', async () => {
    const other = await registerUser(app, 'other')
    assert.deepEqual((await other.client.get('/api/workouts')).body, { items: [], nextCursor: null })
  })

  it('rejects invalid paging parameters', async () => {
    for (const query of ['limit=0', 'limit=51', 'limit=abc', 'cursor=abc']) {
      assert.equal((await client.get(`/api/workouts?${query}`)).status, 400, query)
    }
  })
})

describe('GET /api/progress', () => {
  it('lists trained exercises, most recently trained first', async () => {
    const response = await client.get('/api/progress')
    assert.deepEqual(
      response.body.map((e: { name: string }) => e.name),
      ['Push-up', 'Bench Press', 'Back Squat'],
    )
  })

  it('returns one point per workout with estimated 1RM and records', async () => {
    const { body } = await client.get(`/api/progress/${ids['Bench Press']}`)
    assert.equal(body.exercise.name, 'Bench Press')
    assert.equal(body.points.length, 25)

    const [day0, day1] = body.points
    // Epley: 100 × (1 + 5/30) = 116.67, rounded to 116.7
    assert.deepEqual(
      { sets: day0.sets, max: day0.maxWeightKg, e1rm: day0.estimated1RmKg, volume: day0.volumeKg, reps: day0.totalReps },
      { sets: 2, max: 100, e1rm: 116.7, volume: 1000, reps: 10 },
    )
    // A single rep counts as-is: 120 × 1 → 120
    assert.equal(day1.estimated1RmKg, 120)

    assert.equal(body.records.maxWeightKg.value, 120)
    assert.equal(body.records.maxWeightKg.workoutId, workoutIds[1])
    assert.equal(body.records.volumeKg.value, 1000)
  })

  it('has no weight records for bodyweight exercises', async () => {
    const { body } = await client.get(`/api/progress/${ids['Push-up']}`)
    assert.equal(body.records.maxWeightKg, null)
    assert.equal(body.records.totalReps.value, 35)
  })

  it('ignores the workout in progress', async () => {
    const { body } = await client.get(`/api/progress/${ids['Deadlift']}`)
    assert.deepEqual(body.points, [])
  })

  it("returns 404 for another user's custom exercise", async () => {
    const other = await registerUser(app, 'other')
    const custom = (await other.client.post('/api/exercises', { name: 'Private Move', muscleGroup: 'core' })).body
    assert.equal((await client.get(`/api/progress/${custom.id}`)).status, 404)
  })
})

describe('history and progress pages', () => {
  it('render on the server', async () => {
    const history = await client.page('/history')
    assert.equal(history.status, 200)
    assert.match(history.body, /History/)

    const progress = await client.page(`/progress?exercise=${ids['Bench Press']}`)
    assert.equal(progress.status, 200)
    assert.match(progress.body, /Recent sessions/)
  })
})
