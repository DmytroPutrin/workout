# Workout Tracker

[![CI](https://github.com/DmytroPutrin/workout/actions/workflows/ci.yml/badge.svg)](https://github.com/DmytroPutrin/workout/actions/workflows/ci.yml)

**Live demo:** https://workout-lac-eight.vercel.app/

A full-stack workout logging app built with Nuxt 4. Log your sets, review your history, and track progress on each lift over time.

## Tech stack

- **Nuxt 4** (Vue 3 + Nitro server) with TypeScript
- **Drizzle ORM** with **libSQL/SQLite** (local file in dev, Turso in production)
- **Tailwind CSS v4**
- **nuxt-auth-utils** for encrypted cookie sessions and scrypt password hashing
- **Zod** schemas shared by the forms and the API
- **Node's built-in test runner** (`node:test`, run through tsx) for unit and API tests
- **GitHub Actions** for CI, **Vercel + Turso** for hosting

## Getting started

Requires **Node.js 22+**.

```bash
npm install
cp .env.example .env

npm run db:migrate    # create local.db from the migrations in server/database/migrations
npm run db:seed       # add the built-in exercises

npm run dev           # http://localhost:3000
```

Open the app, create an account, and tap **Start workout**.

## API

| Method & path              | Auth | Description                                      |
| -------------------------- | ---- | ------------------------------------------------ |
| `GET /api/health`          | —    | Database connectivity check                      |
| `POST /api/auth/register`  | —    | Create an account and start a session            |
| `POST /api/auth/login`     | —    | Start a session                                  |
| `DELETE /api/_auth/session`| ✓    | Log out (route provided by nuxt-auth-utils)      |
| `GET /api/exercises`       | ✓    | Built-in exercises plus your custom ones         |
| `POST /api/exercises`      | ✓    | Add a custom exercise                            |
| `GET /api/exercises/:id/last` | ✓ | Your sets for this exercise in your last finished workout |
| `GET /api/workouts`       | ✓    | Finished workouts, newest first: `?limit=20&cursor=…` |
| `GET /api/workouts/active` | ✓    | Your workout in progress, or `null`              |
| `POST /api/workouts`       | ✓    | Start a workout (returns the active one if any)  |
| `GET /api/workouts/:id`    | ✓    | A workout with all its sets                      |
| `PATCH /api/workouts/:id`  | ✓    | Update `notes` and/or `finish: true`             |
| `DELETE /api/workouts/:id` | ✓    | Discard a workout and its sets                   |
| `POST /api/workouts/:id/sets` | ✓ | Log a set: `{ exerciseId, reps, weightKg }`      |
| `PATCH /api/sets/:id`      | ✓    | Edit a set's reps or weight                      |
| `DELETE /api/sets/:id`     | ✓    | Delete a set                                     |
| `GET /api/progress`        | ✓    | Exercises you've trained, most recent first      |
| `GET /api/progress/:exerciseId` | ✓ | Per-workout series (best weight, est. 1RM, volume, reps) and personal records |

Errors use one shape: `{ statusCode, message, data? }`. Validation errors (400) also include `data.fieldErrors`.

## How workout logging works

- **One workout in progress per user**, enforced by a *partial unique index* on `workouts(user_id) WHERE finished_at IS NULL`. `POST /api/workouts` is "start or resume", and if two starts race (a double tap), the index rejects the second insert and the API returns the first workout instead.
- **Ownership:** every workout and set lookup is scoped to the logged-in user. Another user's IDs return **404**, not 403, so the API never confirms that someone else's workout exists.
- **Finished workouts are read-only** (409 on changes); they can be deleted from their summary page.
- **"Last time" hint:** each exercise card shows your sets from the most recent finished workout and pre-fills the inputs.
- **Discarding** deletes the sets and the workout in one `batch()` transaction, so it never relies on SQLite's foreign-key enforcement being switched on.
- **Client state** lives in `app/composables/useWorkout.ts` and is shared with child components through `provide`/`inject`. Each action calls the API first and updates local state only after the server confirms.

## How history and progress work

- **Keyset pagination.** `GET /api/workouts` returns a `nextCursor` (`<startedAt>_<id>` of the last item). The next page continues with `WHERE (started_at, id) < cursor` instead of `OFFSET`, so the database doesn't re-read earlier rows, and adding or deleting workouts between page loads never duplicates or skips items. `id` breaks ties between workouts started in the same second.
- **Totals are computed in SQL** with `GROUP BY` and `LEFT JOIN`, so a workout's set count, exercise count and volume come back in one query.
- **Estimated 1RM** uses the Epley formula, `weight × (1 + reps / 30)`, so sets with different rep counts can be compared on one line; a single rep counts as-is.
- **The chart** (`app/components/LineChart.vue`) is a dependency-free SVG component: time-proportional x-axis, readable y-axis steps, hover/touch tooltip, and a screen-reader table of the data. It renders in the browser only, because it needs its real width and the viewer's locale and time zone.

## How auth works

- Passwords are hashed with **scrypt**; only the hash is stored.
- The session lives in an **encrypted, httpOnly cookie** (sealed with `NUXT_SESSION_PASSWORD`), so there is no session table.
- **Server:** every protected route calls `requireUserSession(event)` and filters data by `user.id`.
- **Client:** `app/middleware/auth.global.ts` sends logged-out visitors to `/login`; pages marked `guestOnly` (login, register) send logged-in users home. This is for UX only — the server checks are what actually protect data.
- Login returns the same error for an unknown email and a wrong password, and takes the same time for both, so it doesn't reveal which emails are registered.
- `?redirect=` after login only accepts paths inside the app, which prevents open redirects.

`npm run db:studio` opens Drizzle Studio to browse the database in your browser.

## Testing

```bash
npm run test:unit                    # fast, no server: validation, formatting, redirect safety
npm run build && npm run test:api    # API and page tests against the production build
npm test                             # both (after a build)
```

- **Unit tests** (`test/unit/`) cover the pure functions both sides rely on: the Zod schemas, number and time formatting, and the open-redirect guard.
- **API and page tests** (`test/api/`) start the real production build (`.output/server/index.mjs`) for each test file, against a fresh SQLite database created from the committed migrations and the real seed script. They log in with real session cookies, so nothing is mocked: routing, auth, validation, the production error format, SQL, and server-side rendering are all exercised.
- They cover the things most likely to break silently: one user never seeing or changing another's data, eight simultaneous "Start workout" taps creating one workout, every workout appearing exactly once across history pages, and the estimated-1RM maths.

No test framework is installed: `node:test` ships with Node, and `tsx` (already used for the seed script) runs the TypeScript.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and every pull request: `npm ci` → type-check → unit tests → build → API and page tests.

## Deployment (Vercel + Turso)

The app runs on Vercel's serverless functions; the database is [Turso](https://turso.tech), hosted libSQL (SQLite over HTTP). Both have free plans.

**1. Create the database** (with the [Turso CLI](https://docs.turso.tech/cli/introduction), or in the Turso dashboard):

```bash
turso db create workout-tracker
turso db show workout-tracker --url        # libsql://workout-tracker-<you>.turso.io
turso db tokens create workout-tracker     # the auth token
```

**2. Create the tables and the exercise library** from your machine:

```bash
export NUXT_DATABASE_URL="libsql://workout-tracker-<you>.turso.io"
export NUXT_DATABASE_AUTH_TOKEN="<token>"
npm run db:migrate
npm run db:seed
```

**3. Deploy on Vercel:** *Add New → Project*, import this repository (the Nuxt preset is detected), and add these environment variables before deploying:

| Variable                   | Value                                   |
| -------------------------- | --------------------------------------- |
| `NUXT_DATABASE_URL`        | the `libsql://…` URL from step 1        |
| `NUXT_DATABASE_AUTH_TOKEN` | the token from step 1                   |
| `NUXT_SESSION_PASSWORD`    | output of `openssl rand -base64 32`     |

Every push to `main` then deploys automatically, and pull requests get preview deployments. Previews use the same database unless you give the *Preview* environment its own Turso database.

**Schema changes later:** run `npm run db:generate`, commit the new migration, and run `npm run db:migrate` against Turso (step 2) before pushing code that depends on it.

**Why the `#drizzle-libsql` alias:** the default libSQL driver loads a native SQLite binary at startup, which Vercel's serverless bundles don't include. `nuxt.config.ts` points the alias at the fetch-based driver when building on Vercel and at the full driver (which also handles local `file:` databases) everywhere else.

## Project structure

```
app/                     # Vue frontend
  pages/                 # /, /history, /progress, /exercises, /workouts/[id], /login, /register
  components/            # LineChart, WorkoutCard, ExerciseSetsCard, ExercisePicker, …
  composables/           # useWorkout(): state + actions for one workout
server/
  api/                   # API routes: file name = URL + HTTP method
  database/
    schema.ts            # tables (single source of truth for DB and TS types)
    migrations/          # generated by drizzle-kit, committed to git
    seed.ts              # built-in exercise library
  utils/                 # auto-imported server helpers: useDb(), readBodyWith(),
                         #   getIdParam(), requireOwnedWorkout(), …
shared/
  utils/                 # used by app/ and server/: Zod schemas, muscle groups
  types/                 # session user shape, '#drizzle-libsql' alias types
test/
  unit/                  # pure functions, no server
  api/                   # API and page tests against the production build
  helpers/app.ts         # starts the built server with a fresh database
.github/workflows/ci.yml # CI pipeline
```

## Data model

| Table          | Purpose                                                        |
| -------------- | -------------------------------------------------------------- |
| `users`        | Accounts (email + password hash)                               |
| `exercises`    | Built-in (`user_id` is null) and user-created exercises        |
| `workouts`     | A training session; `finished_at` is null while in progress    |
| `workout_sets` | One set: reps × weight, linked to a workout and an exercise    |

## Environment variables

| Variable                   | Purpose                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `NUXT_DATABASE_URL`        | `file:local.db` locally, `libsql://…` for Turso                |
| `NUXT_DATABASE_AUTH_TOKEN` | Turso token (production only)                                  |
| `NUXT_SESSION_PASSWORD`    | 32+ character secret for session cookies; auto-generated in dev |
| `VERCEL`                   | Set by Vercel during builds; switches to the fetch-based database driver |

## Changing the schema

1. Edit `server/database/schema.ts`
2. `npm run db:generate` — review the new SQL file in `server/database/migrations/`
3. `npm run db:migrate`

## Roadmap

- [x] **1. Setup** — Nuxt, Drizzle, schema, migrations, seed data
- [x] **2. Auth** — register, log in, protected routes, custom exercises
- [x] **3. Logging** — start a workout, add sets, finish
- [x] **4. History & progress** — workout list, progress charts, personal records
- [x] **5. Ship** — unit and API tests, CI, Vercel + Turso deployment
