import { describe, expect, it } from 'vitest'
import { sanitizeAnalyticsPayload } from '../index'

describe('sanitizeAnalyticsPayload', () => {
  it('drops sensitive keys and preserves safe ones (including nested)', () => {
    const result = sanitizeAnalyticsPayload({
      success: true,
      station_id: 123,
      line_code: '120',
      email: 'person@example.com',
      name: 'Ada',
      message: 'free text',
      mifareId: '1234567890',
      citizenshipNumber: '11111111111',
      lat: 37.77,
      lng: 29.08,
      nested: {
        route_count: 4,
        query: 'home address',
      },
    })

    expect(result).toEqual({
      success: true,
      station_id: 123,
      line_code: '120',
      nested: {
        route_count: 4,
      },
    })
  })

  it('returns undefined when payload is undefined', () => {
    expect(sanitizeAnalyticsPayload(undefined)).toBeUndefined()
  })

  it('preserves false boolean values', () => {
    expect(sanitizeAnalyticsPayload({ event: 'share', low_balance: false })).toEqual({
      event: 'share',
      low_balance: false,
    })
  })

  it('strips empty nested objects', () => {
    const result = sanitizeAnalyticsPayload({
      outer: 'keep',
      nested: { email: 'drop@me.com' },
    })
    expect(result).toEqual({ outer: 'keep' })
  })

  it('normalises key variations (underscore / casing) when matching sensitive list', () => {
    expect(
      sanitizeAnalyticsPayload({
        Mifare_Id: 'x',
        CITIZENSHIPNUMBER: 'y',
        'card id': 'z',
      }),
    ).toBeUndefined()
  })
})
