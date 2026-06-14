import { describe, expect, it, vi } from 'vitest'
import { ApiClient, ApiError } from './index'

describe('ApiClient', () => {
  it('performs a GET and returns JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    )
    const client = new ApiClient({ baseUrl: 'https://example.com', fetchImpl })
    const out = await client.get<{ ok: boolean }>('/health')
    expect(out).toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/health',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('throws ApiError on non-2xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }))
    const client = new ApiClient({ baseUrl: 'https://example.com', fetchImpl })
    await expect(client.get('/x')).rejects.toBeInstanceOf(ApiError)
  })
})
