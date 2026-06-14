import { z } from 'zod'

export const STORAGE_KEY = 'ulasim_feedback_ids'
export const THROTTLE_KEY = 'ulasim_feedback_last_submit'
export const THROTTLE_MS = 30_000

// PocketBase record IDs are exactly 15 alphanumeric characters.
// Validate this to avoid sending garbage (e.g. injected filter fragments,
// wildcards, or paths) to the PocketBase API via `getOne`.
export const PB_ID_REGEX = /^[a-z0-9]{15}$/i

// Trim strings and coerce empty-after-trim to undefined so that optional
// fields accept both `''` and whitespace-only input uniformly.
const trimmedOptional = (inner: z.ZodType<string>) =>
  z.preprocess((v) => {
    if (typeof v !== 'string') return v
    const trimmed = v.trim()
    return trimmed === '' ? undefined : trimmed
  }, inner.optional())

export const feedbackSchema = z.object({
  type: z.enum(['oneri', 'hata', 'sikayet', 'diger']),
  name: trimmedOptional(z.string().max(100, 'İsim en fazla 100 karakter olabilir')),
  email: trimmedOptional(z.string().max(254).email('Geçersiz e-posta adresi')),
  message: z
    .string()
    .trim()
    .min(10, 'Mesaj en az 10 karakter olmalı')
    .max(2000, 'Mesaj en fazla 2000 karakter olabilir'),
})

export type FeedbackInput = z.input<typeof feedbackSchema>
export type FeedbackPayload = z.output<typeof feedbackSchema>

/**
 * Safely read and sanitize stored feedback record IDs from a storage-like
 * object. Guarantees the return value only contains strings that match the
 * expected PocketBase ID format, so a tampered localStorage entry cannot
 * influence later API calls.
 */
export function readStoredIds(storage: Pick<Storage, 'getItem'>): string[] {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && PB_ID_REGEX.test(id))
  } catch {
    return []
  }
}

/**
 * Pure throttle decision. Returns the remaining wait in ms (0 if allowed).
 * Kept separate from Date.now / localStorage so it is trivially testable.
 */
export function throttleRemainingMs(
  lastSubmitMs: number,
  nowMs: number,
  windowMs: number = THROTTLE_MS,
): number {
  if (!Number.isFinite(lastSubmitMs) || lastSubmitMs <= 0) return 0
  const elapsed = nowMs - lastSubmitMs
  if (elapsed >= windowMs) return 0
  if (elapsed < 0) return 0 // clock skew: allow
  return windowMs - elapsed
}
