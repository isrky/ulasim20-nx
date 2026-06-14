import { Hono } from 'hono'
import { CACHE_KEYS } from '../services/cache'
import type { Env, FeedbackEntry, FeedbackType } from '../types'

const VALID_TYPES: FeedbackType[] = ['oneri', 'hata', 'sikayet', 'diger']
const MAX_MESSAGE_LENGTH = 5000
const MAX_FIELD_LENGTH = 200

export const feedbackRouter = new Hono<{ Bindings: Env }>()

feedbackRouter.post('/', async (c) => {
  try {
    const body = await c.req.json<{
      type?: string
      name?: string
      email?: string
      message?: string
    }>()

    const { type, name, email, message } = body

    if (!message || typeof message !== 'string' || !message.trim()) {
      return c.json({ success: false, error: 'Mesaj alanı zorunludur.' }, 400)
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return c.json(
        { success: false, error: `Mesaj en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir.` },
        400,
      )
    }

    const feedbackType: FeedbackType =
      typeof type === 'string' && VALID_TYPES.includes(type as FeedbackType)
        ? (type as FeedbackType)
        : 'diger'

    if (name && typeof name === 'string' && name.length > MAX_FIELD_LENGTH) {
      return c.json(
        { success: false, error: `İsim en fazla ${MAX_FIELD_LENGTH} karakter olabilir.` },
        400,
      )
    }

    if (email && typeof email === 'string' && email.length > MAX_FIELD_LENGTH) {
      return c.json(
        { success: false, error: `E-posta en fazla ${MAX_FIELD_LENGTH} karakter olabilir.` },
        400,
      )
    }

    const entry: FeedbackEntry = {
      type: feedbackType,
      name: name?.trim() || undefined,
      email: email?.trim() || undefined,
      message: message.trim(),
      createdAt: new Date().toISOString(),
      userAgent: c.req.header('user-agent') || 'unknown',
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const key = CACHE_KEYS.FEEDBACK(id)

    // KV TTL: 90 days
    await c.env.CACHE.put(key, JSON.stringify(entry), {
      expirationTtl: 90 * 24 * 60 * 60,
    })

    return c.json({ success: true, id })
  } catch (error) {
    console.error('Feedback submit error:', error)
    return c.json(
      { success: false, error: 'Geri bildirim gönderilemedi. Lütfen tekrar deneyin.' },
      500,
    )
  }
})
