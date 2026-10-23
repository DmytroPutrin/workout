/**
 * True when a database error is a UNIQUE constraint violation.
 * Drizzle wraps driver errors, so check the error and its cause.
 */
export function isUniqueViolation(error: unknown): boolean {
  const messages: string[] = []
  let current: unknown = error
  while (current instanceof Error) {
    messages.push(current.message)
    current = current.cause
  }
  return messages.some((message) => message.includes('UNIQUE constraint failed'))
}
