import { describe, expect, it } from 'vitest'
import { bbox, haversineDistance } from './index'

describe('haversineDistance', () => {
  it('returns 0 for the same point', () => {
    expect(haversineDistance({ lat: 0, lon: 0 }, { lat: 0, lon: 0 })).toBe(0)
  })
  it('returns ~111km for 1 degree of latitude at the equator', () => {
    const d = haversineDistance({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })
    expect(d).toBeGreaterThan(110_000)
    expect(d).toBeLessThan(112_000)
  })
})

describe('bbox', () => {
  it('handles a list of points', () => {
    const b = bbox([
      { lat: 1, lon: 2 },
      { lat: 3, lon: 4 },
    ])
    expect(b).toEqual({ minLat: 1, minLon: 2, maxLat: 3, maxLon: 4 })
  })
})
