/// <reference types="vite/client" />
// Denizli Ulaşım API yardımcıları
// Veri tasarrufu için GetAllStations ve GetAllRoutes sonuçları önbelleğe alınır.
// - In-memory + sessionStorage kullanılır.
// - TTL ile belirli bir süre sonra otomatik yenilenir.
// - Aynı anda gelen istekler tek network çağrısında birleştirilir.
// - Backend API ile entegrasyon (opsiyonel)

import { isNative } from '@ulasim20/data-access-capacitor'
import { CapacitorHttp } from '@capacitor/core'

// Absolute origin of the backend Worker, derived from VITE_BACKEND_URL.
// Used to rewrite relative /api paths on native builds, where the WebView
// runs at https://localhost and has no Vite/Pages proxy.
const BACKEND_ORIGIN: string = (() => {
  const envUrl = import.meta.env.VITE_BACKEND_URL
  if (!envUrl) return ''
  try {
    return new URL(envUrl).origin
  } catch {
    return ''
  }
})()

/**
 * Resolve a backend path to a URL that is reachable from the current runtime.
 * - Absolute URL → returned unchanged.
 * - Relative path on web → returned unchanged (Vite / Cloudflare Pages proxy).
 * - Relative path on native → prepended with the VITE_BACKEND_URL origin so
 *   Capacitor can actually reach the Worker (https://localhost has no backend).
 */
export function resolveBackendUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  if (isNative && BACKEND_ORIGIN) {
    return `${BACKEND_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
  }
  return path
}

/**
 * Resolve any URL (backend or bundled asset) to something reachable from the
 * current runtime. Unlike resolveBackendUrl this always returns an absolute
 * URL on native: relative non-/api paths resolve against the WebView origin
 * (https://localhost) so CapacitorHttp never gets a protocol-less string.
 */
export function resolveRuntimeUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const normalised = path.startsWith('/') ? path : `/${path}`
  if (isNative) {
    if (normalised.startsWith('/api/') && BACKEND_ORIGIN) {
      return `${BACKEND_ORIGIN}${normalised}`
    }
    // Anything else (bundled static assets, fallback paths) lives inside the
    // WebView. Using the Capacitor runtime origin keeps CapacitorHttp happy.
    const webOrigin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://localhost'
    return `${webOrigin}${normalised}`
  }
  return path
}

export const isBackendReachable = !isNative || BACKEND_ORIGIN !== ''
export const backendOrigin = BACKEND_ORIGIN

// ============================================================================
// TİPLER
// ============================================================================

export interface Station {
  stationId: number
  stationName: string
  latitude: string
  longitude: string
  latitudeF: string
  longitudeF: string
  isActive: boolean
  distance: number
}

export interface BusRoute {
  lineCode: string
  lineNo: number
  lineName: string
  shortLineName: string
}

export interface BusData {
  hatno: string // hat kodu (örn: "430D")
  hatadi: string // hat adı
  plaka: string
  hiz: string
  latitude: string
  longitude: string
  kalanduraksayisi: string
  beklenenDurakSira: string
  otobusDurakSira: string
  kalkisaKadarkiDakika: string
  sure: string
  xmlYazmaSaati: string | null
  text: string | null
}

export interface BusDataForStationResponse {
  isSuccess: boolean
  value: {
    busList: BusData[]
    stationName: string
    stationId: string
    longitude: string
    latitude: string
  }
  error: string | null
}

interface GetAllStationsResponse {
  isSuccess?: boolean
  value: Station[]
}

interface GetAllRoutesResponse {
  value: BusRoute[]
}

export interface Dealer {
  dealerCode: string
  dealerName: string
  posNo: number
  latitude: string
  longitude: string
  address: string
  phone: string | null
  isExistPos: number
  isActive: boolean
  posCurrentBalance?: number
  inserDate?: string
  editDate?: string
  distance?: number
}

export interface GetAllDealersResponse {
  isSuccess: boolean
  value: Dealer[]
  error: string | null
}

// ============================================================================
// API YAPILANDIRMASI
// ============================================================================

// Native platformda (Android/iOS) doğrudan API'ye git, web'de proxy kullan
const API_BASE_NATIVE = 'https://ulasim.denizli.bel.tr'
const API_BASE_WEB = '/denizli-api'

// Backend API (Hono)
// Development: http://localhost:8787/api (Vite proxy üzerinden /api)
// Production: Deploy edildikten sonra Workers URL'si
const BACKEND_API_BASE = (() => {
  const envUrl = import.meta.env.VITE_BACKEND_URL
  if (!envUrl) return '/api' // Local development - Vite proxy
  // Production URL - /api ekle (eğer yoksa)
  return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`
})()

