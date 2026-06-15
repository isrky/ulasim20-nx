import { Capacitor } from '@capacitor/core'
import { configureAppBackButton } from './app'
import { configureKeyboard } from './keyboard'
import { configureStatusBar } from './statusbar'

/**
 * Initialize Capacitor features like Status Bar, Keyboard, and Back Button.
 */
export async function initializeCapacitor() {
  if (!Capacitor.isNativePlatform()) return

  await configureStatusBar()
  await configureKeyboard()
  configureAppBackButton()
}

/**
 * Check if the app is running on a specific platform.
 */
export const isAndroid = Capacitor.getPlatform() === 'android'
export const isIOS = Capacitor.getPlatform() === 'ios'
export const isNative = Capacitor.isNativePlatform()
