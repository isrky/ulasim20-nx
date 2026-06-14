import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../../tests/helpers/renderWithProviders'
import StopsPage from './Duraklar'

const mocks = vi.hoisted(() => ({
  getAllStations: vi.fn(() => Promise.resolve([] as any[])),
  getCurrentPosition: vi.fn(() =>
    Promise.resolve({
      coords: { latitude: 37.7765, longitude: 29.0864 },
    }),
  ),
  useFavorites: vi.fn(() => ({
    isFavorite: () => false,
    toggleFavorite: () => {},
  })),
  trackAnalyticsEvent: vi.fn(),
  trackStopLookup: vi.fn(),
}))

vi.mock('@/api/denizli', () => ({
  getAllStations: mocks.getAllStations,
  getBusDataForStation: vi.fn(),
}))

vi.mock('@/lib/capacitor', () => ({
  getCurrentPosition: mocks.getCurrentPosition,
}))

vi.mock('@/hooks/use-favorites', () => ({
  useFavorites: mocks.useFavorites,
}))

vi.mock('@/lib/analytics', () => ({
  trackAnalyticsEvent: mocks.trackAnalyticsEvent,
  trackStopLookup: mocks.trackStopLookup,
}))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 54,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * 54,
        key: index,
        size: 54,
      })),
  }),
}))

describe('<StopsPage />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAllStations.mockResolvedValue([
      { stationId: '1', stationName: 'Stop 1', latitude: '37.77', longitude: '29.08' },
    ])
  })

  it('toggles "Yakınımdaki Duraklar" button styles between filled and outline', async () => {
    renderWithProviders(<StopsPage />)

    // Wait for loader to disappear and button to be visible
    const button = await screen.findByRole('button', { name: /Yakınımdaki Duraklar/ })

    // Default state: filled style (TDD check - will fail initially because it starts as outline)
    expect(button).toHaveClass('bg-transit-primary')
    expect(button).toHaveClass('text-white')
    expect(button).not.toHaveClass('text-transit-primary')

    // Click to toggle nearby stops (Active state)
    fireEvent.click(button)

    // Wait for state transition to complete
    const activeButton = await screen.findByRole('button', { name: /Yakındaki Durakları Gizle/ })

    // Active state: outline style
    expect(activeButton).toHaveClass('text-transit-primary')
    expect(activeButton).not.toHaveClass('bg-transit-primary')
    expect(activeButton).not.toHaveClass('text-white')
  })
})
