import { Capacitor } from '@capacitor/core'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'

export async function configureKeyboard(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body })
    await Keyboard.setScroll({ isDisabled: false })
  } catch (e) {
    console.warn('Keyboard initialization failed', e)
  }
}
