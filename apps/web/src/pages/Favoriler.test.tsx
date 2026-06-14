import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../../tests/helpers/renderWithProviders'
import FavoritesPage from './Favoriler'

const mocks = vi.hoisted(() => ({
  incrementStopClickCount: vi.fn(),
  incrementLineClickCount: vi.fn(),
  removeFavoriteStop: vi.fn(),
  removeFavoriteLine: vi.fn(),
  useFavorites: vi.fn(() => ({
    favorites: [
      {
        stationId: 123,
        stationName: 'Bayramyeri',
        addedAt: '2026-06-07T00:00:00.000Z',
        clickCount: 0,
      },
    ],
    removeFavorite: () => {},
    incrementClickCount: () => {},
  })),
  useFavoriteLines: vi.fn(() => ({
    favorites: [
      {
        lineCode: '1G',
        lineName: 'VALİLİK - GÖKPINAR',
        addedAt: '2026-06-07T00:00:00.000Z',
        clickCount: 0,
      },
    ],
    removeFavorite: () => {},
    incrementClickCount: () => {},
  })),
}))

vi.mock('@/hooks/use-favorites', () => ({
  useFavorites: mocks.useFavorites,
}))

vi.mock('@/hooks/use-favorite-lines', () => ({
  useFavoriteLines: mocks.useFavoriteLines,
}))

// Mock API and analytics to prevent side effects
vi.mock('@/api/denizli', () => ({
  getBusDataForStation: vi.fn(() => Promise.resolve({ value: { busList: [] } })),
  apiGet: vi.fn(() => Promise.resolve({ value: [] })),
}))

vi.mock('@/lib/analytics', () => ({
  trackLineLookup: vi.fn(),
  trackStopLookup: vi.fn(),
}))

describe('<FavoritesPage />', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Set up implementation hooks with tracking mocks
    mocks.useFavorites.mockReturnValue({
      favorites: [
        {
          stationId: 123,
          stationName: 'Bayramyeri',
          addedAt: '2026-06-07T00:00:00.000Z',
          clickCount: 0,
        },
      ],
      removeFavorite: mocks.removeFavoriteStop,
      incrementClickCount: mocks.incrementStopClickCount,
    } as any)

    mocks.useFavoriteLines.mockReturnValue({
      favorites: [
        {
          lineCode: '1G',
          lineName: 'VALİLİK - GÖKPINAR',
          addedAt: '2026-06-07T00:00:00.000Z',
          clickCount: 0,
        },
      ],
      removeFavorite: mocks.removeFavoriteLine,
      incrementClickCount: mocks.incrementLineClickCount,
    } as any)
  })

  it('increments station click count when a favorite stop card is clicked', async () => {
    renderWithProviders(<FavoritesPage />)

    const stopCardLink = await screen.findByText('Bayramyeri')
    fireEvent.click(stopCardLink)

    expect(mocks.incrementStopClickCount).toHaveBeenCalledWith(123)
  })

  it('increments line click count when a favorite line card is clicked', async () => {
    renderWithProviders(<FavoritesPage />)

    // Switch to Lines tab
    const linesTab = await screen.findByRole('tab', { name: /Hatlar/ })
    fireEvent.click(linesTab)
    fireEvent.keyDown(linesTab, { key: ' ', code: 'Space' })

    const lineCardLink = await screen.findByText(/VALİLİK - GÖKPINAR/i)
    fireEvent.click(lineCardLink)

    expect(mocks.incrementLineClickCount).toHaveBeenCalledWith('1G')
  })
})
