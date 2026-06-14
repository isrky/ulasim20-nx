import { NfcScanError } from '@/lib/nfc'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const cardResponse = {
  mifareId: '12345678',
  cardType: 'KONTORLU',
  cardTypeDescription: 'Kontörlü Kart',
  productionDate: '',
  lastTransactionDate: '01.01.2026 10:00:00',
  currentBalance: '25,00',
  name: 'Test',
  surname: 'User',
  validityStartDate: '',
  validityEndDate: '',
  cardStatus: 'Aktif',
  citizenshipNumber: '',
  remainingPass: '',
  subscriptionStartDateTime: '0001-01-01',
  subscriptionEndDateTime: '0001-01-01',
  subscriptionPlatform: '',
}

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  addCard: vi.fn(),
  removeCard: vi.fn(),
  markCardUsed: vi.fn(),
  isSaved: vi.fn(() => false),
  isNfcCardScanSupported: vi.fn(() => false),
  scanCardUidOnce: vi.fn(),
  trackAnalyticsEvent: vi.fn(),
}))

vi.mock('@/api/denizli', () => ({
  apiGet: mocks.apiGet,
}))

vi.mock('@/components/navigation', () => ({
  DesktopNav: () => null,
  MobileNav: () => null,
}))

vi.mock('@/hooks/use-saved-cards', () => ({
  useSavedCards: () => ({
    cards: [],
    isSaved: mocks.isSaved,
    addCard: mocks.addCard,
    removeCard: mocks.removeCard,
    markCardUsed: mocks.markCardUsed,
  }),
}))

vi.mock('@/lib/capacitor', () => ({
  triggerHaptic: vi.fn(),
  openExternalUrl: vi.fn(),
}))

vi.mock('@/lib/analytics', () => ({
  normalizeAnalyticsCardType: vi.fn((value) => value || 'unknown'),
  trackAnalyticsEvent: mocks.trackAnalyticsEvent,
}))

vi.mock('@/lib/nfc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/nfc')>()
  return {
    ...actual,
    isNfcCardScanSupported: mocks.isNfcCardScanSupported,
    scanCardUidOnce: mocks.scanCardUidOnce,
  }
})

import KartPage from './Kart'

beforeEach(() => {
  mocks.apiGet.mockReset()
  mocks.addCard.mockReset()
  mocks.removeCard.mockReset()
  mocks.markCardUsed.mockReset()
  mocks.isSaved.mockReturnValue(false)
  mocks.isNfcCardScanSupported.mockReturnValue(false)
  mocks.scanCardUidOnce.mockReset()
  mocks.trackAnalyticsEvent.mockReset()
})

