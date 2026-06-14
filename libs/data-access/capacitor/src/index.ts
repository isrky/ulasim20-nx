import { Geolocation } from '@capacitor/geolocation'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Preferences } from '@capacitor/preferences'
import { SlugSchema } from '@ulasim20/util-validation'

export async function currentPosition(): Promise<{ lat: number; lon: number } | null> {
  try {
    const perm = await Geolocation.checkPermissions()
    if (perm.location !== 'granted') {
      const req = await Geolocation.requestPermissions()
      if (req.location !== 'granted') return null
    }
    const pos = await Geolocation.getCurrentPosition()
    return { lat: pos.coords.latitude, lon: pos.coords.longitude }
  } catch {
    return null
  }
}

export async function tap(): Promise<void> {
  await Haptics.impact({ style: ImpactStyle.Light })
}

export async function notify(title: string, body: string): Promise<void> {
  await LocalNotifications.schedule({ notifications: [{ title, body, id: Date.now() }] })
}

export async function readPref(key: string): Promise<string | null> {
  const parsed = SlugSchema.safeParse(key)
  if (!parsed.success) throw new Error(`invalid pref key: ${key}`)
  const { value } = await Preferences.get({ key })
  return value
}
