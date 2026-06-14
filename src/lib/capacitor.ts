import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Clipboard } from '@capacitor/clipboard'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import { type ConnectionStatus, Network } from '@capacitor/network'
import { Preferences } from '@capacitor/preferences'
import { Share } from '@capacitor/share'
import { StatusBar, Style } from '@capacitor/status-bar'
import { useEffect, useState } from 'react'

/**
 * Unified Geolocation helper that works on both Web and Native platforms.
 */
export async function getCurrentPosition(opts?: PositionOptions): Promise<GeolocationPosition> {
  if (Capacitor.isNativePlatform()) {
    try {
      let perm = await Geolocation.checkPermissions()
      if (perm.location === 'prompt' || perm.location === 'prompt-with-rationale') {
        perm = await Geolocation.requestPermissions()
      }
      if (perm.location !== 'granted') {
        throw new Error('Konum izni reddedildi.')
      }

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: opts?.enableHighAccuracy ?? true,
        timeout: opts?.timeout ?? 10000,
      })

      return {
        coords: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          altitudeAccuracy: pos.coords.altitudeAccuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        },
        timestamp: pos.timestamp,
      } as GeolocationPosition
    } catch (error) {
      console.error('Capacitor Geolocation error:', error)
      throw error
    }
  }

  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Konum desteklenmiyor.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new Error('Konum izni reddedildi.'))
        else if (err.code === err.TIMEOUT) reject(new Error('Konum alma zaman aşımı.'))
        else reject(new Error('Konum alınamadı.'))
      },
      opts,
    )
  })
}

/**
 * Trigger haptic feedback if running on a native platform.
 */
export async function triggerHaptic(style: ImpactStyle = ImpactStyle.Light) {
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.impact({ style })
    } catch {
      // Ignore haptic errors
    }
  }
}

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

/**
 * React hook returning the current network status.
 * Native: @capacitor/network. Web: navigator.onLine + online/offline events.
 */
export function useNetworkStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(() => ({
    connected: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
    connectionType: 'unknown',
  }))

  useEffect(() => {
    let cleanup: (() => void) | undefined

    if (Capacitor.isNativePlatform()) {
      let mounted = true
      Network.getStatus().then((s) => {
        if (mounted) setStatus(s)
      })
      const handle = Network.addListener('networkStatusChange', (s) => setStatus(s))
      cleanup = () => {
        mounted = false
        handle.then((l) => l.remove())
      }
    } else if (typeof window !== 'undefined') {
      const update = () => {
        setStatus({
          connected: navigator.onLine,
          connectionType: navigator.onLine ? 'unknown' : 'none',
        })
      }
      window.addEventListener('online', update)
      window.addEventListener('offline', update)
      update()
      cleanup = () => {
        window.removeEventListener('online', update)
        window.removeEventListener('offline', update)
      }
    }

    return cleanup
  }, [])

  return status
}

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

/**
 * Initialize Capacitor features like Status Bar, Keyboard, and Back Button.
 */
export async function initializeCapacitor() {
  if (!Capacitor.isNativePlatform()) return

  try {
    await StatusBar.setStyle({ style: Style.Light })
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setOverlaysWebView({ overlay: false })
      await StatusBar.setBackgroundColor({ color: '#ffffff' })
    }
  } catch (e) {
    console.warn('StatusBar initialization failed', e)
  }

  // Keyboard: resize the body so focused inputs stay visible.
  try {
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body })
    await Keyboard.setScroll({ isDisabled: false })
  } catch (e) {
    console.warn('Keyboard initialization failed', e)
  }

  // Android hardware back button: pop history, otherwise exit.
  App.addListener('backButton', ({ canGoBack }) => {
    if (!canGoBack) {
      App.exitApp()
    } else {
      window.history.back()
    }
  })
}

/**
 * Check if the app is running on a specific platform.
 */
export const isAndroid = Capacitor.getPlatform() === 'android'
export const isIOS = Capacitor.getPlatform() === 'ios'
export const isNative = Capacitor.isNativePlatform()
