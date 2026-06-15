import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

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