// Backend API'yi kullan (varsayılan: true - backend varsa kullan)
const USE_BACKEND = import.meta.env.VITE_USE_BACKEND !== 'false'

// Önbellek yaşam süresi (ms). Gerektiğinde güncelleyebilirsiniz.
// Varsayılan: 12 saat.
export const CACHE_TTL_MS = 12 * 60 * 60 * 1000

/**
 * Platform-aware API fetch helper.
 * Native platformda CapacitorHttp kullanır (CORS sorunu yok)
 * Web'de normal fetch kullanır (proxy üzerinden)
 *
 * @param path API path (örn: '/UlasimBackend/api/Calc/GetAllStations')
 */
export async function apiGet<T>(path: string): Promise<T> {
  const baseUrl = isNative ? API_BASE_NATIVE : API_BASE_WEB
  const url = `${baseUrl}${path}`
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Requested-With': 'XMLHttpRequest',
  }

  if (isNative) {
    // Native HTTP - CORS kısıtlaması yok
    const response = await CapacitorHttp.request({
      method: 'GET',
      url,
      headers,
    })
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`İstek başarısız: ${response.status}`)
    }
    return response.data as T
  }

  // Web fetch - proxy üzerinden
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`İstek başarısız: ${res.status}`)
  return (await res.json()) as T
}

/** Dolum/satış noktaları (GetAllDealers). Önbellek yok. */
export async function getAllDealers(): Promise<Dealer[]> {
  const res = await apiGet<GetAllDealersResponse>('/UlasimBackend/api/Calc/GetAllDealers')
  if (!res.isSuccess || !Array.isArray(res.value))
    throw new Error(res.error ?? 'GetAllDealers failed')
  return res.value
}

// Internal helper for Calc endpoints
function fetchJson<T>(calcPath: string): Promise<T> {
  return apiGet<T>(`/UlasimBackend/api/Calc${calcPath}`)
}

// In-memory önbellek + aynı anda gelen istekleri birleştirmek için in-flight promise
type CacheRecord<T> = { ts: number; value: T }
let stationsCache: CacheRecord<Station[]> | null = null
let routesCache: CacheRecord<BusRoute[]> | null = null
let stationsInFlight: Promise<Station[]> | null = null
let routesInFlight: Promise<BusRoute[]> | null = null

// SessionStorage anahtarları
const SS_STATIONS = 'denizli:GetAllStations'
const SS_ROUTES = 'denizli:GetAllRoutes'

function now() {
  return Date.now()
}

function isFresh(ts: number): boolean {
  return now() - ts < CACHE_TTL_MS
}

function readSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeSession<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // depolama mümkün değilse sessizce geç
  }
}

export async function getAllStations(): Promise<Station[]> {
  // In-memory taze ise direkt dön
  if (stationsCache && isFresh(stationsCache.ts)) return stationsCache.value

  // SessionStorage dene (hem yeni tip {ts,value}, hem eski tip [] için göç yolu)
  const ssAny = readSession<CacheRecord<Station[]> | Station[]>(SS_STATIONS)
  if (ssAny) {
    if (Array.isArray(ssAny)) {
      // Eski biçim: diziyi anında yeni formata çevir ve yaz
      const rec: CacheRecord<Station[]> = { ts: now(), value: ssAny }
      stationsCache = rec
      writeSession(SS_STATIONS, rec)
      return rec.value
    }
    if (Array.isArray(ssAny.value)) {
      const rec = ssAny as CacheRecord<Station[]>
      if (isFresh(rec.ts)) {
        stationsCache = rec
        return rec.value
      }
      // bayat ise aşağıda fetch ile yenilenecek
    }
  }
  if (stationsInFlight) return stationsInFlight
  stationsInFlight = (async () => {
    try {
      const data = await fetchJson<GetAllStationsResponse>('/GetAllStations')
      const list = Array.isArray(data.value) ? data.value : []
      const rec: CacheRecord<Station[]> = { ts: now(), value: list }
      stationsCache = rec
      writeSession(SS_STATIONS, rec)
      return rec.value
    } finally {
      stationsInFlight = null
    }
  })()
  return stationsInFlight
}

