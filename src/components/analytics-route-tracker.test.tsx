import { describe, expect, it } from 'vitest'
import { isValidRoute } from './analytics-route-tracker'

describe('isValidRoute', () => {
  it.each([
    '/',
    '/harita',
    '/harita/',
    '/duraklar',
    '/duraklar/',
    '/duraklar/12345',
    '/duraklar/12345/',
    '/hatlar',
    '/hatlar/',
    '/hatlar/320',
    '/hatlar/320/',
    '/nasil-giderim',
    '/nasil-giderim/',
    '/kart',
    '/kart/',
    '/favoriler',
    '/favoriler/',
    '/eczaneler',
    '/eczaneler/',
    '/dolum-noktalari',
    '/dolum-noktalari/',
    '/geri-bildirim',
    '/geri-bildirim/',
    '/istatistikler',
    '/istatistikler/',
    '/hakkinda',
    '/hakkinda/',
    '/destek-ol',
    '/destek-ol/',
  ])('should return true for valid route: %s', (path) => {
    expect(isValidRoute(path)).toBe(true)
  })

  it.each([
    '/wp-admin',
    '/wp-admin/',
    '/ads.txt',
    '/.env',
    '/duraklar/12345/sub',
    '/hatlar/320/details',
    '/some-gibberish-path',
    '/favicon.ico',
  ])('should return false for invalid route: %s', (path) => {
    expect(isValidRoute(path)).toBe(false)
  })
})
