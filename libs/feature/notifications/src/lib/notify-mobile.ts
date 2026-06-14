import { notify } from '@ulasim20/data-access-capacitor'

export async function notifyMobile(title: string, body: string) {
  await notify(title, body)
}
