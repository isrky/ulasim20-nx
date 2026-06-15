/// <reference types="vite/client" />
import PocketBase, { type RecordModel } from 'pocketbase'

// The PocketBase server URL can be configured via environment variables.
// Use VITE_POCKETBASE_URL in your .env files.
const PB_URL = import.meta.env.VITE_POCKETBASE_URL || 'https://u20.isrky.dev'

export const pb = new PocketBase(PB_URL)

export interface FeedbackRecord extends RecordModel {
  type: 'oneri' | 'hata' | 'sikayet' | 'diger'
  name?: string
  email?: string
  message: string
  status: 'bekliyor' | 'inceleniyor' | 'cozuldu' | 'iptal'
  admin_replies: string[]
}
