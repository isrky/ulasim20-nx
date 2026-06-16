import { env, fetchMock } from 'cloudflare:test'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../types'
import { DenizliApiClient } from './denizli-api'

const testEnv = env as unknown as Env

const stationsFixture = {
  value: [
    {
      stationId: 1,
      stationName: 'Forum Çamlık',
      latitude: '37.7',
      longitude: '29.1',
      latitudeF: '37.7',
      longitudeF: '29.1',
      isActive: true,
      distance: 0,
    },
  ],
}

const routesFixture = {
  value: [{ lineCode: '120', lineNo: 120, lineName: 'Merkez - Pamukkale', shortLineName: '120' }],
}

beforeAll(() => {
  fetchMock.activate()
  fetchMock.disableNetConnect()
})

beforeEach(() => {
  fetchMock.assertNoPendingInterceptors()
})

afterEach(() => {
  fetchMock.assertNoPendingInterceptors()
})

describe('DenizliApiClient.getAllStations', () => {
  it('fetches and returns station list from upstream', async () => {
    fetchMock
      .get('https://upstream.test')
      .intercept({ path: '/UlasimBackend/api/Calc/GetAllStations' })
      .reply(200, JSON.stringify(stationsFixture), {
        headers: { 'content-type': 'application/json' },
      })

    const client = new DenizliApiClient({ ...testEnv, UPSTREAM_API: 'https://upstream.test' })
    const result = await client.getAllStations(true)

    expect(result).toHaveLength(1)
    expect(result[0].stationName).toBe('Forum Çamlık')
  })

  it('returns an empty array when upstream value is missing', async () => {
    fetchMock
      .get('https://upstream.test')
      .intercept({ path: '/UlasimBackend/api/Calc/GetAllStations' })
      .reply(200, JSON.stringify({}), {
        headers: { 'content-type': 'application/json' },
      })

    const client = new DenizliApiClient({ ...testEnv, UPSTREAM_API: 'https://upstream.test' })
    const result = await client.getAllStations(true)
    expect(result).toEqual([])
  })

  it('propagates upstream HTTP errors', async () => {
    fetchMock
      .get('https://upstream.test')
      .intercept({ path: '/UlasimBackend/api/Calc/GetAllStations' })
      .reply(500, 'boom')

    const client = new DenizliApiClient({ ...testEnv, UPSTREAM_API: 'https://upstream.test' })
    await expect(client.getAllStations(true)).rejects.toThrow(/API error: 500/)
  })
})

describe('DenizliApiClient.getAllRoutes', () => {
  it('returns parsed routes on success', async () => {
    fetchMock
      .get('https://upstream.test')
      .intercept({ path: '/UlasimBackend/api/Calc/GetAllRoutes' })
      .reply(200, JSON.stringify(routesFixture), {
        headers: { 'content-type': 'application/json' },
      })

    const client = new DenizliApiClient({ ...testEnv, UPSTREAM_API: 'https://upstream.test' })
    const routes = await client.getAllRoutes(true)
    expect(routes).toHaveLength(1)
    expect(routes[0].lineCode).toBe('120')
  })
})

describe('DenizliApiClient.getRouteStations', () => {
  it('returns null when upstream response is malformed', async () => {
    fetchMock
      .get('https://upstream.test')
      .intercept({
        path: '/UlasimBackend/api/Calc/GetRouteStations?routeCode=120',
      })
      .reply(200, JSON.stringify({ value: {} }), {
        headers: { 'content-type': 'application/json' },
      })

    const client = new DenizliApiClient({ ...testEnv, UPSTREAM_API: 'https://upstream.test' })
    expect(await client.getRouteStations('120', true)).toBeNull()
  })
})
