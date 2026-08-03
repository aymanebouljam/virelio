import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyResponse, installFetchMock, jsonResponse } from './test-http'

const testUrl = 'https://api.example.test/'

describe('apiConfig', () => {
  let fetchMock: ReturnType<typeof installFetchMock>
  let apiConfig: typeof import('@/lib/api').apiConfig
  let setAccessToken: typeof import('@/lib/auth/storage').setAccessToken

  beforeEach(async () => {
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE_URL', testUrl)
    localStorage.clear()
    fetchMock = installFetchMock()
    const apiModule = await import('@/lib/api')
    const authStorage = await import('@/lib/auth/storage')
    apiConfig = apiModule.apiConfig
    setAccessToken = authStorage.setAccessToken
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('builds expense filter query parameters', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))

    await apiConfig({
      path: 'expenses',
      queryParams: {
        search: 'office supplies',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      },
    })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      new URL('expenses?search=office+supplies&dateFrom=2026-01-01&dateTo=2026-01-31', testUrl),
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
    )
  })

  it('builds resource action paths', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'vendor-1' }))

    await apiConfig({
      path: 'vendors',
      id: 'vendor-1',
      action: 'archive',
      method: 'PATCH',
    })

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      new URL('vendors/vendor-1/archive', testUrl),
      {
        method: 'PATCH',
        headers: { Accept: 'application/json' },
      },
    )
  })

  it('serializes JSON bodies and attaches the stored bearer token', async () => {
    setAccessToken('test-token')
    fetchMock.mockResolvedValue(jsonResponse({ id: 'vendor-1' }))

    await apiConfig({
      path: 'vendors',
      method: 'POST',
      input: { name: 'Atlas' },
    })

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(new URL('vendors', testUrl), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Atlas' }),
    })
  })

  it('sends form data without overriding its content type', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'proof-1' }))
    const input = new FormData()
    input.set('file', new Blob(['proof']), 'proof.txt')

    await apiConfig({ path: 'expenses/expense-1/proofs', method: 'POST', input })

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      new URL('expenses/expense-1/proofs', testUrl),
      {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: input,
      },
    )
  })

  it('maps structured validation failures to field errors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          message: 'Validation failed',
          errors: [
            {
              field: 'name',
              constraints: { isNotEmpty: 'name should not be empty' },
            },
          ],
        },
        400,
      ),
    )
    await expect(apiConfig({ path: 'vendors' })).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Invalid form input',
      content: { name: 'Name should not be empty' },
    })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(new URL('vendors', testUrl), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
  })

  it('returns blobs and empty responses in their requested shapes', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('proof contents'))
      .mockResolvedValueOnce(emptyResponse())
    const blob = await apiConfig({ path: 'proof', responseType: 'blob' })
    await expect((blob as Blob).text()).resolves.toBe('proof contents')
    await expect(apiConfig({ path: 'vendors/vendor-1', method: 'DELETE' })).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(1, new URL('proof', testUrl), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, new URL('vendors/vendor-1', testUrl), {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    })
  })
})
