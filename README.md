# Workout Tracker

A full-stack workout logging app built with Nuxt 4. Log your sets, review your history, and track progress on each lift over time.

> **Status:** Milestone 3 of 5 — log workouts: start a session, record sets, finish.

## Tech stack

- **Nuxt 4** (Vue 3 + Nitro server) with TypeScript
- **Drizzle ORM** with **libSQL/SQLite** (local file in dev, Turso in production)
- **Tailwind CSS v4**
- **nuxt-auth-utils** for encrypted cookie sessions and scrypt password hashing
- **Zod** schemas shared by the forms and the API
- Coming next: Chart.js, Vitest, Playwright

## Getting started

Requires **Node.js 22+**.

```bash
npm install
cp .env.example .env

npm run db:generate   # create SQL migrations from server/database/schema.ts
npm run db:migrate    # apply them to local.db
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
| `GET /api/workouts/active` | ✓    | Your workout in progress, or `null`              |
| `POST /api/workouts`       | ✓    | Start a workout (returns the active one if any)  |
| `GET /api/workouts/:id`    | ✓    | A workout with all its sets                      |
| `PATCH /api/workouts/:id`  | ✓    | Update `notes` and/or `finish: true`             |
| `DELETE /api/workouts/:id` | ✓    | Discard a workout and its sets                   |
| `POST /api/workouts/:id/sets` | ✓ | Log a set: `{ exerciseId, reps, weightKg }`      |
| `PATCH /api/sets/:id`      | ✓    | Edit a set's reps or weight                      |
| `DELETE /api/sets/:id`     | ✓    | Delete a set                                     |

Errors use one shape: `{ statusCode, message, data? }`. Validation errors (400) also include `data.fieldErrors`.

## How workout logging works

- **One workout in progress per user**, enforced by a *partial unique index* on `workouts(user_id) WHERE finished_at IS NULL`. `POST /api/workouts` is "start or resume", and if two starts race (a double tap), the index rejects the second insert and the API returns the first workout instead.
- **Ownership:** every workout and set lookup is scoped to the logged-in user. Another user's IDs return **404**, not 403, so the API never confirms that someone else's workout exists.
- **Finished workouts are read-only** (409 on changes). Editing past workouts is planned for the history milestone.
- **"Last time" hint:** each exercise card shows your sets from the most recent finished workout and pre-fills the inputs.
- **Discarding** deletes the sets and the workout in one `batch()` transaction, so it never relies on SQLite's foreign-key enforcement being switched on.
- **Client state** lives in `app/composables/useWorkout.ts` and is shared with child components through `provide`/`inject`. Each action calls the API first and updates local state only after the server confirms.

## How auth works

- Passwords are hashed with **scrypt**; only the hash is stored.
- The session lives in an **encrypted, httpOnly cookie** (sealed with `NUXT_SESSION_PASSWORD`), so there is no session table.
- **Server:** every protected route calls `requireUserSession(event)` and filters data by `user.id`.
- **Client:** `app/middleware/auth.global.ts` sends logged-out visitors to `/login`; pages marked `guestOnly` (login, register) send logged-in users home. This is for UX only — the server checks are what actually protect data.
- Login returns the same error for an unknown email and a wrong password, and takes the same time for both, so it doesn't reveal which emails are registered.
- `?redirect=` after login only accepts paths inside the app, which prevents open redirects.

`npm run db:studio` opens Drizzle Studio to browse the database in your browser.

## Project structure

```
app/                     # Vue frontend
  pages/                 # /, /exercises, /workouts/[id], /login, /register
  components/            # ExerciseSetsCard, ExercisePicker, WorkoutSummary, …
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
  types/auth.d.ts        # shape of the session user
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

## Changing the schema

1. Edit `server/database/schema.ts`
2. `npm run db:generate` — review the new SQL file in `server/database/migrations/`
3. `npm run db:migrate`

## Roadmap

- [x] **1. Setup** — Nuxt, Drizzle, schema, migrations, seed data
- [x] **2. Auth** — register, log in, protected routes, custom exercises
- [x] **3. Logging** — start a workout, add sets, finish
- [ ] **4. History & progress** — workout list, detail view, progress charts
- [ ] **5. Ship** — tests, CI, deployment