export async function getAllRoutes(): Promise<BusRoute[]> {
  if (routesCache && isFresh(routesCache.ts)) return routesCache.value

  const ssAny = readSession<CacheRecord<BusRoute[]> | BusRoute[]>(SS_ROUTES)
  if (ssAny) {
    if (Array.isArray(ssAny)) {
      const rec: CacheRecord<BusRoute[]> = { ts: now(), value: ssAny }
      routesCache = rec
      writeSession(SS_ROUTES, rec)
      return rec.value
    }
    if (Array.isArray(ssAny.value)) {
      const rec = ssAny as CacheRecord<BusRoute[]>
      if (isFresh(rec.ts)) {
        routesCache = rec
        return rec.value
      }
    }
  }
  if (routesInFlight) return routesInFlight
  routesInFlight = (async () => {
    try {
      const data = await fetchJson<GetAllRoutesResponse>('/GetAllRoutes')
      const list = Array.isArray(data.value) ? data.value : []
      const rec: CacheRecord<BusRoute[]> = { ts: now(), value: list }
      routesCache = rec
      writeSession(SS_ROUTES, rec)
      return rec.value
    } finally {
      routesInFlight = null
    }
  })()
  return routesInFlight
}

// İsteğe bağlı: elle temizleme yardımcıları (kullanılmıyor ama ilerisi için dursun)
export function clearStationsCache() {
  stationsCache = null
  try {
    sessionStorage.removeItem(SS_STATIONS)
  } catch {
    // storage temizlenemedi – önemli değil
  }
}

export function clearRoutesCache() {
  routesCache = null
  try {
    sessionStorage.removeItem(SS_ROUTES)
  } catch {
    // storage temizlenemedi – önemli değil
  }
}

// Duraktaki otobüs verilerini al (önbellekleme yok - her zaman güncel veri)
export async function getBusDataForStation(
  stationId: number,
  routeCode = '',
): Promise<BusDataForStationResponse> {
  return fetchJson<BusDataForStationResponse>(
    `/GetBusDataForStation?waitingStation=${stationId}&routeCode=${routeCode}`,
  )
}

// ============================================================================
// Rota planlama için ek API fonksiyonları
// ============================================================================

// Hat durağı tipi
export interface RouteStation {
  sequence: number
  stationId: number
  stationName: string
  latitude: string
  longitude: string
  sure: string
}

// Hat bilgisi (duraklar dahil)
export interface RouteWithStations {
  lineCode: string
  lineName: string
  stations: RouteStation[]
}

interface GetRouteStationsResponse {
  isSuccess?: boolean
  value: {
    stations: RouteStation[]
    lineName?: string
  }
}

// Tüm hat duraklarını saklamak için önbellek
const SS_ALL_ROUTE_STATIONS = 'denizli:AllRouteStations'
let allRouteStationsCache: CacheRecord<RouteWithStations[]> | null = null
let allRouteStationsInFlight: Promise<RouteWithStations[]> | null = null

async function getExpectedRouteCount(): Promise<number> {
  try {
    const routes = await getAllRoutes()
    return Array.isArray(routes) ? routes.length : 0
  } catch {
    return 0
  }
}

function isRouteStationsCacheComplete(valueLength: number, expectedTotal: number): boolean {
  if (expectedTotal <= 0) return true
  // If we're missing a large chunk, treat cache as invalid (prevents "47 hat" issue).
  return valueLength >= Math.floor(expectedTotal * 0.8)
}

