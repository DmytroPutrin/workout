import type { H3Event } from 'h3'
import { z } from 'zod'

/**
 * Reads the JSON body and validates it with a Zod schema.
 * On failure, throws a 400 whose body the client can show directly:
 *   { message: "first problem", data: { fieldErrors: { email: ["..."] } } }
 */
export async function readBodyWith<T extends z.ZodType>(event: H3Event, schema: T): Promise<z.output<T>> {
  const body = await readBody(event).catch(() => undefined)
  const result = schema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0]?.message ?? 'Invalid request body',
      data: { fieldErrors: z.flattenError(result.error).fieldErrors },
    })
  }
  return result.data
}
