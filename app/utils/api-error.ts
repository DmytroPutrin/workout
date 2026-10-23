type ApiErrorBody = {
  message?: string
  data?: { fieldErrors?: Record<string, string[] | undefined> }
}

/** Pulls the human-readable message out of an error thrown by $fetch. */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  const body = (error as { data?: ApiErrorBody } | null)?.data
  return body?.message || fallback
}

/** Per-field messages from a 400 validation error, e.g. { email: 'Enter a valid email address' }. */
export function getApiFieldErrors(error: unknown): Record<string, string> {
  const fieldErrors = (error as { data?: ApiErrorBody } | null)?.data?.data?.fieldErrors ?? {}
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .filter(([, messages]) => messages?.length)
      .map(([field, messages]) => [field, messages![0]!]),
  )
}

/**
 * Only allow redirects to paths inside this app. Without this check,
 * /login?redirect=https://evil.example would send users off-site after login
 * (an "open redirect"). "//evil.example" is also an absolute URL, so reject it too.
 */
export function safeRedirect(target: unknown, fallback = '/') {
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : fallback
}
