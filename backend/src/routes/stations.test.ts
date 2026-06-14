import { SELF, fetchMock } from 'cloudflare:test'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const stationsFixture = {
  value: [
    {
      stationId: 1,
      stationName: 'Forum Çamlık',
      latitude: '37.770000',
      longitude: '29.080000',
      latitudeF: '37.77',
      longitudeF: '29.08',
      isActive: true,
      distance: 0,
    },
    {
      stationId: 2,
      stationName: 'Pamukkale Üniversitesi',
      latitude: '37.739000',
      longitude: '29.108000',
      latitudeF: '37.739',
      longitudeF: '29.108',
      isActive: true,
      distance: 0,
    },
  ],
}

beforeAll(() => {
  fetchMock.activate()
  fetchMock.disableNetConnect()
})

function stubStationsUpstream(times = 1) {
  for (let i = 0; i < times; i++) {
    fetchMock
      .get('https://upstream.test')
      .intercept({ path: '/UlasimBackend/api/Calc/GetAllStations' })
      .reply(200, JSON.stringify(stationsFixture), {
        headers: { 'content-type': 'application/json' },
      })
  }
}

beforeEach(() => {
  fetchMock.assertNoPendingInterceptors()
})

afterEach(() => {
  fetchMock.assertNoPendingInterceptors()
})

describe('GET /api/stations', () => {
  it('returns the list from upstream with count metadata', async () => {
    stubStationsUpstream()
    const res = await SELF.fetch('http://localhost/api/stations?refresh=true')
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      success: boolean
      count: number
      data: Array<{ stationId: number }>
    }
    expect(body.success).toBe(true)
    expect(body.count).toBe(2)
    expect(body.data.map((s) => s.stationId)).toEqual([1, 2])
  })

  it('propagates upstream failures as a 500 with an error body', async () => {
    fetchMock
      .get('https://upstream.test')
      .intercept({ path: '/UlasimBackend/api/Calc/GetAllStations' })
      .reply(502, 'bad gateway')

    const res = await SELF.fetch('http://localhost/api/stations?refresh=true')
    expect(res.status).toBe(500)
    const body = (await res.json()) as { success: boolean; error: string }
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/502/)
  })
})

describe('GET /api/stations/:id', () => {
  it('returns 400 for non-numeric ids', async () => {
    const res = await SELF.fetch('http://localhost/api/stations/not-a-number')
    expect(res.status).toBe(400)
  })
})
