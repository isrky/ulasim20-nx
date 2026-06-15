import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  toggleFavorite: vi.fn(),
  isFavorite: vi.fn(() => false),
  trackLineLookup: vi.fn(),
  trackStopLookup: vi.fn(),
}))

vi.mock('@ulasim20/data-access-transport-api', () => ({
  apiGet: mocks.apiGet,
}))

vi.mock('@ulasim20/ui-page-shell', () => ({
  DesktopNav: () => null,
  MobileNav: () => null,
  BackHeader: ({ title }: { title: string }) => <div>{title}</div>,
}))

vi.mock('@ulasim20/feature-card', () => ({
  useFavoriteLines: () => ({
    isFavorite: mocks.isFavorite,
    toggleFavorite: mocks.toggleFavorite,
  }),
}))

vi.mock('@ulasim20/data-access-capacitor', () => ({
  getCurrentPosition: vi.fn(),
}))

vi.mock('@ulasim20/util-analytics', () => ({
  trackLineLookup: mocks.trackLineLookup,
  trackStopLookup: mocks.trackStopLookup,
}))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 96,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ index, start: index * 96 })),
    measureElement: vi.fn(),
    scrollToIndex: vi.fn(),
  }),
}))

import HatDetayPage from './HatDetay'

const routeStations = [
  {
    sequence: 1,
    stationId: 410,
    stationName: 'TAPU MÜDÜRLÜĞÜ',
    latitude: '37.777806',
    longitude: '29.045278',
    sure: '0:0:0',
  },
  {
    sequence: 2,
    stationId: 411,
    stationName: 'VALİLİK',
    latitude: '37.778000',
    longitude: '29.046000',
    sure: '0:5:24',
  },
]

function mockInitialLoad() {
  mocks.apiGet.mockImplementation((path: string) => {
    if (path.includes('GetRouteStations')) {
      return Promise.resolve({
        isSuccess: true,
        value: { lineName: 'ÜNİVERSİTE-KARAHASANLI', stations: routeStations },
      })
    }
    if (path.includes('GetLiveData')) {
      return Promise.resolve({
        isSuccess: true,
        value: [
          {
            plate: '20 BL 241/O-241',
            latitude: '37.77947000',
            longitude: '29.07252167',
            speed: '33,00',
            routeCode: '320',
            stopId: 410,
          },
        ],
      })
    }
    if (path.includes('GetNextBusTime')) {
      return Promise.resolve({ value: { busTime: '2026-05-13T12:40:00' } })
    }
    if (path.includes('GetBusDataForStation')) {
      return Promise.resolve({ value: { busList: [] } })
    }
    return Promise.resolve({ value: null })
  })
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hatlar/320']}>
      <Routes>
        <Route path="/hatlar/:id" element={<HatDetayPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mocks.apiGet.mockReset()
  mocks.toggleFavorite.mockReset()
  mocks.isFavorite.mockReturnValue(false)
  mocks.trackLineLookup.mockReset()
  mocks.trackStopLookup.mockReset()
  mockInitialLoad()
})

