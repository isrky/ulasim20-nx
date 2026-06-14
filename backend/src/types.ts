/**
 * Backend Type Definitions
 * Denizli Ulaşım API tipleri
 */

// ============================================================================
// Cloudflare Bindings
// ============================================================================

export interface Env {
  CACHE: KVNamespace
  DATASETS?: R2Bucket
  UPSTREAM_API: string
  CACHE_TTL_STATIONS: string
  CACHE_TTL_ROUTES: string
  CACHE_TTL_ROUTE_STATIONS: string
  CACHE_TTL_GRAPH: string
  CACHE_TTL_PLANNER_INDEX?: string
  CACHE_TTL_GEOMETRY?: string
  /** Real-time endpoints (short TTL, seconds) */
  CACHE_TTL_REALTIME?: string
  /** Pharmacy page scrape cache TTL (default 3600 = 1h) */
  CACHE_TTL_PHARMACIES?: string
}

// ============================================================================
// Planner Dataset / Manifest Types
// ============================================================================

export interface PlannerSourceSnapshot {
  snapshotId: string
  fetchedAt: number
  routingHash: string
  sourceSignature: PlannerSourceSignature
  stations: Station[]
  routes: BusRoute[]
  routeStations: RouteWithStations[]
}

export interface PlannerSourceSignature {
  routingHash: string
  stationHash: string
  routeHash: string
  routeSequenceHash: string
  activeStationCount: number
  routeCount: number
  routeSequenceCount: number
}

export interface PlannerRoutingDiff {
  previousSnapshotId: string | null
  nextSnapshotId: string
  hasRoutingChanges: boolean
  summary: {
    stationsAdded: number
    stationsRemoved: number
    stationsChanged: number
    routesAdded: number
    routesRemoved: number
    routesChanged: number
  }
  changes: string[]
}

export interface PlannerDatasetBuildReport {
  totalStations: number
  activeStations: number
  indexedStops: number
  totalRoutes: number
  indexedRoutes: number
  excludedTakviye: number
  excludedShort: number
  oppositeStopPairs: number
  nearbyTransferEdges: number
  sureCoverage: number
  warnings: string[]
}

export interface PlannerDataset {
  stopCount: number
  stopIds: number[]
  stopLat: number[]
  stopLng: number[]
  stopNames: string[]
  routeCount: number
  routeCodes: string[]
  routeNames: string[]
  routeStops: number[]
  routeStopOffsets: number[]
  routeTravelTimes: number[]
  stopRoutes: number[]
  stopRoutePos: number[]
  stopRouteOffsets: number[]
  oppositeStop: number[]
  oppositeWalkSeconds: number[]
  transferTarget: number[]
  transferWalkSeconds: number[]
  transferOffsets: number[]
  grid: Record<string, number[]>
  gridCellSize: number
  schemaVersion: number
  generatedAt: number
  buildReport: PlannerDatasetBuildReport
}

export interface PlannerCompiledDataset {
  datasetVersion: string
  sourceSnapshotId: string
  sourceSignature: PlannerSourceSignature
  schemaVersion: number
  compilerVersion: string
  generatedAt: number
  integrityHash: string
  downloadPath: string
  buildReportPath: string
  diffPath: string
  sourceSignaturePath: string
  buildReport: PlannerDatasetBuildReport
}

export interface PlannerManifestEntry {
  datasetVersion: string
  sourceSnapshotId: string
  sourceSignature: PlannerSourceSignature
  schemaVersion: number
  generatedAt: number
  integrityHash: string
  downloadUrl: string
  buildReportUrl: string
  diffUrl: string
  sourceSignatureUrl: string
}

export interface PlannerManifest {
  currentDatasetVersion: string
  rollbackDatasetVersion: string | null
  currentSourceSignature: PlannerSourceSignature | null
  minSupportedSchemaVersion: number
  compiledAt: number
  compilerVersion: string
  datasets: Record<string, PlannerManifestEntry>
}

// ============================================================================
// API Response Types
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

export interface RouteStation {
  sequence: number
  stationId: number
  stationName: string
  latitude: string
  longitude: string
  sure: string
}

export interface RouteWithStations {
  lineCode: string
  lineName: string
  stations: RouteStation[]
}

// ============================================================================
// Upstream API Response Types
// ============================================================================

export interface GetAllStationsResponse {
  isSuccess?: boolean
  value: Station[]
}

