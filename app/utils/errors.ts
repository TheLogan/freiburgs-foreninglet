import type { FetchError } from 'ofetch'

export function getFetchErrorMessage(
  error: unknown,
  fallback = 'Something went wrong.',
): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const err = error as FetchError<{ message?: string }>
    return err.data?.message ?? err.statusMessage ?? fallback
  }
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}
