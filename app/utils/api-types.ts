import type { InternalApi } from 'nitropack'

// Response types inferred from the server route files (see .nuxt/types/nitro-routes.d.ts).
// Change a route's return value and every component using these types is re-checked.

export type WorkoutListPage = InternalApi['/api/workouts']['get']
export type WorkoutListItem = WorkoutListPage['items'][number]

export type ProgressExercise = InternalApi['/api/progress']['get'][number]
export type ExerciseProgress = InternalApi['/api/progress/:exerciseId']['get']
export type ProgressPoint = ExerciseProgress['points'][number]