/**
 * Tek bir hattın duraklarını al
 */
export async function getRouteStations(lineCode: string): Promise<RouteWithStations | null> {
  try {
    const data = await fetchJson<GetRouteStationsResponse>(
      `/GetRouteStations?routeCode=${encodeURIComponent(lineCode)}`,
    )
    const stations = data?.value?.stations
    if (!Array.isArray(stations)) return null

    return {
      lineCode,
      lineName: data?.value?.lineName || lineCode,
      stations,
    }
  } catch {
    return null
  }
}

/**
 * Tüm hatların duraklarını toplu olarak al
 * Paralel isteklerle çeker ve önbelleğe alır
 * @param onProgress İlerleme callback'i (loaded, total)
 */
export async function getAllRouteStations(
  onProgress?: (loaded: number, total: number) => void,
): Promise<RouteWithStations[]> {
  const expectedTotal = await getExpectedRouteCount()

  // In-memory taze ise direkt dön
  if (
    allRouteStationsCache &&
    isFresh(allRouteStationsCache.ts) &&
    isRouteStationsCacheComplete(allRouteStationsCache.value.length, expectedTotal)
  ) {
    return allRouteStationsCache.value
  }

  // SessionStorage dene
  const ssData = readSession<CacheRecord<RouteWithStations[]>>(SS_ALL_ROUTE_STATIONS)
  if (
    ssData &&
    Array.isArray(ssData.value) &&
    isFresh(ssData.ts) &&
    isRouteStationsCacheComplete(ssData.value.length, expectedTotal)
  ) {
    allRouteStationsCache = ssData
    return ssData.value
  }
  // Eğer cache bayat değil ama bariz eksikse, cache'i temizle
  if (ssData && Array.isArray(ssData.value) && isFresh(ssData.ts)) {
    try {
      sessionStorage.removeItem(SS_ALL_ROUTE_STATIONS)
    } catch {
      // ignore
    }
  }

  // Zaten yükleniyor mu?
  if (allRouteStationsInFlight) return allRouteStationsInFlight

  allRouteStationsInFlight = (async () => {
    try {
      // Önce tüm hatları al
      const routes = await getAllRoutes()
      const total = routes.length
      let loaded = 0

      onProgress?.(0, total)

      // Paralel istekler (aynı anda max 5)
      const BATCH_SIZE = 5
      const results: RouteWithStations[] = []

      for (let i = 0; i < routes.length; i += BATCH_SIZE) {
        const batch = routes.slice(i, i + BATCH_SIZE)
        const batchResults = await Promise.all(
          batch.map(async (route) => {
            const result = await getRouteStations(route.lineCode)
            loaded++
            onProgress?.(loaded, total)
            return result
          }),
        )

        for (const result of batchResults) {
          if (result) results.push(result)
        }
      }

      // Önbelleğe al
      const rec: CacheRecord<RouteWithStations[]> = { ts: now(), value: results }
      allRouteStationsCache = rec
      // Eksik veri geldiyse (geçici network hataları vb.), sessionStorage'a yazma.
      if (isRouteStationsCacheComplete(results.length, total)) {
        writeSession(SS_ALL_ROUTE_STATIONS, rec)
      }

      return results
    } finally {
      allRouteStationsInFlight = null
    }
  })()

  return allRouteStationsInFlight
}

/**
 * Rota duraklarını önbellekten temizle
 */
export function clearRouteStationsCache() {
  allRouteStationsCache = null
  try {
    sessionStorage.removeItem(SS_ALL_ROUTE_STATIONS)
  } catch {
    // storage temizlenemedi – önemli değil
  }
}

// ============================================================================
// BACKEND API ENTEGRASYONU
// ============================================================================

/**
 * Backend API'den veri çek.
 * Native: CapacitorHttp ile mutlak URL'e istek at (CORS ve proxy sorunu yok).
 * Web: Vite / Pages üzerinden relative fetch.
 */
