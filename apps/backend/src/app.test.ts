import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

describe('Hono app — health', () => {
  it('GET / returns the healthy envelope', async () => {
    const res = await SELF.fetch('http://localhost/')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.service).toBe('ulasim-backend')
    expect(body.status).toBe('healthy')
    expect(typeof body.timestamp).toBe('string')
  })

  it('GET /api returns the healthy envelope', async () => {
    const res = await SELF.fetch('http://localhost/api')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.service).toBe('ulasim-backend')
  })

  it('GET /health returns { status: "ok" }', async () => {
    const res = await SELF.fetch('http://localhost/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string }
    expect(body.status).toBe('ok')
  })
})

describe('Hono app — CORS', () => {
  it('emits a wildcard Access-Control-Allow-Origin', async () => {
    const res = await SELF.fetch('http://localhost/api', {
      headers: { Origin: 'https://example.com' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('responds to preflight with allowed methods', async () => {
    const res = await SELF.fetch('http://localhost/api/stations', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    })
    expect(res.status).toBeLessThan(300)
    const allowMethods = res.headers.get('access-control-allow-methods') ?? ''
    expect(allowMethods).toMatch(/GET/i)
  })
})

describe('Hono app — errors', () => {
  it('returns a 404 JSON body for unknown paths', async () => {
    const res = await SELF.fetch('http://localhost/api/this-does-not-exist')
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string; path: string }
    expect(body.error).toBe('Not Found')
    expect(body.path).toBe('/api/this-does-not-exist')
  })
})
