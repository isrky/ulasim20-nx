import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

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
