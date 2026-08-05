import { getAccessToken } from './auth/storage'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

// Types
type FieldError = {
  field: string
  constraints?: Record<string, string>
}

type ApiErrorResponse = {
  message?: string
  errors?: FieldError[]
}

export type PaginatedResponse<T> = {
  items: T[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

// Helpers

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly content: Record<string, string> | null = null,
  ) {
    super(message.charAt(0).toUpperCase() + message.slice(1))
    this.name = 'ApiError'
  }
}

function getApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is not configured')
  }

  return API_BASE_URL.replace(/\/$/, '')
}

async function validateResponse(response: Response) {
  if (response.status === 204) {
    return null
  }
  const body: unknown = await response.json().catch(() => null)
  if (body === null || typeof body !== 'object') {
    throw new Error('Response body is not a valid JSON object or array')
  }
  return body
}

function parseError(body: ApiErrorResponse | null) {
  let message = 'Something went wrong'
  if (body === null) throw new ApiError(message)
  if (!Array.isArray(body.errors) || body.errors.length === 0) {
    if (typeof body.message === 'string' && body.message.length > 0) {
      message = body.message
    }
    throw new ApiError(message)
  } else {
    const isEntry = (value: [string, string] | null) => value !== null
    const content = Object.fromEntries(
      body.errors
        .map((err): [string, string] | null => {
          if (typeof err.field !== 'string' || err.field.length === 0) {
            return null
          }
          const message = Object.values(err.constraints ?? {})[0] ?? `Invalid ${err.field} value`
          return [err.field, message.charAt(0).toUpperCase() + message.slice(1)]
        })
        .filter(isEntry),
    )

    throw new ApiError('Invalid form input', content)
  }
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
const METHODS_WITH_BODY: HttpMethod[] = ['POST', 'PUT', 'PATCH']

type ApiConfigOptions = {
  path?: string
  method?: HttpMethod
  input?: Record<string, unknown> | FormData
  id?: string
  action?: string
  queryParams?: Record<string, string | number | boolean>
  responseType?: 'json' | 'blob'
}

type FetchConfig = {
  method: HttpMethod
  headers: {
    Accept: string
    Authorization?: string
    'Content-Type'?: string
  }
  body?: string | FormData
}

export async function apiConfig({
  path = '',
  method = 'GET',
  input,
  id,
  action,
  queryParams,
  responseType = 'json',
}: ApiConfigOptions = {}) {
  const url = new URL(`${getApiBaseUrl()}/${path.replace(/^\/+/, '')}`)
  if (id !== undefined) {
    url.pathname += `/${encodeURIComponent(id)}`
  }
  if (action !== undefined) {
    url.pathname += `/${encodeURIComponent(action)}`
  }
  if (queryParams !== undefined) {
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, String(value))
    }
  }

  const config: FetchConfig = {
    method,
    headers: {
      Accept: 'application/json',
    },
  }

  if (input !== undefined && METHODS_WITH_BODY.includes(method)) {
    if (input instanceof FormData) {
      config.body = input
    } else {
      config.headers['Content-Type'] = 'application/json'
      config.body = JSON.stringify(input)
    }
  }

  const accessToken = getAccessToken()
  if (accessToken) {
    config.headers['Authorization'] = `Bearer ${accessToken}`
  }

  const response = await fetch(url, config)

  if (!response.ok) {
    const body = (await validateResponse(response)) as ApiErrorResponse | null
    parseError(body)
  }

  if (responseType === 'blob') {
    return response.blob()
  }

  return validateResponse(response)
}
