export const API_BASE = '/api'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: Record<string, string> | null

  constructor(
    status: number,
    code: string,
    message: string,
    fields: Record<string, string> | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

interface ErrorBody {
  code?: unknown
  message?: unknown
  fields?: unknown
}

function isFieldMap(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((entry) => typeof entry === 'string')
  )
}

/**
 * Runs a request against the API and resolves with the parsed JSON body.
 *
 * `path` is relative to the API base (`/api`), so `apiFetch<Room[]>('/rooms')`
 * requests `/api/rooms`. A 204 response resolves with `undefined`. Every
 * non-success response is turned into an `ApiError` carrying the uniform error
 * body ({ code, message, fields }).
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('/') ? `${API_BASE}${path}` : `${API_BASE}/${path}`
  const headers = new Headers(init?.headers)
  if (init?.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(url, { ...init, headers })
  } catch {
    throw new ApiError(0, 'network_error', 'Der Server ist nicht erreichbar.', null)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const raw = await response.text()
  let parsed: unknown = null
  if (raw.length > 0) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
  }

  if (response.ok) {
    return parsed as T
  }

  const body = (parsed ?? {}) as ErrorBody
  const code = typeof body.code === 'string' ? body.code : 'unknown_error'
  const message =
    typeof body.message === 'string'
      ? body.message
      : `Anfrage fehlgeschlagen (${response.status}).`
  const fields = isFieldMap(body.fields) ? body.fields : null
  throw new ApiError(response.status, code, message, fields)
}