export interface GetAllRoutesResponse {
  value: BusRoute[]
}

export interface GetRouteStationsResponse {
  isSuccess?: boolean
  value: {
    stations: RouteStation[]
    lineName?: string
  }
}

// ============================================================================
// Graph Types (Pre-computed)
// ============================================================================

export interface TransitGraph {
  stations: Station[]
  routes: BusRoute[]
  routeStations: RouteWithStations[]
  generatedAt: number
  version: string
}

// ============================================================================
// Route Planning Types
// ============================================================================

export interface Coords {
  lat: number
  lng: number
}

export interface PlanRequest {
  from: Coords
  to: Coords
  fromLabel?: string
  toLabel?: string
  maxTransfers?: number
  maxResults?: number
  optimizeBy?: 'time' | 'transfers' | 'walking'
}

export interface WalkStep {
  type: 'walk'
  from: Coords
  to: Coords
  fromLabel: string
  toLabel: string
  distanceMeters: number
  durationMinutes: number
}

export interface BusStep {
  type: 'bus'
  lineCode: string
  lineName: string
  boardStation: RouteStation
  alightStation: RouteStation
  intermediateStations: RouteStation[]
  stationCount: number
  durationMinutes: number
  /**
   * Real-time wait estimate before boarding (minutes).
   * Only filled when planner augments results with upstream live data.
   */
  realtimeWaitMinutes?: number
  /** Epoch ms when the real-time data was fetched */
  realtimeUpdatedAt?: number
  /** Vehicle plate if available (optional) */
  realtimePlate?: string | null
}

export type TransferType = 'same-stop' | 'opposite-stop' | 'nearby-stop'

export interface TransferStep {
  type: 'transfer'
  transferType: TransferType
  fromStation: RouteStation
  toStation: RouteStation
  walkingMeters: number
  waitMinutes: number
  instruction: string
  /**
   * Real-time wait estimate used to override `waitMinutes` (minutes).
   * When present, `waitMinutes` will already be set to this value.
   */
  realtimeWaitMinutes?: number
  /** Epoch ms when the real-time data was fetched */
  realtimeUpdatedAt?: number
}

export type JourneyStep = WalkStep | BusStep | TransferStep

export interface JourneyPlan {
  id: string
  steps: JourneyStep[]
  totalMinutes: number
  totalWalkingMeters: number
  totalBusMinutes: number
  totalTransfers: number
  summary: string
  /** True when real-time data was applied to this plan */
  realtimeUsed?: boolean
  /** Epoch ms when the real-time data was fetched (best-effort) */
  realtimeUpdatedAt?: number
}

export interface PlanResponse {
  success: boolean
  journeys: JourneyPlan[]
  error?: string
}

// ============================================================================
// Real-time Upstream Types
// ============================================================================

export interface LiveBusArrival {
  hatno: string
  hatadi: string
  plaka: string | null
  hiz: string | null
  latitude: string | null
  longitude: string | null
  kalanduraksayisi: string | null
  beklenenDurakSira: string | null
  otobusDurakSira: string | null
  kalkisaKadarkiDakika: string | null
  sure: string | null
  xmlYazmaSaati?: string | null
  text?: string | null
}

export interface GetBusDataForStationResponse {
  isSuccess?: boolean
  value?: {
    busList?: LiveBusArrival[]
    stationName?: string
    stationId?: string
    longitude?: string
    latitude?: string
  }
  error?: string | null
}

// ============================================================================
// Route Geometry Types
// ============================================================================

// [lat, lng] format for Leaflet compatibility
export type LatLng = [number, number]

export interface RouteGeometry {
  lineCode: string
  coordinates: LatLng[]
  distance: number // meters
  duration: number // seconds
  generatedAt: number
}

// ============================================================================
// Pharmacy Types (scraped from denizli.bel.tr)
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

// ============================================================================
// Feedback Types
// ============================================================================

export type FeedbackType = 'oneri' | 'hata' | 'sikayet' | 'diger'

export interface FeedbackEntry {
  type: FeedbackType
  name?: string
  email?: string
  message: string
  createdAt: string
  userAgent: string
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry<T> {
  /** Schema version for forward/back compat */
  v: 2
  data: T
  cachedAt: number
  /** Freshness boundary (stale if now >= freshUntil) */
  freshUntil: number
  /** Hard expiry (missing if now >= expiresAt) */
  expiresAt: number
}
