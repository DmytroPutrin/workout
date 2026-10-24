import type { H3Event } from 'h3'
import { z } from 'zod'

const idSchema = z.coerce.number().int().positive()

/**
 * Reads a numeric route param such as the `[id]` in server/api/workouts/[id].get.ts.
 * Route params always arrive as strings; anything that isn't a positive integer is a 400.
 */
export function getIdParam(event: H3Event, name = 'id'): number {
  const result = idSchema.safeParse(getRouterParam(event, name))
  if (!result.success) {
    throw createError({ statusCode: 400, message: `Invalid ${name}` })
  }
  return result.data
}
