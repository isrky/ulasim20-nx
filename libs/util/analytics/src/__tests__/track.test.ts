import { afterEach, describe, expect, it } from 'vitest'
import { installLocalStorageWith, installUmamiWindow } from '../../../../../tests/helpers/mockWindow'
import { trackLineLookup, trackStopLookup } from '../index'

afterEach(() => {
  // biome-ignore lint/performance/noDelete: clean removal from globalThis in test teardown
  delete (globalThis as Record<string, unknown>).window
  // biome-ignore lint/performance/noDelete: clean removal from globalThis in test teardown
  delete (globalThis as Record<string, unknown>).localStorage
})

describe('trackLineLookup', () => {
  it('emits a sanitised line_lookup event with card_type resolved from storage', () => {
    const { tracked } = installUmamiWindow()
    installLocalStorageWith(
      JSON.stringify([
        {
          cardType: 'ÖĞRENCİ',
          addedAt: '2026-04-10T10:00:00.000Z',
          lastUsedAt: '2026-04-12T10:00:00.000Z',
          mifareId: 'secret-card-id',
          citizenshipNumber: '11111111111',
          name: 'Ada',
        },
      ]),
    )

    trackLineLookup({ lineCode: '320', source: 'home_search' })

    expect(tracked).toHaveLength(1)
    expect(tracked[0]).toEqual({
      name: 'line_lookup',
      payload: {
        platform: 'web',
        line_code: '320',
        source: 'home_search',
        card_type: 'student',
      },
    })
  })

  it('does nothing (no throw) when umami is not loaded', () => {
    ;(globalThis as Record<string, unknown>).window = {}
    expect(() => trackLineLookup({ lineCode: '1', source: 'x' })).not.toThrow()
  })
})

describe('trackStopLookup', () => {
  it('emits stop_lookup with station_id and unknown card_type when storage empty', () => {
    const { tracked } = installUmamiWindow()
    installLocalStorageWith(null)

    trackStopLookup({ stationId: 42, source: 'map' })

    expect(tracked[0]).toEqual({
      name: 'stop_lookup',
      payload: {
        platform: 'web',
        station_id: 42,
        source: 'map',
        card_type: 'unknown',
      },
    })
  })

  it('swallows umami errors to avoid breaking product flows', () => {
    ;(globalThis as Record<string, unknown>).window = {
      umami: {
        track: () => {
          throw new Error('umami exploded')
        },
      },
    }
    installLocalStorageWith(null)

    expect(() => trackStopLookup({ stationId: 1, source: 'x' })).not.toThrow()
  })
})
