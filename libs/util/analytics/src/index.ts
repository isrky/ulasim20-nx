/// <reference types="vite/client" />
const DEFAULT_UMAMI_SRC = 'https://umami.isrky.dev/script.js'
const DEFAULT_UMAMI_WEBSITE_ID = '22656b81-a75a-49e5-9145-4acea4b23d12'
const SCRIPT_ID = 'umami-analytics-script'
const SAVED_CARDS_STORAGE_KEY = 'tr20_saved_cards'

type AnalyticsValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | { [key: string]: AnalyticsValue }

export interface AnalyticsPayload {
  [key: string]: AnalyticsValue
}

export type AnalyticsCardType = 'student' | 'civil' | 'disabled' | '65_plus' | 'unknown'

export interface SavedCardAnalyticsContext {
  cardType?: string
  addedAt?: string
  lastUsedAt?: string
}

type UmamiGlobal = {
  track?: (
    eventOrCallback?: string | ((props: Record<string, unknown>) => Record<string, unknown>),
    data?: Record<string, unknown>,
  ) => void
}

const SENSITIVE_KEYS = new Set([
  'cardid',
  'citizenshipnumber',
  'email',
  'lat',
  'latitude',
  'lng',
  'longitude',
  'message',
  'mifareid',
  'name',
  'query',
  'surname',
  'tckn',
])

function getEnv() {
  return (import.meta as ImportMeta & { env?: ImportMetaEnv }).env ?? {}
}

function isCapacitorNative() {
  if (typeof window === 'undefined') return false
  const capacitor = (
    window as Window & {
      Capacitor?: { isNativePlatform?: () => boolean }
    }
  ).Capacitor

  return capacitor?.isNativePlatform?.() ?? false
}

function getPlatform() {
  return isCapacitorNative() ? 'android' : 'web'
}

function getConfig() {
  const env = getEnv()
  const src = env.VITE_UMAMI_SRC || DEFAULT_UMAMI_SRC
  const websiteId = env.VITE_UMAMI_WEBSITE_ID || DEFAULT_UMAMI_WEBSITE_ID
  const enabled = env.VITE_UMAMI_ENABLED !== 'false' && Boolean(src && websiteId)

  return { enabled, src, websiteId }
}

function normalizeKey(key: string) {
  return key.replace(/[-_\s]/g, '').toLowerCase()
}

function shouldDropKey(key: string) {
  return SENSITIVE_KEYS.has(normalizeKey(key))
}

function sanitizeValue(value: AnalyticsValue): unknown {
  if (value === null || value === undefined) return undefined

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  return sanitizeAnalyticsPayload(value)
}

function normalizeCardTypeText(value: string) {
  return (
    value
      .trim()
      .toLocaleLowerCase('tr-TR')
      .normalize('NFD')
      // biome-ignore lint/suspicious/noMisleadingCharacterClass: standard diacritics removal range
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/g, 'i')
  )
}

export function normalizeAnalyticsCardType(value?: string): AnalyticsCardType {
  if (!value) return 'unknown'

  const normalized = normalizeCardTypeText(value)
  if (!normalized) return 'unknown'

  if (normalized.includes('ogrenci') || normalized.includes('student')) return 'student'
  if (normalized.includes('sivil') || normalized.includes('civil')) return 'civil'
  if (normalized.includes('engelli') || normalized.includes('disabled')) return 'disabled'
  if (normalized.includes('65') || normalized.includes('yasli') || normalized.includes('senior'))
    return '65_plus'

  return 'unknown'
}

function timestampValue(value?: string) {
  if (!value) return 0
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function resolveSavedCardAnalyticsCardType(
  cards: SavedCardAnalyticsContext[],
): AnalyticsCardType {
  if (!Array.isArray(cards) || cards.length === 0) return 'unknown'

  const selectedCard = [...cards].sort((a, b) => {
    const aTimestamp = timestampValue(a.lastUsedAt) || timestampValue(a.addedAt)
    const bTimestamp = timestampValue(b.lastUsedAt) || timestampValue(b.addedAt)
    return bTimestamp - aTimestamp
  })[0]

  return normalizeAnalyticsCardType(selectedCard?.cardType)
}

function readSavedCardsForAnalytics(): SavedCardAnalyticsContext[] {
  if (typeof localStorage === 'undefined') return []

  try {
    const stored = localStorage.getItem(SAVED_CARDS_STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function getSavedCardAnalyticsCardType() {
  return resolveSavedCardAnalyticsCardType(readSavedCardsForAnalytics())
}

export function sanitizeAnalyticsPayload(
  payload?: AnalyticsPayload,
): Record<string, unknown> | undefined {
  if (!payload) return undefined

  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(payload)) {
    if (shouldDropKey(key)) continue

    const nextValue = sanitizeValue(value)
    if (nextValue === undefined) continue
    if (
      typeof nextValue === 'object' &&
      nextValue !== null &&
      !Array.isArray(nextValue) &&
      Object.keys(nextValue).length === 0
    ) {
      continue
    }

    sanitized[key] = nextValue
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

export function loadAnalytics() {
  if (typeof document === 'undefined') return

  const config = getConfig()
  if (!config.enabled || document.getElementById(SCRIPT_ID)) return

  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.defer = true
  script.src = config.src
  script.dataset.websiteId = config.websiteId
  document.head.appendChild(script)
}

export function trackAnalyticsEvent(eventName: string, payload?: AnalyticsPayload) {
  if (typeof window === 'undefined') return

  const config = getConfig()
  const umami = (window as Window & { umami?: UmamiGlobal }).umami
  if (!config.enabled || !umami?.track) return

  try {
    umami.track(eventName, {
      platform: getPlatform(),
      ...sanitizeAnalyticsPayload(payload),
    })
  } catch {
    // Analytics must never break product flows.
  }
}

export function trackLineLookup({
  lineCode,
  source,
}: {
  lineCode: string
  source: string
}) {
  trackAnalyticsEvent('line_lookup', {
    line_code: lineCode,
    source,
    card_type: getSavedCardAnalyticsCardType(),
  })
}

export function trackRouteMapOpen({
  lineCode,
  source,
  entryPoint,
}: {
  lineCode: string
  source: 'backend-cache' | 'direct-kmz'
  entryPoint: string
}) {
  trackAnalyticsEvent('route_map_open', {
    line_code: lineCode,
    source,
    entry_point: entryPoint,
  })
}

export function trackStopLookup({
  stationId,
  source,
}: {
  stationId: number
  source: string
}) {
  trackAnalyticsEvent('stop_lookup', {
    station_id: stationId,
    source,
    card_type: getSavedCardAnalyticsCardType(),
  })
}

export function trackAnalyticsPageView(path: string) {
  if (typeof window === 'undefined') return

  const config = getConfig()
  const umami = (window as Window & { umami?: UmamiGlobal }).umami
  if (!config.enabled || !umami?.track) return

  try {
    umami.track((props) => ({
      ...props,
      title: document.title,
      url: path,
      platform: getPlatform(),
    }))
  } catch {
    // Analytics must never break routing.
  }
}
