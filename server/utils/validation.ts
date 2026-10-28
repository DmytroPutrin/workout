import type { H3Event } from 'h3'
import { z } from 'zod'

/**
 * Reads the JSON body and validates it with a Zod schema.
 * On failure, throws a 400 whose body the client can show directly:
 *   { message: "first problem", data: { fieldErrors: { email: ["..."] } } }
 */
export async function readBodyWith<T extends z.ZodType>(event: H3Event, schema: T): Promise<z.output<T>> {
  const body = await readBody(event).catch(() => undefined)
  return parseOrThrow(schema, body, 'Invalid request body')
}

/**
 * Validates the query string (?limit=20&cursor=…) the same way.
 * Query values always arrive as strings, so numeric fields need z.coerce.
 */
export function getQueryWith<T extends z.ZodType>(event: H3Event, schema: T): z.output<T> {
  return parseOrThrow(schema, getQuery(event), 'Invalid query parameters')
}

function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown, fallback: string): z.output<T> {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0]?.message ?? fallback,
      data: { fieldErrors: z.flattenError(result.error).fieldErrors },
    })
  }
  return result.data
}