describe('<KartPage />', () => {
  it('shows the not-found state when an invalid card response has a non-string error', async () => {
    mocks.apiGet.mockResolvedValueOnce({
      isSuccess: false,
      value: null,
      error: { message: 'Kart bulunamadı' },
    })

    const user = userEvent.setup()
    render(<KartPage />)

    await user.type(screen.getByPlaceholderText(/tckn veya kart no/i), '12345678')
    await user.click(screen.getByRole('button'))

    expect(await screen.findAllByText('Kart bulunamadı')).not.toHaveLength(0)
  })

  it('hides the NFC scan button when Web NFC is unsupported', () => {
    mocks.isNfcCardScanSupported.mockReturnValue(false)

    render(<KartPage />)

    expect(screen.queryByRole('button', { name: /nfc ile tara/i })).not.toBeInTheDocument()
  })

  it('shows the NFC scan button when Web NFC is supported', () => {
    mocks.isNfcCardScanSupported.mockReturnValue(true)

    render(<KartPage />)

    expect(screen.getByRole('button', { name: /nfc ile tara/i })).toBeInTheDocument()
  })

  it('successful NFC scan fills the input and triggers the existing card lookup', async () => {
    mocks.isNfcCardScanSupported.mockReturnValue(true)
    mocks.scanCardUidOnce.mockResolvedValueOnce('12345678')
    mocks.apiGet.mockResolvedValueOnce({ isSuccess: true, value: [cardResponse], error: null })

    const user = userEvent.setup()
    render(<KartPage />)

    await user.click(screen.getByRole('button', { name: /nfc ile tara/i }))

    expect(mocks.scanCardUidOnce).toHaveBeenCalledTimes(1)
    expect(screen.getByPlaceholderText(/tckn veya kart no/i)).toHaveValue('12345678')
    await waitFor(() => {
      expect(mocks.apiGet).toHaveBeenCalledWith(
        '/UlasimBackend/api/Calc/GetCardInfo?mifareId=12345678',
      )
    })
    expect(await screen.findByText('25.00 TL')).toBeInTheDocument()
  })

  it('successful NFC scan normalizes colon-separated UIDs before card lookup', async () => {
    mocks.isNfcCardScanSupported.mockReturnValue(true)
    mocks.scanCardUidOnce.mockResolvedValueOnce('f3:5e:e9:ca')
    mocks.apiGet.mockResolvedValueOnce({ isSuccess: true, value: [cardResponse], error: null })

    const user = userEvent.setup()
    render(<KartPage />)

    await user.click(screen.getByRole('button', { name: /nfc ile tara/i }))

    expect(screen.getByPlaceholderText(/tckn veya kart no/i)).toHaveValue('f35ee9ca')
    await waitFor(() => {
      expect(mocks.apiGet).toHaveBeenCalledWith(
        '/UlasimBackend/api/Calc/GetCardInfo?mifareId=f35ee9ca',
      )
    })
  })

  it('successful NFC scan tracks anonymous success without the UID', async () => {
    mocks.isNfcCardScanSupported.mockReturnValue(true)
    mocks.scanCardUidOnce.mockResolvedValueOnce('12345678')
    mocks.apiGet.mockResolvedValueOnce({ isSuccess: true, value: [cardResponse], error: null })

    const user = userEvent.setup()
    render(<KartPage />)

    await user.click(screen.getByRole('button', { name: /nfc ile tara/i }))

    await waitFor(() => {
      expect(mocks.trackAnalyticsEvent).toHaveBeenCalledWith('card_nfc_scan', { success: true })
    })
    expect(JSON.stringify(mocks.trackAnalyticsEvent.mock.calls)).not.toContain('12345678')
  })

  it('failed NFC scan shows inline fallback copy', async () => {
    mocks.isNfcCardScanSupported.mockReturnValue(true)
    mocks.scanCardUidOnce.mockRejectedValueOnce(new NfcScanError('permission_denied'))

    const user = userEvent.setup()
    render(<KartPage />)

    await user.click(screen.getByRole('button', { name: /nfc ile tara/i }))

    expect(
      await screen.findByText('NFC izni verilmedi. Elle aramayı kullanabilirsiniz.'),
    ).toBeInTheDocument()
  })

  it('failed NFC scan tracks anonymous failure reason without the UID', async () => {
    mocks.isNfcCardScanSupported.mockReturnValue(true)
    mocks.scanCardUidOnce.mockRejectedValueOnce(new NfcScanError('permission_denied'))

    const user = userEvent.setup()
    render(<KartPage />)

    await user.click(screen.getByRole('button', { name: /nfc ile tara/i }))

    await waitFor(() => {
      expect(mocks.trackAnalyticsEvent).toHaveBeenCalledWith('card_nfc_scan', {
        success: false,
        reason: 'permission_denied',
      })
    })
    expect(JSON.stringify(mocks.trackAnalyticsEvent.mock.calls)).not.toContain('12345678')
  })

  it('aborts an in-flight NFC scan when the page unmounts', async () => {
    mocks.isNfcCardScanSupported.mockReturnValue(true)
    let scanSignal: AbortSignal | undefined
    mocks.scanCardUidOnce.mockImplementationOnce(
      ({ signal }: { signal?: AbortSignal } = {}) =>
        new Promise<string>(() => {
          scanSignal = signal
        }),
    )

    const user = userEvent.setup()
    const { unmount } = render(<KartPage />)

    await user.click(screen.getByRole('button', { name: /nfc ile tara/i }))
    expect(scanSignal?.aborted).toBe(false)

    unmount()

    expect(scanSignal?.aborted).toBe(true)
  })
})
