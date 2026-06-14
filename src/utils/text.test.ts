import { describe, expect, it } from 'vitest'
import { cleanLineCode, cleanLineName, foldTR } from './text'

describe('foldTR', () => {
  it('normalizes Turkish text for search', () => {
    expect(foldTR('Çalışkan Ördek')).toBe('caliskan ordek')
  })
})

describe('cleanLineCode', () => {
  it('retains normal line codes', () => {
    expect(cleanLineCode('150')).toBe('150')
  })

  it('removes trailing D direction suffix', () => {
    expect(cleanLineCode('150D')).toBe('150')
    expect(cleanLineCode('110D')).toBe('110')
  })

  it('correctly handles unusual naming with trailing hyphens like 150G-D', () => {
    expect(cleanLineCode('150G-D')).toBe('150G')
  })
})

describe('cleanLineName', () => {
  it('cleans normal line names by stripping prefixed code and formatting', () => {
    expect(cleanLineName('150/ OTOGAR-ULUS CAD.-ÜNİVERSİTE', '150')).toBe(
      'OTOGAR - ULUS CAD. - ÜNİVERSİTE',
    )
  })

  it('cleans names with D suffix', () => {
    expect(cleanLineName('150D/ ÜNİVERSİTE-ULUS CAD.-OTOGAR', '150D')).toBe(
      'ÜNİVERSİTE - ULUS CAD. - OTOGAR',
    )
  })

  it('cleans names for unusual naming like 150G-D', () => {
    expect(cleanLineName('150-G-D/ OTOGAR-ÜNİVERSİTE', '150G-D')).toBe('OTOGAR - ÜNİVERSİTE')
  })
})
