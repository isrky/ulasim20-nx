import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NfcScanError, isNfcCardScanSupported, scanCardUidOnce } from './nfc'

interface FakeScanOptions {
  signal?: AbortSignal
}

interface FakeReadingEvent {
  serialNumber?: string
}

class FakeNDEFReader {
  static latest: FakeNDEFReader | null = null
  static scanImpl: (options?: FakeScanOptions) => Promise<void> = vi.fn(async () => {})

  onreading: ((event: FakeReadingEvent) => void) | null = null
  onreadingerror: (() => void) | null = null
  scan = vi.fn((options?: FakeScanOptions) => FakeNDEFReader.scanImpl(options))

  constructor() {
    FakeNDEFReader.latest = this
  }
}

function installFakeNDEFReader() {
  Object.defineProperty(window, 'NDEFReader', {
    configurable: true,
    value: FakeNDEFReader,
  })
}

function removeFakeNDEFReader() {
  Reflect.deleteProperty(window, 'NDEFReader')
}

beforeEach(() => {
  FakeNDEFReader.latest = null
  FakeNDEFReader.scanImpl = vi.fn(async () => {})
  removeFakeNDEFReader()
})

afterEach(() => {
  removeFakeNDEFReader()
})

describe('isNfcCardScanSupported', () => {
  it('returns false when NDEFReader is missing', () => {
    expect(isNfcCardScanSupported()).toBe(false)
  })

  it('returns true when NDEFReader exists', () => {
    installFakeNDEFReader()

    expect(isNfcCardScanSupported()).toBe(true)
  })
})

describe('scanCardUidOnce', () => {
  it('resolves with the first usable serialNumber', async () => {
    installFakeNDEFReader()

    const result = scanCardUidOnce()
    await Promise.resolve()
    FakeNDEFReader.latest?.onreading?.({ serialNumber: ' 12345678 ' })

    await expect(result).resolves.toBe('12345678')
  })

  it('rejects with no_uid when serialNumber is empty', async () => {
    installFakeNDEFReader()

    const result = scanCardUidOnce()
    await Promise.resolve()
    FakeNDEFReader.latest?.onreading?.({ serialNumber: '   ' })

    await expect(result).rejects.toMatchObject({ reason: 'no_uid' })
  })

  it('maps readingerror to read_error', async () => {
    installFakeNDEFReader()

    const result = scanCardUidOnce()
    await Promise.resolve()
    FakeNDEFReader.latest?.onreadingerror?.()

    await expect(result).rejects.toMatchObject({ reason: 'read_error' })
  })

  it('maps NotAllowedError from scan to permission_denied', async () => {
    installFakeNDEFReader()
    FakeNDEFReader.scanImpl = vi.fn(async () => {
      throw new DOMException('Permission denied', 'NotAllowedError')
    })

    await expect(scanCardUidOnce()).rejects.toMatchObject({ reason: 'permission_denied' })
  })

  it('aborts after the first successful read', async () => {
    installFakeNDEFReader()
    let scanSignal: AbortSignal | undefined
    FakeNDEFReader.scanImpl = vi.fn(async (options?: FakeScanOptions) => {
      scanSignal = options?.signal
    })

    const result = scanCardUidOnce()
    await Promise.resolve()
    FakeNDEFReader.latest?.onreading?.({ serialNumber: '12345678' })

    await expect(result).resolves.toBe('12345678')
    expect(scanSignal?.aborted).toBe(true)
  })

  it('rejects with unsupported when NDEFReader is missing', async () => {
    await expect(scanCardUidOnce()).rejects.toBeInstanceOf(NfcScanError)
    await expect(scanCardUidOnce()).rejects.toMatchObject({ reason: 'unsupported' })
  })
})
