import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('joins multiple classnames', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('merges conflicting Tailwind utilities (later wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('ignores falsy values', () => {
    expect(cn('a', false, null, undefined, 0, 'b')).toBe('a b')
  })

  it('supports conditional objects', () => {
    expect(cn('a', { b: true, c: false })).toBe('a b')
  })

  it('supports arrays', () => {
    expect(cn(['a', ['b', 'c']])).toBe('a b c')
  })

  it('returns an empty string when no inputs', () => {
    expect(cn()).toBe('')
  })
})
