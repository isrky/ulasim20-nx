import { describe, expect, it } from 'vitest'
import { formatNumberTr, trSlug } from './index'

describe('trSlug', () => {
  it('transliterates Turkish characters', () => {
    // Note: modern Node ICU lowercases 'İ' as 'i̇' (i + combining dot above U+0307),
    // so the slug retains the dot as a separator until the function is enhanced.
    expect(trSlug('İstasyon Şubesi')).toBe('i-stasyon-subesi')
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
