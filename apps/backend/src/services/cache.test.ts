import { env } from 'cloudflare:test'
import { describe, expect, it, vi } from 'vitest'
import type { Env } from '../types'
import { CACHE_KEYS, CacheService } from './cache'

const testEnv = env as unknown as Env

describe('CacheService.set / get', () => {
  it('round-trips a value within the fresh window', async () => {
    const svc = new CacheService(testEnv)
    await svc.set('cache-test:rt:1', { hello: 'world' }, 60)
    const value = await svc.get<{ hello: string }>('cache-test:rt:1')
    expect(value).toEqual({ hello: 'world' })
  })

  it('returns null for missing keys', async () => {
    const svc = new CacheService(testEnv)
    expect(await svc.get('cache-test:missing')).toBeNull()
  })

  it('treats values past freshUntil as stale when using a 0-second TTL', async () => {
    const svc = new CacheService(testEnv)
    // 0 TTL is immediately stale in the fresh window; SWR window keeps it readable.
    await svc.set('cache-test:stale:now', { v: 'old' }, 0, { staleWhileRevalidateSeconds: 60 })

    // get() returns null because the entry is stale.
    expect(await svc.get('cache-test:stale:now')).toBeNull()

    // getWithStale exposes the stale data to callers opted into SWR.
    const stale = await svc.getWithStale<{ v: string }>('cache-test:stale:now')
    expect(stale).not.toBeNull()
    expect(stale?.isStale).toBe(true)
    expect(stale?.data).toEqual({ v: 'old' })
  })
})

describe('CacheService.delete', () => {
  it('removes a previously set value', async () => {
    const svc = new CacheService(testEnv)
    await svc.set('cache-test:del:1', { v: 1 }, 60)
    expect(await svc.get('cache-test:del:1')).toEqual({ v: 1 })
    await svc.delete('cache-test:del:1')
    expect(await svc.get('cache-test:del:1')).toBeNull()
  })
})

describe('CacheService.getOrSetSWR', () => {
  it('calls the loader on cache miss and caches the value', async () => {
    const svc = new CacheService(testEnv)
    const loader = vi.fn(async () => ({ computed: true }))

    const first = await svc.getOrSetSWR('cache-test:swr:1', {
      ttlSeconds: 60,
      loader,
    })

    expect(first).toEqual({ computed: true })
    expect(loader).toHaveBeenCalledTimes(1)

    const second = await svc.getOrSetSWR('cache-test:swr:1', {
      ttlSeconds: 60,
      loader,
    })
    expect(second).toEqual({ computed: true })
    expect(loader).toHaveBeenCalledTimes(1) // served fresh, no re-call
  })

  it('de-duplicates concurrent cache misses', async () => {
    const svc = new CacheService(testEnv)
    const loader = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 5))
      return { computed: 'once' }
    })

    const [a, b, c] = await Promise.all([
      svc.getOrSetSWR('cache-test:swr:dedupe', { ttlSeconds: 60, loader }),
      svc.getOrSetSWR('cache-test:swr:dedupe', { ttlSeconds: 60, loader }),
      svc.getOrSetSWR('cache-test:swr:dedupe', { ttlSeconds: 60, loader }),
    ])

    expect(a).toEqual({ computed: 'once' })
    expect(b).toEqual({ computed: 'once' })
    expect(c).toEqual({ computed: 'once' })
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('forceRefresh ignores the cache and re-invokes loader', async () => {
    const svc = new CacheService(testEnv)
    const loader1 = vi.fn(async () => ({ v: 1 }))
    await svc.getOrSetSWR('cache-test:swr:force', { ttlSeconds: 60, loader: loader1 })

    const loader2 = vi.fn(async () => ({ v: 2 }))
    const refreshed = await svc.getOrSetSWR('cache-test:swr:force', {
      ttlSeconds: 60,
      forceRefresh: true,
      loader: loader2,
    })

    expect(refreshed).toEqual({ v: 2 })
    expect(loader2).toHaveBeenCalledTimes(1)
  })
})

describe('CacheService.getTTL', () => {
  it('returns numeric env values with sensible fallbacks', () => {
    const svc = new CacheService(testEnv)
    expect(svc.getTTL('stations')).toBe(86400)
    expect(svc.getTTL('realtime')).toBe(10)
    expect(svc.getTTL('pharmacies')).toBe(3600)
  })
})

describe('CACHE_KEYS', () => {
  it('namespaces keys deterministically', () => {
    expect(CACHE_KEYS.STATIONS).toBe('stations:all')
    expect(CACHE_KEYS.ROUTE_STATIONS('120')).toBe('route:120:stations')
    expect(CACHE_KEYS.ROUTE_GEOMETRY('220')).toBe('route:220:geometry')
    expect(CACHE_KEYS.REALTIME_STATION_LINE(42, '120')).toBe('realtime:station:42:line:120')
    expect(CACHE_KEYS.FEEDBACK('abcdefghij01234')).toBe('feedback:abcdefghij01234')
  })
})
