import { describe, expect, it } from 'vitest'

describe('test harness sanity', () => {
  it('runs basic assertions', () => {
    expect(2 + 2).toBe(4)
  })

  it('supports async', async () => {
    const value = await Promise.resolve('ok')
    expect(value).toBe('ok')
  })
})
