export type NfcScanFailureReason =
  | 'unsupported'
  | 'permission_denied'
  | 'no_uid'
  | 'read_error'
  | 'aborted'
  | 'unknown'

export class NfcScanError extends Error {
  constructor(readonly reason: NfcScanFailureReason) {
    super(`NFC scan failed: ${reason}`)
    this.name = 'NfcScanError'
  }
}

interface NDEFReaderLike {
  onreading: ((event: { serialNumber?: string }) => void) | null
  onreadingerror: (() => void) | null
  scan(options?: { signal?: AbortSignal }): Promise<void>
}

interface NDEFWindow extends Window {
  NDEFReader?: new () => NDEFReaderLike
}

function getNDEFReaderConstructor() {
  if (typeof window === 'undefined') return undefined
  return (window as NDEFWindow).NDEFReader
}

function toNfcScanError(error: unknown): NfcScanError {
  if (error instanceof NfcScanError) return error
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return new NfcScanError('permission_denied')
    if (error.name === 'AbortError') return new NfcScanError('aborted')
  }
  return new NfcScanError('unknown')
}

export function isNfcCardScanSupported(): boolean {
  return Boolean(getNDEFReaderConstructor())
}

export function scanCardUidOnce(options: { signal?: AbortSignal } = {}): Promise<string> {
  const NDEFReader = getNDEFReaderConstructor()
  if (!NDEFReader) return Promise.reject(new NfcScanError('unsupported'))

  const reader = new NDEFReader()
  const controller = new AbortController()
  let settled = false

  const settle = <T>(callback: () => T): T | undefined => {
    if (settled) return undefined
    settled = true
    return callback()
  }

  if (options.signal) {
    if (options.signal.aborted) return Promise.reject(new NfcScanError('aborted'))
    options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  return new Promise<string>((resolve, reject) => {
    reader.onreading = (event) => {
      settle(() => {
        const uid = event.serialNumber?.trim() ?? ''
        if (!uid) {
          controller.abort()
          reject(new NfcScanError('no_uid'))
          return
        }
        controller.abort()
        resolve(uid)
      })
    }

    reader.onreadingerror = () => {
      settle(() => {
        controller.abort()
        reject(new NfcScanError('read_error'))
      })
    }

    reader.scan({ signal: controller.signal }).catch((error: unknown) => {
      settle(() => reject(toNfcScanError(error)))
    })
  })
}
