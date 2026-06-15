import { describe, expect, it } from 'vitest'
import {
  PB_ID_REGEX,
  STORAGE_KEY,
  THROTTLE_MS,
  feedbackSchema,
  readStoredIds,
  throttleRemainingMs,
} from './index'

const validBase = {
  type: 'oneri' as const,
  message: 'Bu bir test mesajıdır, yeterince uzun.',
}

describe('feedbackSchema (happy path)', () => {
  it('accepts a minimal valid payload', () => {
    const res = feedbackSchema.safeParse(validBase)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data).toEqual({
        type: 'oneri',
        message: 'Bu bir test mesajıdır, yeterince uzun.',
      })
      expect(res.data.name).toBeUndefined()
      expect(res.data.email).toBeUndefined()
    }
  })
})

describe('feedbackSchema — message length rules', () => {
  it('rejects a too-short message', () => {
    expect(feedbackSchema.safeParse({ ...validBase, message: 'kısa' }).success).toBe(false)
  })

  it('rejects whitespace-only messages (trims to empty)', () => {
    expect(feedbackSchema.safeParse({ ...validBase, message: '          ' }).success).toBe(false)
  })

  it('accepts exactly 10 chars after trim', () => {
    const res = feedbackSchema.safeParse({ ...validBase, message: '  0123456789  ' })
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.message).toBe('0123456789')
  })

  it('rejects messages longer than 2000 chars', () => {
    expect(feedbackSchema.safeParse({ ...validBase, message: 'a'.repeat(2001) }).success).toBe(
      false,
    )
  })

  it('accepts exactly 2000 chars', () => {
    expect(feedbackSchema.safeParse({ ...validBase, message: 'a'.repeat(2000) }).success).toBe(true)
  })
})

describe('feedbackSchema — type enum enforcement', () => {
  const invalidTypes: ReadonlyArray<unknown> = [
    'admin',
    'cozuldu',
    'ONERI',
    '',
    null,
    123,
    undefined,
  ]

  it.each(invalidTypes.map((v) => [v] as const))('rejects invalid type %j', (bad) => {
    expect(feedbackSchema.safeParse({ ...validBase, type: bad as never }).success).toBe(false)
  })

  it.each(['oneri', 'hata', 'sikayet', 'diger'] as const)('accepts valid type %s', (ok) => {
    expect(feedbackSchema.safeParse({ ...validBase, type: ok }).success).toBe(true)
  })
})

describe('feedbackSchema — email rules', () => {
  it('normalises empty string to undefined', () => {
    const res = feedbackSchema.safeParse({ ...validBase, email: '' })
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.email).toBeUndefined()
  })

  it('normalises whitespace-only to undefined', () => {
    const res = feedbackSchema.safeParse({ ...validBase, email: '   ' })
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.email).toBeUndefined()
  })

  it('rejects malformed emails', () => {
    expect(feedbackSchema.safeParse({ ...validBase, email: 'not-an-email' }).success).toBe(false)
  })

  it('accepts a valid email', () => {
    const res = feedbackSchema.safeParse({ ...validBase, email: 'kisi@example.com' })
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.email).toBe('kisi@example.com')
  })

  it('rejects emails longer than RFC 5321 limits', () => {
    const longLocal = 'a'.repeat(250)
    expect(feedbackSchema.safeParse({ ...validBase, email: `${longLocal}@b.co` }).success).toBe(
      false,
    )
  })
})

describe('feedbackSchema — name rules', () => {
  it('rejects names over 100 chars', () => {
    expect(feedbackSchema.safeParse({ ...validBase, name: 'a'.repeat(101) }).success).toBe(false)
  })

  it('trims whitespace', () => {
    const res = feedbackSchema.safeParse({ ...validBase, name: '  Ada  ' })
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.name).toBe('Ada')
  })

  it('normalises empty name to undefined', () => {
    const res = feedbackSchema.safeParse({ ...validBase, name: '' })
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.name).toBeUndefined()
  })
})

describe('feedbackSchema — strips unknown keys (field-injection defence)', () => {
  it('drops attacker-supplied fields', () => {
    const res = feedbackSchema.safeParse({
      ...validBase,
      status: 'cozuldu',
      admin_replies: ['pwned'],
      id: 'aaaaaaaaaaaaaaa',
      created: '1970-01-01',
      role: 'admin',
    } as unknown)

    expect(res.success).toBe(true)
    if (res.success) {
      expect(Object.keys(res.data).sort()).toEqual(['message', 'type'])
      const raw = res.data as Record<string, unknown>
      expect(raw.status).toBeUndefined()
      expect(raw.admin_replies).toBeUndefined()
      expect(raw.role).toBeUndefined()
    }
  })
})

describe('PB_ID_REGEX', () => {
  it.each([
    ['abcdefghij01234', true],
    ['ABCdef1234GHIJK', true],
    ['short', false],
    ['abcdefghij012345', false],
    ['', false],
    ['abcdefghij0123!', false],
    ['abcdefghij0123 ', false],
    ['*', false],
    ['abcdefghij01234\n', false],
  ] as const)('matches(%j) === %s', (input, expected) => {
    expect(PB_ID_REGEX.test(input)).toBe(expected)
  })
})

describe('readStoredIds', () => {
  const makeStorage = (value: string | null) =>
    ({ getItem: () => value }) satisfies Pick<Storage, 'getItem'>

  it('returns empty array when key is missing', () => {
    expect(readStoredIds(makeStorage(null))).toEqual([])
  })

  it('returns empty array for empty value', () => {
    expect(readStoredIds(makeStorage(''))).toEqual([])
  })

  it('tolerates corrupt JSON without throwing', () => {
    expect(readStoredIds(makeStorage('{not-json'))).toEqual([])
  })

  it('returns empty array when value is an object', () => {
    expect(readStoredIds(makeStorage('{"a":1}'))).toEqual([])
  })

  it('returns empty array when value is a bare string', () => {
    expect(readStoredIds(makeStorage('"abcdefghij01234"'))).toEqual([])
  })

  it('retains only PocketBase-shaped IDs from a mixed array', () => {
    const ids = readStoredIds(
      makeStorage(
        JSON.stringify([
          'abcdefghij01234',
          'ABCdef1234GHIJK',
          'too-short',
          '* OR 1=1',
          123,
          null,
          { id: 'abcdefghij01234' },
          'abcdefghij0123456',
        ]),
      ),
    )
    expect(ids).toEqual(['abcdefghij01234', 'ABCdef1234GHIJK'])
  })

  it('exposes a stable storage key', () => {
    expect(STORAGE_KEY).toBe('ulasim_feedback_ids')
  })
})

describe('throttleRemainingMs', () => {
  it.each([
    ['no prior submit', 0, 1_000_000, undefined, 0],
    ['NaN lastSubmit', Number.NaN, 1_000_000, undefined, 0],
    ['Infinity lastSubmit treated as no prior', Number.POSITIVE_INFINITY, 1_000_000, undefined, 0],
    ['within window', 1_000_000, 1_005_000, undefined, THROTTLE_MS - 5_000],
    ['exactly at boundary', 1_000_000, 1_000_000 + THROTTLE_MS, undefined, 0],
    ['past window', 1_000_000, 1_000_000 + THROTTLE_MS + 1, undefined, 0],
    ['negative elapsed (clock skew) allowed', 2_000_000, 1_000_000, undefined, 0],
    ['custom window', 100, 150, 100, 50],
  ] as const)('%s', (_label, last, now, windowMs, expected) => {
    expect(throttleRemainingMs(last, now, windowMs)).toBe(expected)
  })
})
