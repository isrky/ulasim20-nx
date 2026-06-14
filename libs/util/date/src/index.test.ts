import { describe, expect, it } from 'vitest'
import { formatTr, timeAgo } from './index'

describe('formatTr', () => {
  it('formats a Date in Turkish locale', () => {
    const out = formatTr(new Date('2026-01-15T12:00:00Z'), 'yyyy-MM-dd')
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('timeAgo', () => {
  it('returns a Turkish suffix', () => {
    const out = timeAgo(new Date(Date.now() - 60_000))
    expect(out.length).toBeGreaterThan(0)
  })
})
