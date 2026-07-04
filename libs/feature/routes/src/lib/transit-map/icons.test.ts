import { describe, expect, it } from 'vitest'
import { busIconSvg, stopIconSvg, refillIconSvg, userIconSvg, svgToDataUrl } from './icons'

describe('icons', () => {
  it('produces a data: URL prefix from any SVG string', () => {
    const url = svgToDataUrl('<svg/>')
    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true)
  })

  it('returns non-empty SVGs for every icon variant', () => {
    for (const svg of [busIconSvg(), stopIconSvg(), refillIconSvg(), userIconSvg()]) {
      expect(svg).toMatch(/<svg/)
      expect(svg.length).toBeGreaterThan(50)
    }
  })

  it('encodes the bus icon with the configured LINE_COLOR', () => {
    expect(busIconSvg()).toContain('#22c55e')
  })
})