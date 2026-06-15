import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'

/**
 * Open an external URL.
 * Native: in-app Custom Tab via @capacitor/browser (no app switch).
 * Web: window.open in a new tab.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Browser.open({ url, presentationStyle: 'popover' })
      return
    } catch (e) {
      console.warn('Browser.open failed, falling back to window.open:', e)
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
