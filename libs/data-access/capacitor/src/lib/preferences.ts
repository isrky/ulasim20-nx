import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

/**
 * Cross-platform key/value storage.
 * Native: @capacitor/preferences (survives WebView clears). Web: localStorage.
 */
export const storage = {
  async get(key: string): Promise<string | null> {
    if (Capacitor.isNativePlatform()) {
      const { value } = await Preferences.get({ key })
      return value ?? null
    }
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  async set(key: string, value: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key, value })
      return
    }
    try {
      localStorage.setItem(key, value)
    } catch {
      // ignore quota / privacy mode failures
    }
  },
  async remove(key: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key })
      return
    }
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
  },
}