async function backendFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const relativeUrl = `${BACKEND_API_BASE}${path}`
  const url = resolveBackendUrl(relativeUrl)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  }

  if (isNative) {
    if (!BACKEND_ORIGIN) {
      throw new Error('Arka uç adresi yapılandırılmamış. APK VITE_BACKEND_URL ile derlenmeli.')
    }
    const method = (options?.method || 'GET').toUpperCase()
    const response = await CapacitorHttp.request({
      method,
      url,
      headers,
      data: options?.body ?? undefined,
    })
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Backend isteği başarısız: ${response.status}`)
    }
    return response.data as T
  }

  const res = await fetch(url, { ...options, headers })
  if (!res.ok) {
    throw new Error(`Backend isteği başarısız: ${res.status}`)
  }
  return res.json() as Promise<T>
}

/**
 * Backend'den transit graf al (tek istek ile tüm veri)
 * 70+ istek yerine tek istek ile tüm rota verilerini alır
 */
export async function getTransitGraphFromBackend(): Promise<{
  stations: Station[]
  routes: BusRoute[]
  routeStations: RouteWithStations[]
  generatedAt: number
  version: string
} | null> {
  if (!USE_BACKEND) return null

  try {
    const response = await backendFetch<{
      success: boolean
      data: {
        stations: Station[]
        routes: BusRoute[]
        routeStations: RouteWithStations[]
        generatedAt: number
        version: string
      }
    }>('/routes/graph')

    if (response.success) {
      return response.data
    }
    return null
  } catch (error) {
    console.warn('Backend transit graph alınamadı, fallback kullanılacak:', error)
    return null
  }
}

/**
 * Tüm hat duraklarını al - Backend varsa backend'den, yoksa eski yöntemle
 * Bu fonksiyon mevcut getAllRouteStations'ı optimize eder
 */
export async function getAllRouteStationsOptimized(
  onProgress?: (loaded: number, total: number) => void,
): Promise<RouteWithStations[]> {
  const expectedTotal = await getExpectedRouteCount()

  // Önce cache'i kontrol et
  if (
    allRouteStationsCache &&
    isFresh(allRouteStationsCache.ts) &&
    isRouteStationsCacheComplete(allRouteStationsCache.value.length, expectedTotal)
  ) {
    return allRouteStationsCache.value
  }

  // SessionStorage dene
  const ssData = readSession<CacheRecord<RouteWithStations[]>>(SS_ALL_ROUTE_STATIONS)
  if (
    ssData &&
    Array.isArray(ssData.value) &&
    isFresh(ssData.ts) &&
    isRouteStationsCacheComplete(ssData.value.length, expectedTotal)
  ) {
    allRouteStationsCache = ssData
    return ssData.value
  }
  if (ssData && Array.isArray(ssData.value) && isFresh(ssData.ts)) {
    // Fresh but incomplete → clear and refetch
    try {
      sessionStorage.removeItem(SS_ALL_ROUTE_STATIONS)
    } catch {
      // ignore
    }
  }

  // Backend'den almayı dene (tek istek)
  if (USE_BACKEND) {
    try {
      const graph = await getTransitGraphFromBackend()
      if (graph && graph.routeStations.length > 0) {
        const expected = graph.routes?.length || expectedTotal

        // Eğer backend eksik veri dönüyorsa (ör: 47/139), frontend çoklu istek yöntemine fallback.
        if (!isRouteStationsCacheComplete(graph.routeStations.length, expected)) {
          console.warn('Backend transit graph eksik görünüyor, fallback kullanılacak:', {
            routeStations: graph.routeStations.length,
            routes: expected,
          })
          throw new Error('Backend graph incomplete')
        }

        // Cache'e kaydet
        const rec: CacheRecord<RouteWithStations[]> = { ts: now(), value: graph.routeStations }
        allRouteStationsCache = rec
        writeSession(SS_ALL_ROUTE_STATIONS, rec)

        // Progress callback'i çağır (tamamlandı)
        onProgress?.(graph.routeStations.length, graph.routeStations.length)

        return graph.routeStations
      }
    } catch (error) {
      console.warn('Backend kullanılamıyor, eski yönteme fallback:', error)
    }
  }

  // Fallback: Eski yöntem (çoklu istek)
  return getAllRouteStations(onProgress)
}

/**
 * Backend durumunu kontrol et
 */
export async function checkBackendStatus(): Promise<{
  available: boolean
  status?: string
  error?: string
}> {
  if (!USE_BACKEND) {
    return { available: false, error: 'Backend devre dışı' }
  }

  try {
    const response = await backendFetch<{
      service: string
      version: string
      status: string
    }>('/')

    return {
      available: true,
      status: response.status,
    }
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Backend bağlantı hatası',
    }
  }
}

// ============================================================================
// NÖBETÇİ ECZANELER API
// ============================================================================

export interface PharmacyData {
  name: string
  address: string
  district: string
  phone: string
}

export interface PharmacyResponse {
  date: string
  pharmacies: PharmacyData[]
}

/**
 * Nöbetçi eczane listesini backend'den al
 * Backend denizli.bel.tr sayfasını scrape edip cache'ler
 */
export async function getPharmacies(): Promise<PharmacyResponse> {
  try {
    const response = await backendFetch<{
      success: boolean
      data: PharmacyResponse
      error?: string
    }>('/pharmacies')

    if (response.success && response.data) {
      return response.data
    }

    throw new Error(response.error ?? 'Eczane verileri alınamadı')
  } catch (error) {
    console.error('Nöbetçi eczane verileri alınamadı:', error)
    throw error
  }
}

// ============================================================================
// ROTA GEOMETRİSİ API
// ============================================================================

export interface RouteGeometry {
  lineCode: string
  coordinates: [number, number][] // [lat, lng]
  distance?: number // meters
  duration?: number // seconds
  generatedAt?: number
  source?: 'kmz-direct'
}

export type RouteGeometryResult = { status: 'hit'; geometry: RouteGeometry } | { status: 'miss' }

/**
 * Tek bir hattın geometrisini backend'den al
 */
export async function getRouteGeometry(lineCode: string): Promise<RouteGeometry | null> {
  const result = await getRouteGeometryResult(lineCode)
  return result.status === 'hit' ? result.geometry : null
}

export async function getRouteGeometryResult(lineCode: string): Promise<RouteGeometryResult> {
  if (!USE_BACKEND) return { status: 'miss' }

  try {
    const response = await backendFetch<{
      success: boolean
      cached?: boolean
      status?: 'miss'
      data?: RouteGeometry | null
      error?: string
    }>(`/routes/${encodeURIComponent(lineCode)}/geometry`)

    if (response.success && response.data) {
      return { status: 'hit', geometry: response.data }
    }
    return { status: 'miss' }
  } catch (error) {
    console.warn('Backend route geometry alınamadı:', error)
    return { status: 'miss' }
  }
}

export async function triggerRouteGeometryGeneration(lineCode: string): Promise<void> {
  if (!USE_BACKEND) return

  try {
    await backendFetch<{ success: boolean; accepted: boolean }>(
      `/routes/${encodeURIComponent(lineCode)}/geometry/generate`,
      { method: 'POST' },
    )
  } catch (error) {
    console.warn('Route geometry cache generation başlatılamadı:', error)
  }
}

/**
 * Tüm hat geometrilerini backend'den al
 */
export async function getAllRouteGeometries(): Promise<Record<string, RouteGeometry> | null> {
  if (!USE_BACKEND) return null

  try {
    const response = await backendFetch<{
      success: boolean
      data?: Record<string, { coordinates: [number, number][]; distance: number; duration: number }>
      error?: string
    }>('/routes/geometries')

    if (response.success && response.data) {
      // lineCode ekle
      const result: Record<string, RouteGeometry> = {}
      for (const [lineCode, geometry] of Object.entries(response.data)) {
        result[lineCode] = {
          lineCode,
          ...geometry,
        }
      }
      return result
    }
    return null
  } catch (error) {
    console.warn('Backend route geometries alınamadı:', error)
    return null
  }
}
