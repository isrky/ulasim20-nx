import { LocalNotifications } from '@capacitor/local-notifications'

export async function notify(title: string, body: string): Promise<void> {
  await LocalNotifications.schedule({ notifications: [{ title, body, id: Date.now() }] })
}
