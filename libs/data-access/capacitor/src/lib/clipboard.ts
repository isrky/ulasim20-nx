import { Clipboard } from '@capacitor/clipboard'
import { Capacitor } from '@capacitor/core'

/**
 * Copy a string to the clipboard.
 * Native: @capacitor/clipboard. Web: navigator.clipboard. Returns success.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false
  try {
    if (Capacitor.isNativePlatform()) {
      await Clipboard.write({ string: text })
      return true
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (e) {
    console.warn('Clipboard write failed:', e)
  }
  return false
}
