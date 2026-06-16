import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { loadAnalytics, trackAnalyticsPageView } from '@ulasim20/util-analytics'

const VALID_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/harita\/?$/,
  /^\/duraklar\/?$/,
  /^\/duraklar\/[^/]+\/?$/,
  /^\/hatlar\/?$/,
  /^\/hatlar\/[^/]+\/?$/,
  /^\/nasil-giderim\/?$/,
  /^\/kart\/?$/,
  /^\/favoriler\/?$/,
  /^\/eczaneler\/?$/,
  /^\/dolum-noktalari\/?$/,
  /^\/geri-bildirim\/?$/,
  /^\/istatistikler\/?$/,
  /^\/hakkinda\/?$/,
  /^\/destek-ol\/?$/,
]

export function isValidRoute(pathname: string): boolean {
  return VALID_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname))
}

export function AnalyticsRouteTracker() {
  const location = useLocation()
  const lastTrackedPath = useRef<string | null>(null)

  useEffect(() => {
    loadAnalytics()
  }, [])

  useEffect(() => {
    const path = `${location.pathname}${location.search}`
    if (lastTrackedPath.current === path) return
    lastTrackedPath.current = path

    if (isValidRoute(location.pathname)) {
      trackAnalyticsPageView(path)
    }
  }, [location.pathname, location.search])

  return null
}
