import { describe, expect, it } from 'vitest'
import { formatNumberTr, trSlug } from './index'

describe('trSlug', () => {
  it('transliterates Turkish characters', () => {
    expect(trSlug('İstasyon Şubesi')).toBe('istasyon-subesi')
  })
  it('collapses non-alphanumerics', () => {
    expect(trSlug('Hat 123 - Güzergah!')).toBe('hat-123-guzergah')
  })
})

describe('formatNumberTr', () => {
  it('formats with Turkish separators', () => {
    const out = formatNumberTr(1234.5)
    expect(out).toMatch(/1\.234/)
  })
})
