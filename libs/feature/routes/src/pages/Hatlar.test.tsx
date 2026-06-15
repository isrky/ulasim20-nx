import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~tests/helpers/renderWithProviders'
import LinesPage from './Hatlar'

const mocks = vi.hoisted(() => ({
  getAllRoutes: vi.fn(() => Promise.resolve([] as any[])),
  isFavorite: vi.fn(() => false),
  toggleFavorite: vi.fn(),
  trackLineLookup: vi.fn(),
  trackAnalyticsEvent: vi.fn(),
}))

vi.mock('@ulasim20/data-access-transport-api', () => ({
  getAllRoutes: mocks.getAllRoutes,
}))

vi.mock('@ulasim20/util-analytics', () => ({
  trackLineLookup: mocks.trackLineLookup,
  trackAnalyticsEvent: mocks.trackAnalyticsEvent,
}))

vi.mock('@ulasim20/feature-card', () => ({
  useFavoriteLines: () => ({
    isFavorite: mocks.isFavorite,
    toggleFavorite: mocks.toggleFavorite,
  }),
}))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 48,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * 48,
        key: index,
        size: 48,
      })),
  }),
}))

describe('<LinesPage />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAllRoutes.mockResolvedValue([
      { lineNo: 1, lineCode: '100', lineName: 'Route 100', shortLineName: 'R100' },
    ])
  })

  it('toggles "Tüm Hatları Göster" button styles between filled and outline', async () => {
    renderWithProviders(<LinesPage />)

    // Wait for loader to disappear and button to be visible
    const button = await screen.findByRole('button', { name: /Tüm Hatları Göster/ })

    // Default state: filled style (TDD check - will fail initially because it starts as outline)
    expect(button).toHaveClass('bg-transit-primary')
    expect(button).toHaveClass('text-white')
    expect(button).not.toHaveClass('text-transit-primary')

    // Click to toggle on "Hatları Gizle" (Active state)
    fireEvent.click(button)

    const activeButton = screen.getByRole('button', { name: /Hatları Gizle/ })

    // Active state: outline style
    expect(activeButton).toHaveClass('text-transit-primary')
    expect(activeButton).not.toHaveClass('bg-transit-primary')
    expect(activeButton).not.toHaveClass('text-white')
  })
})
