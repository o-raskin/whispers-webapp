import type { ErrorResponse } from '../types/chat'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getHttpBaseUrl(serverUrl: string): string {
  const wsUrl = new URL(serverUrl)
  const protocol = wsUrl.protocol === 'wss:' ? 'https:' : 'http:'

  return `${protocol}//${wsUrl.host}`
}

export function buildUrl(
  serverUrl: string,
  path: string,
  params: Record<string, string | number | undefined> = {},
) {
  const url = new URL(path, getHttpBaseUrl(serverUrl))

  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== 'undefined') {
      url.searchParams.set(key, String(value))
    }
  }

  return url.toString()
}

export function buildJsonHeaders(
  accessToken?: string,
  options?: { contentType?: string },
) {
  return {
    Accept: 'application/json',
    ...(options?.contentType ? { 'Content-Type': options.contentType } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }
}

export async function parseJsonResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | ErrorResponse | null

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? payload.error
        : fallbackMessage

    throw new ApiError(message, response.status)
  }

  return payload as T
}
