import { LINE_COLOR, REFILL_MARKER_COLOR, STOP_MARKER_COLOR, USER_MARKER_COLOR } from './constants'

export function svgToDataUrl(svg: string): string {
  const b64 = typeof btoa === 'function'
    ? btoa(svg)
    : Buffer.from(svg, 'utf-8').toString('base64')
  return `data:image/svg+xml;base64,${b64}`
}

export function busIconSvg(color: string = LINE_COLOR): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><rect x="4" y="6" width="24" height="20" rx="4" fill="${color}"/><rect x="8" y="10" width="16" height="8" rx="2" fill="white"/><circle cx="10" cy="22" r="2" fill="white"/><circle cx="22" cy="22" r="2" fill="white"/></svg>`
}

export function stopIconSvg(color: string = STOP_MARKER_COLOR): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect x="1" y="1" width="16" height="16" rx="3" fill="${color}" stroke="white" stroke-width="2"/></svg>`
}

export function refillIconSvg(color: string = REFILL_MARKER_COLOR): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" width="14" height="14"><circle cx="7" cy="7" r="6" fill="${color}" stroke="white" stroke-width="2"/></svg>`
}

export function userIconSvg(color: string = USER_MARKER_COLOR): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="white"/></svg>`
}

export function searchHighlightSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22" width="22" height="22"><circle cx="11" cy="11" r="9" fill="${STOP_MARKER_COLOR}" stroke="white" stroke-width="3"/></svg>`
}