import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { copyToClipboard } from './clipboard'

export interface ShareContentOptions {
  title?: string
  text?: string
  url?: string
  /** Dialog title shown on Android. */
  dialogTitle?: string
}

export interface ShareContentResult {
  shared: boolean
  method: 'native_share' | 'clipboard' | 'unavailable'
}

/**
 * Share content via the most native channel available.
 * Native: @capacitor/share. Web: navigator.share when available, otherwise clipboard.
 * Returns {shared, method} so callers can show the right feedback.
 */
export async function shareContent(opts: ShareContentOptions): Promise<ShareContentResult> {
  const { title, text, url, dialogTitle } = opts

  if (Capacitor.isNativePlatform()) {
    try {
      const can = await Share.canShare()
      if (can.value) {
        await Share.share({ title, text, url, dialogTitle })
        return { shared: true, method: 'native_share' }
      }
    } catch (e) {
      // User cancel or platform error — fall through to clipboard.
      console.warn('Share.share failed, falling back to clipboard:', e)
    }
  } else if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url })
      return { shared: true, method: 'native_share' }
    } catch (e) {
      const isAbort = e instanceof DOMException && e.name === 'AbortError'
      if (isAbort) return { shared: false, method: 'native_share' }
      // Fall through to clipboard.
    }
  }

  const fallbackText = [text, url].filter(Boolean).join(' ').trim()
  const ok = await copyToClipboard(fallbackText)
  return { shared: ok, method: ok ? 'clipboard' : 'unavailable' }
}