describe('<HatDetayPage /> stop list redesign', () => {
  it('renders stops as simple clickable rows without timeline markers', async () => {
    renderPage()

    expect(await screen.findByRole('button', { name: /tapu müdürlüğü/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /VALİLİK 5 dk/ })).toBeInTheDocument()
    expect(screen.queryByTestId('route-stop-marker')).not.toBeInTheDocument()
  })

  it('uses the normalized line code as the line detail title', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: '320' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'ÜNİVERSİTE-KARAHASANLI' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/2 durak/)).toBeInTheDocument()
    expect(screen.getByText(/1 araç yolda/)).toBeInTheDocument()
  })

  it('links to the selected route on the map', async () => {
    renderPage()

    const link = await screen.findByRole('link', { name: /güzergahı haritada göster/i })
    expect(link).toHaveAttribute('href', '/harita?line=320')
  })

  it('renders the nearest-stop scroll action with the updated label and primary style', async () => {
    renderPage()

    const button = await screen.findByRole('button', { name: /en yakın durağa kaydır/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('bg-transit-primary')
    expect(button).toHaveClass('hover:bg-transit-primary/90')
    expect(screen.queryByRole('button', { name: /en yakın durağa git/i })).not.toBeInTheDocument()
  })

  it('renders stop rows with list numbers', async () => {
    renderPage()

    expect(await screen.findByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /#1 tapu müdürlüğü/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /#2 VALİLİK 5 dk/ })).toBeInTheDocument()
  })

  it('expands a stop inline and fetches ETA for the current line', async () => {
    mocks.apiGet.mockImplementation((path: string) => {
      if (path.includes('GetBusDataForStation')) {
        return Promise.resolve({
          value: {
            busList: [
              {
                hatno: '320',
                hatadi: 'ÜNİVERSİTE-KARAHASANLI',
                plaka: '20 BL 241/O-241',
                sure: '0:5:24',
              },
            ],
          },
        })
      }
      return mockInitialPath(path)
    })

    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /tapu müdürlüğü/i }))

    await waitFor(() => {
      expect(mocks.apiGet).toHaveBeenCalledWith(
        '/UlasimBackend/api/Calc/GetBusDataForStation?waitingStation=410&routeCode=320',
      )
    })
    expect((await screen.findAllByText(/5 dk/i)).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /daha fazla/i })).toHaveAttribute(
      'href',
      '/duraklar/410',
    )
    expect(screen.queryByRole('link', { name: /durak detayını aç/i })).not.toBeInTheDocument()
  })

  it('shows an empty state when there is no ETA for the expanded stop', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /tapu müdürlüğü/i }))

    expect(await screen.findByText('Bu hat için yaklaşan araç yok.')).toBeInTheDocument()
  })

  it('shows an inline error with retry when ETA loading fails', async () => {
    mocks.apiGet.mockImplementation((path: string) => {
      if (path.includes('GetBusDataForStation')) return Promise.reject(new Error('boom'))
      return mockInitialPath(path)
    })

    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /tapu müdürlüğü/i }))

    expect(await screen.findByText('ETA alınamadı')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tekrar dene/i })).toBeInTheDocument()
  })

  it('normalizes special plate placeholders in expanded ETA details', async () => {
    mocks.apiGet.mockImplementation((path: string) => {
      if (path.includes('GetBusDataForStation')) {
        return Promise.resolve({
          value: {
            busList: [
              {
                hatno: '320',
                hatadi: 'ÜNİVERSİTE-KARAHASANLI',
                plaka: 'ilkDurakKalkan',
                sure: '0:7:12',
              },
            ],
          },
        })
      }
      if (path.includes('GetNextBusTime')) {
        return Promise.resolve({ value: { busTime: '2026-05-13T12:40:00' } })
      }
      return mockInitialPath(path)
    })

    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /tapu müdürlüğü/i }))

    expect(await screen.findByText('12.40 BU DURAKTAN KALKACAK')).toBeInTheDocument()
  })

  it('formats expanded ETA over 60 minutes as hours and minutes', async () => {
    mocks.apiGet.mockImplementation((path: string) => {
      if (path.includes('GetBusDataForStation')) {
        return Promise.resolve({
          value: {
            busList: [
              {
                hatno: '320',
                hatadi: 'ÜNİVERSİTE-KARAHASANLI',
                plaka: '20 BL 241/O-241',
                sure: '1:35:00',
              },
            ],
          },
        })
      }
      return mockInitialPath(path)
    })

    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /tapu müdürlüğü/i }))

    expect(await screen.findByText('1 sa 35 dk')).toBeInTheDocument()
  })

  it('keeps only one stop expanded at a time', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /tapu müdürlüğü/i }))
    expect(await screen.findByText('Bu hat için yaklaşan araç yok.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /VALİLİK 5 dk/ }))

    await waitFor(() => {
      expect(screen.getAllByText('Bu hat için yaklaşan araç yok.')).toHaveLength(1)
    })
  })
})

function mockInitialPath(path: string) {
  if (path.includes('GetRouteStations')) {
    return Promise.resolve({
      isSuccess: true,
      value: { lineName: 'ÜNİVERSİTE-KARAHASANLI', stations: routeStations },
    })
  }
  if (path.includes('GetLiveData')) {
    return Promise.resolve({
      isSuccess: true,
      value: [
        {
          plate: '20 BL 241/O-241',
          latitude: '37.77947000',
          longitude: '29.07252167',
          speed: '33,00',
          routeCode: '320',
          stopId: 410,
        },
      ],
    })
  }
  if (path.includes('GetNextBusTime')) {
    return Promise.resolve({ value: { busTime: '2026-05-13T12:40:00' } })
  }
  return Promise.resolve({ value: null })
}
