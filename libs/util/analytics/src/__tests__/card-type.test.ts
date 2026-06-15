import { describe, expect, it } from 'vitest'
import {
  normalizeAnalyticsCardType,
  resolveSavedCardAnalyticsCardType,
} from '../index'

describe('normalizeAnalyticsCardType', () => {
  it.each([
    ['ÖĞRENCİ', 'student'],
    ['ogrenci', 'student'],
    ['SİVİL', 'civil'],
    ['ENGELLİ', 'disabled'],
    ['65+', '65_plus'],
    ['Yaşlı', '65_plus'],
    ['unexpected upstream type', 'unknown'],
    ['', 'unknown'],
  ] as const)('maps %j → %s', (input, expected) => {
    expect(normalizeAnalyticsCardType(input)).toBe(expected)
  })

  it('returns "unknown" for undefined input', () => {
    expect(normalizeAnalyticsCardType(undefined)).toBe('unknown')
  })
})

describe('resolveSavedCardAnalyticsCardType', () => {
  it('returns "unknown" for empty list', () => {
    expect(resolveSavedCardAnalyticsCardType([])).toBe('unknown')
  })

  it('returns the card type for a single entry', () => {
    expect(
      resolveSavedCardAnalyticsCardType([
        { cardType: 'ÖĞRENCİ', addedAt: '2026-04-10T10:00:00.000Z' },
      ]),
    ).toBe('student')
  })

  it('prefers the most recently used card', () => {
    expect(
      resolveSavedCardAnalyticsCardType([
        {
          cardType: 'ÖĞRENCİ',
          addedAt: '2026-04-10T10:00:00.000Z',
          lastUsedAt: '2026-04-11T10:00:00.000Z',
        },
        {
          cardType: 'SİVİL',
          addedAt: '2026-04-12T10:00:00.000Z',
          lastUsedAt: '2026-04-12T12:00:00.000Z',
        },
      ]),
    ).toBe('civil')
  })

  it('falls back to addedAt when lastUsedAt missing', () => {
    expect(
      resolveSavedCardAnalyticsCardType([
        { cardType: 'ÖĞRENCİ', addedAt: '2026-04-10T10:00:00.000Z' },
        { cardType: 'ENGELLİ', addedAt: '2026-04-12T10:00:00.000Z' },
      ]),
    ).toBe('disabled')
  })
})
