import { backendOrigin, resolveBackendUrl, resolveRuntimeUrl } from './runtime-url'
import { getCurrentPosition } from '@ulasim20/data-access-capacitor'
import { Capacitor, CapacitorHttp } from '@capacitor/core'

export interface LatLng {
  lat: number
  lng: number
}

export interface RouteApiStation {
  stationId: number
  stationName: string
  lat: number
  lng: number
  routes: string[]
  distanceMeters?: number
}

export interface RouteRequest {
  origin: LatLng
  destination: LatLng
  departureTime?: string
  maxTransfers?: number
  maxWalkingDistance?: number
}

export interface RouteResponse {
  journeys: Journey[]
  origin: LatLng
  destination: LatLng
}

export interface Journey {
  totalDurationSeconds: number
  totalWalkingSeconds: number
  totalWalkingMeters: number
  transferCount: number
  departureTime: string
  arrivalTime: string
  legs: Leg[]
  transferAlternatives: TransferAlternative[]
}

export interface LegStation {
  stationId?: number | null
  stationName: string
  lat: number
  lng: number
}

export interface LiveBusInfo {
  plate: string
  estimatedArrivalSeconds: number
  remainingStops: number
  isScheduled: boolean
}

export interface LiveInfo {
  nextBus: LiveBusInfo | null
  alternativeBuses: LiveBusInfo[]
}

export interface Leg {
  type: 'walk' | 'bus'
  from: LegStation
  to: LegStation
  durationSeconds: number
  distanceMeters?: number
  lineCode?: string
  lineName?: string
  stopCount?: number
  departureTime: string
  arrivalTime: string
  liveInfo?: LiveInfo | null
}

export interface TransferAlternativeOption {
  lineCodes: string[]
  alightAt: string
  alightStationId: number
  distanceToTargetMeters: number
}

export interface TransferAlternative {
  afterLegIndex: number
  transferStopName: string
  originalLine: string
  alternatives: TransferAlternativeOption[]
}

export interface HealthResponse {
  status: 'healthy' | 'initializing'
  ready: boolean
  graph: { stops: number; routes: number; transferEdges: number }
  spatialIndex: { size: number }
  estimator: { learnedEdges: number }
  headways: { routesWithData: number }
  meta: Record<string, string>
}

export interface PlannerInstallState {
  installed: boolean
  loading: boolean
  progress: number
  stopCount: number
  routeCount: number
  generatedAt: number | null
  schemaVersion: number | null
  datasetVersion?: string | null
  approvedDatasetVersion?: string | null
  updateAvailable?: boolean
}

export interface RouteLocation {
  id: string
  kind: 'station' | 'poi' | 'current'
  label: string
  secondaryLabel?: string
  lat: number
  lng: number
  stationId?: number
  routes?: string[]
}

interface RaptorIndex {
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
  buildReport?: {
    indexedStops?: number
    indexedRoutes?: number
    nearbyTransferEdges?: number
  }
}

interface CachedDatasetRecord {
  key: 'active'
  datasetVersion: string
  dataset: RaptorIndex
}

interface PlannerManifestEntry {
  datasetVersion: string
  sourceSnapshotId: string
  schemaVersion: number
  generatedAt: number
  integrityHash: string
  downloadUrl: string
  buildReportUrl: string
  diffUrl: string
}

interface PlannerManifest {
  currentDatasetVersion: string
  rollbackDatasetVersion: string | null
  minSupportedSchemaVersion: number
  compiledAt: number
  compilerVersion: string
  datasets: Record<string, PlannerManifestEntry>
}

interface PositionLink {
  routeIndex: number
  routePos: number
  positionIndex: number
}

interface SearchCandidate {
  stopIndex: number
  distanceMeters: number
  durationSeconds: number
}

interface PrevEdge {
  previousStateIndex: number
  action: 'start' | 'ride' | 'transfer'
  fromStopIndex?: number
  toStopIndex?: number
  walkSeconds?: number
}

interface GoalCandidate {
  stateIndex: number
  stopIndex: number
  egressSeconds: number
  egressMeters: number
  score: number
  transfersUsed: number
}

const MANIFEST_URL = (() => {
  const envUrl = import.meta.env.VITE_BACKEND_URL
  if (!envUrl) return '/api/planner/manifest'
  return envUrl.endsWith('/api') ? `${envUrl}/planner/manifest` : `${envUrl}/api/planner/manifest`
})()
const DB_NAME = 'offline-route-planner'
const DB_VERSION = 1
const STORE_NAME = 'datasets'
const RECORD_KEY = 'active'
const STATIC_DATASET_VERSION = 'static-bundled-v1'
const STATIC_DATASET_URL = '/data/raptor-index.json'

const WALK_SPEED_MPS = 1.25
const MAX_CANDIDATE_STOPS = 16
const MAX_GOAL_VARIANTS = 8
const MAX_RESULTS = 5
const TRANSFER_PENALTY_SECONDS = 6 * 60
const SAME_STOP_TRANSFER_SECONDS = 60
const DIRECT_WALK_FLOOR_SECONDS = 30

let memoryDataset: RaptorIndex | null = null
let memoryStations: RouteApiStation[] | null = null
let loadPromise: Promise<RaptorIndex | null> | null = null
let memoryDatasetVersion: string | null = null
let manifestPromise: Promise<PlannerManifest> | null = null
let installState: PlannerInstallState = {
  installed: false,
  loading: false,
  progress: 0,
  stopCount: 0,
  routeCount: 0,
  generatedAt: null,
  schemaVersion: null,
  datasetVersion: null,
  approvedDatasetVersion: null,
  updateAvailable: false,
}

function cloneInstallState(): PlannerInstallState {
  return { ...installState }
}

function setInstallState(patch: Partial<PlannerInstallState>): PlannerInstallState {
  installState = { ...installState, ...patch }
  return cloneInstallState()
}

function openPlannerDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    request.onerror = () => reject(request.error ?? new Error('IndexedDB açılamadı.'))
    request.onsuccess = () => resolve(request.result)
  })
}

function idbGetRecord(): Promise<CachedDatasetRecord | null> {
  return openPlannerDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const request = store.get(RECORD_KEY)
        request.onerror = () => reject(request.error ?? new Error('Veri okunamadı.'))
        request.onsuccess = () =>
          resolve((request.result as CachedDatasetRecord | undefined) ?? null)
      }),
  )
}

function idbPutRecord(record: CachedDatasetRecord): Promise<void> {
  return openPlannerDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('Veri yazılamadı.'))
        tx.objectStore(STORE_NAME).put(record)
      }),
  )
}

function idbDeleteRecord(): Promise<void> {
  return openPlannerDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('Veri silinemedi.'))
        tx.objectStore(STORE_NAME).delete(RECORD_KEY)
      }),
  )
}

function assertDataset(dataset: RaptorIndex): void {
  if (
    !dataset.stopCount ||
    dataset.stopIds.length !== dataset.stopCount ||
    dataset.stopLat.length !== dataset.stopCount ||
    dataset.stopLng.length !== dataset.stopCount ||
    dataset.stopNames.length !== dataset.stopCount ||
    dataset.routeCodes.length !== dataset.routeCount ||
    dataset.routeStopOffsets.length !== dataset.routeCount + 1 ||
    dataset.stopRouteOffsets.length !== dataset.stopCount + 1 ||
    dataset.transferOffsets.length !== dataset.stopCount + 1
  ) {
    throw new Error('Rota veri seti beklenen biçimde değil.')
  }
}

function fallbackManifest(): PlannerManifest {
  return {
    currentDatasetVersion: STATIC_DATASET_VERSION,
    rollbackDatasetVersion: null,
    minSupportedSchemaVersion: 1,
    compiledAt: 0,
    compilerVersion: 'static-fallback',
    datasets: {
      [STATIC_DATASET_VERSION]: {
        datasetVersion: STATIC_DATASET_VERSION,
        sourceSnapshotId: 'static-fallback',
        schemaVersion: 1,
        generatedAt: 0,
        integrityHash: '',
        downloadUrl: STATIC_DATASET_URL,
        buildReportUrl: '',
        diffUrl: '',
      },
    },
  }
}

function hydrateInstallState(dataset: RaptorIndex): PlannerInstallState {
  return setInstallState({
    installed: true,
    loading: false,
    progress: 100,
    stopCount: dataset.stopCount,
    routeCount: dataset.routeCount,
    generatedAt: dataset.generatedAt,
    schemaVersion: dataset.schemaVersion,
    datasetVersion: memoryDatasetVersion,
  })
}

async function fetchDatasetFromUrl(
  url: string,
  onProgress?: (progress: number) => void,
): Promise<RaptorIndex> {
  // Use resolveRuntimeUrl (not resolveBackendUrl) so that bundled static
  // fallback paths like /data/raptor-index.json still end up with a proper
  // protocol on native — otherwise CapacitorHttp throws "no protocol".
  const resolvedUrl = resolveRuntimeUrl(url)

  // Native build: go through CapacitorHttp so requests bypass the WebView's
  // https://localhost origin and any CORS / mixed-content surprises. We lose
  // streaming progress, so we just flip 0 → 100.
  if (Capacitor.isNativePlatform()) {
    onProgress?.(0)
    const response = await CapacitorHttp.request({
      method: 'GET',
      url: resolvedUrl,
      headers: { Accept: 'application/json', 'Cache-Control': 'no-store' },
    })
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Rota veri seti indirilemedi (HTTP ${response.status}). ` + `URL: ${resolvedUrl}`,
      )
    }
    const dataset =
      typeof response.data === 'string'
        ? (JSON.parse(response.data) as RaptorIndex)
        : (response.data as RaptorIndex)
    assertDataset(dataset)
    onProgress?.(100)
    return dataset
  }

  const response = await fetch(resolvedUrl, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error('Rota veri seti indirilemedi.')
  }

  if (!response.body) {
    const dataset = (await response.json()) as RaptorIndex
    assertDataset(dataset)
    onProgress?.(100)
    return dataset
  }

  const total = Number(response.headers.get('Content-Length') || 0)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      loaded += value.length
      if (total > 0) {
        onProgress?.(Math.min(100, Math.round((loaded / total) * 100)))
      }
    }
  }

  const merged = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }

  const dataset = JSON.parse(new TextDecoder().decode(merged)) as RaptorIndex
  assertDataset(dataset)
  onProgress?.(100)
  return dataset
}

async function fetchPlannerManifest(): Promise<PlannerManifest> {
  if (manifestPromise) return manifestPromise
  const manifestUrl = resolveBackendUrl(MANIFEST_URL)
  manifestPromise = (async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const response = await CapacitorHttp.request({
          method: 'GET',
          url: manifestUrl,
          headers: { Accept: 'application/json', 'Cache-Control': 'no-store' },
        })
        if (response.status < 200 || response.status >= 300) {
          return fallbackManifest()
        }
        const data = (
          typeof response.data === 'string' ? JSON.parse(response.data) : response.data
        ) as PlannerManifest
        return data
      }
      const response = await fetch(manifestUrl, { cache: 'no-store' })
      if (!response.ok) return fallbackManifest()
      return response.json() as Promise<PlannerManifest>
    } catch {
      return fallbackManifest()
    }
  })()
  try {
    return await manifestPromise
  } finally {
    manifestPromise = null
  }
}

async function loadDataset(): Promise<RaptorIndex | null> {
  if (memoryDataset) return memoryDataset
  if (loadPromise) return loadPromise

  loadPromise = idbGetRecord()
    .then((record) => {
      if (!record?.dataset) {
        setInstallState({
          installed: false,
          loading: false,
          progress: 0,
          stopCount: 0,
          routeCount: 0,
          generatedAt: null,
          schemaVersion: null,
          datasetVersion: null,
        })
        return null
      }
      assertDataset(record.dataset)
      memoryDataset = record.dataset
      memoryDatasetVersion = record.datasetVersion
      hydrateInstallState(record.dataset)
      return record.dataset
    })
    .finally(() => {
      loadPromise = null
    })

  return loadPromise
}

function buildStations(dataset: RaptorIndex): RouteApiStation[] {
  if (memoryStations) return memoryStations

  const stations: RouteApiStation[] = Array.from({ length: dataset.stopCount }, (_, stopIndex) => {
    const start = dataset.stopRouteOffsets[stopIndex]
    const end = dataset.stopRouteOffsets[stopIndex + 1]
    const routes: string[] = []
    for (let idx = start; idx < end; idx += 1) {
      const routeCode = dataset.routeCodes[dataset.stopRoutes[idx]]
      if (!routes.includes(routeCode)) routes.push(routeCode)
    }

    return {
      stationId: dataset.stopIds[stopIndex],
      stationName: dataset.stopNames[stopIndex],
      lat: dataset.stopLat[stopIndex],
      lng: dataset.stopLng[stopIndex],
      routes,
    }
  })

  memoryStations = stations
  return stations
}

function toRad(value: number): number {
  return (value * Math.PI) / 180
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const earth = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)))
}

function walkSecondsFromMeters(distanceMeters: number): number {
  return Math.max(DIRECT_WALK_FLOOR_SECONDS, Math.round(distanceMeters / WALK_SPEED_MPS))
}

function formatTime(epochMs: number): string {
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(epochMs)
}

function routePositionIndex(dataset: RaptorIndex, routeIndex: number, routePos: number): number {
  return dataset.routeStopOffsets[routeIndex] + routePos
}

function stopIndexFromPosition(dataset: RaptorIndex, positionIndex: number): number {
  return dataset.routeStops[positionIndex]
}

function routeIndexFromPosition(dataset: RaptorIndex, positionIndex: number): number {
  let low = 0
  let high = dataset.routeCount - 1

  while (low <= high) {
    const mid = (low + high) >> 1
    const start = dataset.routeStopOffsets[mid]
    const end = dataset.routeStopOffsets[mid + 1]
    if (positionIndex < start) {
      high = mid - 1
    } else if (positionIndex >= end) {
      low = mid + 1
    } else {
      return mid
    }
  }

  throw new Error('Route position çözümlenemedi.')
}

function routePosFromPosition(
  dataset: RaptorIndex,
  positionIndex: number,
  routeIndex?: number,
): number {
  const currentRoute = routeIndex ?? routeIndexFromPosition(dataset, positionIndex)
  return positionIndex - dataset.routeStopOffsets[currentRoute]
}

function getPositionLinksForStop(dataset: RaptorIndex, stopIndex: number): PositionLink[] {
  const start = dataset.stopRouteOffsets[stopIndex]
  const end = dataset.stopRouteOffsets[stopIndex + 1]
  const links: PositionLink[] = []

  for (let index = start; index < end; index += 1) {
    const routeIndex = dataset.stopRoutes[index]
    const routePos = dataset.stopRoutePos[index]
    links.push({
      routeIndex,
      routePos,
      positionIndex: routePositionIndex(dataset, routeIndex, routePos),
    })
  }

  return links
}

function stopPoint(dataset: RaptorIndex, stopIndex: number): LatLng {
  return { lat: dataset.stopLat[stopIndex], lng: dataset.stopLng[stopIndex] }
}

function nearbyStops(dataset: RaptorIndex, point: LatLng, maxMeters: number): SearchCandidate[] {
  const latCells = Math.ceil(maxMeters / 111320 / dataset.gridCellSize) + 1
  const lngCells = Math.ceil(maxMeters / 111320 / dataset.gridCellSize) + 1
  const baseLat = Math.floor(point.lat / dataset.gridCellSize)
  const baseLng = Math.floor(point.lng / dataset.gridCellSize)
  const seen = new Set<number>()
  const candidates: SearchCandidate[] = []

  for (let latOffset = -latCells; latOffset <= latCells; latOffset += 1) {
    for (let lngOffset = -lngCells; lngOffset <= lngCells; lngOffset += 1) {
      const key = `${baseLat + latOffset}:${baseLng + lngOffset}`
      const stops = dataset.grid[key]
      if (!stops) continue
      for (const stopIndex of stops) {
        if (seen.has(stopIndex)) continue
        seen.add(stopIndex)
        const distanceMeters = haversineMeters(point, stopPoint(dataset, stopIndex))
        if (distanceMeters <= maxMeters) {
          candidates.push({
            stopIndex,
            distanceMeters,
            durationSeconds: walkSecondsFromMeters(distanceMeters),
          })
        }
      }
    }
  }

  candidates.sort((a, b) => a.distanceMeters - b.distanceMeters)
  return candidates.slice(0, MAX_CANDIDATE_STOPS)
}

class MinHeap {
  private values: Array<{ priority: number; stateIndex: number }> = []

  push(item: { priority: number; stateIndex: number }): void {
    this.values.push(item)
    this.bubbleUp(this.values.length - 1)
  }

  pop(): { priority: number; stateIndex: number } | undefined {
    if (this.values.length === 0) return undefined
    const first = this.values[0]
    const last = this.values.pop()
    if (last === undefined) return undefined
    if (this.values.length > 0) {
      this.values[0] = last
      this.bubbleDown(0)
    }
    return first
  }

  get size(): number {
    return this.values.length
  }

  private bubbleUp(index: number): void {
    let current = index
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2)
      if (this.values[parent].priority <= this.values[current].priority) break
      ;[this.values[parent], this.values[current]] = [this.values[current], this.values[parent]]
      current = parent
    }
  }

  private bubbleDown(index: number): void {
    let current = index
    while (true) {
      const left = current * 2 + 1
      const right = left + 1
      let next = current

      if (left < this.values.length && this.values[left].priority < this.values[next].priority) {
        next = left
      }
      if (right < this.values.length && this.values[right].priority < this.values[next].priority) {
        next = right
      }
      if (next === current) break
      ;[this.values[current], this.values[next]] = [this.values[next], this.values[current]]
      current = next
    }
  }
}

function buildWalkLeg(
  from: LegStation,
  to: LegStation,
  distanceMeters: number,
  durationSeconds: number,
  startEpochMs: number,
): Leg {
  return {
    type: 'walk',
    from,
    to,
    durationSeconds,
    distanceMeters: Math.round(distanceMeters),
    departureTime: formatTime(startEpochMs),
    arrivalTime: formatTime(startEpochMs + durationSeconds * 1000),
    liveInfo: null,
  }
}

function buildStopStation(dataset: RaptorIndex, stopIndex: number): LegStation {
  return {
    stationId: dataset.stopIds[stopIndex],
    stationName: dataset.stopNames[stopIndex],
    lat: dataset.stopLat[stopIndex],
    lng: dataset.stopLng[stopIndex],
  }
}

function buildNamedStation(name: string, point: LatLng): LegStation {
  return {
    stationId: null,
    stationName: name,
    lat: point.lat,
    lng: point.lng,
  }
}

function buildJourneyFromGoal(
  dataset: RaptorIndex,
  goal: GoalCandidate,
  prevEdges: Array<PrevEdge | null>,
  origin: RouteLocation,
  destination: RouteLocation,
  stride: number,
): Journey | null {
  const stateSequence: number[] = []
  let cursor = goal.stateIndex
  while (cursor >= 0) {
    stateSequence.push(cursor)
    const prev = prevEdges[cursor]
    if (!prev || prev.previousStateIndex < 0) break
    cursor = prev.previousStateIndex
  }
  stateSequence.reverse()

  if (stateSequence.length === 0) return null

  const legs: Leg[] = []
  let timelineEpoch = Date.now()
  const journeyStart = timelineEpoch
  let totalWalkingSeconds = 0
  let totalWalkingMeters = 0
  // biome-ignore lint/correctness/noUnusedVariables: tracked locally for parity with walking totals
  let totalBusSeconds = 0

  const firstState = stateSequence[0]
  const firstStateMeta = prevEdges[firstState]
  const firstPositionIndex = Math.floor(firstState / stride)
  const firstStopIndex = stopIndexFromPosition(dataset, firstPositionIndex)

  if (firstStateMeta?.walkSeconds && firstStateMeta.walkSeconds > 0) {
    const distanceMeters = haversineMeters(origin, stopPoint(dataset, firstStopIndex))
    const walkLeg = buildWalkLeg(
      buildNamedStation(origin.label, origin),
      buildStopStation(dataset, firstStopIndex),
      distanceMeters,
      firstStateMeta.walkSeconds,
      timelineEpoch,
    )
    legs.push(walkLeg)
    totalWalkingSeconds += walkLeg.durationSeconds
    totalWalkingMeters += walkLeg.distanceMeters ?? 0
    timelineEpoch += walkLeg.durationSeconds * 1000
  }

  let segmentStartState = firstState

  const pushBusLeg = (fromStateIndex: number, toStateIndex: number): void => {
    const fromPositionIndex = Math.floor(fromStateIndex / stride)
    const toPositionIndex = Math.floor(toStateIndex / stride)
    const routeIndex = routeIndexFromPosition(dataset, fromPositionIndex)
    const fromStopIndex = stopIndexFromPosition(dataset, fromPositionIndex)
    const toStopIndex = stopIndexFromPosition(dataset, toPositionIndex)
    const fromRoutePos = routePosFromPosition(dataset, fromPositionIndex, routeIndex)
    const toRoutePos = routePosFromPosition(dataset, toPositionIndex, routeIndex)
    const startTime = dataset.routeTravelTimes[fromPositionIndex]
    const endTime = dataset.routeTravelTimes[toPositionIndex]
    const durationSeconds = Math.max(60, endTime - startTime)

    if (toRoutePos <= fromRoutePos) return

    legs.push({
      type: 'bus',
      from: buildStopStation(dataset, fromStopIndex),
      to: buildStopStation(dataset, toStopIndex),
      durationSeconds,
      lineCode: dataset.routeCodes[routeIndex],
      lineName: dataset.routeNames[routeIndex],
      stopCount: toRoutePos - fromRoutePos,
      departureTime: formatTime(timelineEpoch),
      arrivalTime: formatTime(timelineEpoch + durationSeconds * 1000),
      liveInfo: null,
    })
    totalBusSeconds += durationSeconds
    timelineEpoch += durationSeconds * 1000
  }

  for (let seqIndex = 1; seqIndex < stateSequence.length; seqIndex += 1) {
    const currentState = stateSequence[seqIndex]
    const previousState = stateSequence[seqIndex - 1]
    const currentRouteIndex = routeIndexFromPosition(dataset, Math.floor(currentState / stride))
    const previousRouteIndex = routeIndexFromPosition(dataset, Math.floor(previousState / stride))

    if (currentRouteIndex === previousRouteIndex) continue

    pushBusLeg(segmentStartState, previousState)

    const edge = prevEdges[currentState]
    const fromStopIndex = edge?.fromStopIndex ?? stopIndexFromPosition(dataset, previousState)
    const toStopIndex = edge?.toStopIndex ?? stopIndexFromPosition(dataset, currentState)
    const transferDuration = Math.max(
      SAME_STOP_TRANSFER_SECONDS,
      edge?.walkSeconds ?? SAME_STOP_TRANSFER_SECONDS,
    )
    const transferDistance = haversineMeters(
      stopPoint(dataset, fromStopIndex),
      stopPoint(dataset, toStopIndex),
    )
    const walkLeg = buildWalkLeg(
      buildStopStation(dataset, fromStopIndex),
      buildStopStation(dataset, toStopIndex),
      transferDistance,
      transferDuration,
      timelineEpoch,
    )

    legs.push(walkLeg)
    totalWalkingSeconds += walkLeg.durationSeconds
    totalWalkingMeters += walkLeg.distanceMeters ?? 0
    timelineEpoch += walkLeg.durationSeconds * 1000
    segmentStartState = currentState
  }

  pushBusLeg(segmentStartState, stateSequence[stateSequence.length - 1])

  if (goal.egressSeconds > 0) {
    const finalStopIndex = goal.stopIndex
    const walkLeg = buildWalkLeg(
      buildStopStation(dataset, finalStopIndex),
      buildNamedStation(destination.label, destination),
      goal.egressMeters,
      goal.egressSeconds,
      timelineEpoch,
    )
    legs.push(walkLeg)
    totalWalkingSeconds += walkLeg.durationSeconds
    totalWalkingMeters += walkLeg.distanceMeters ?? 0
    timelineEpoch += walkLeg.durationSeconds * 1000
  }

  const busLegs = legs.filter((leg) => leg.type === 'bus')
  if (busLegs.length === 0) return null

  return {
    totalDurationSeconds: Math.round((timelineEpoch - journeyStart) / 1000),
    totalWalkingSeconds,
    totalWalkingMeters: Math.round(totalWalkingMeters),
    transferCount: Math.max(0, busLegs.length - 1),
    departureTime: formatTime(journeyStart),
    arrivalTime: formatTime(timelineEpoch),
    legs,
    transferAlternatives: [],
  }
}

function directWalkingJourney(
  origin: RouteLocation,
  destination: RouteLocation,
  distanceMeters: number,
): Journey {
  const durationSeconds = walkSecondsFromMeters(distanceMeters)
  const startEpoch = Date.now()
  const walkLeg = buildWalkLeg(
    buildNamedStation(origin.label, origin),
    buildNamedStation(destination.label, destination),
    distanceMeters,
    durationSeconds,
    startEpoch,
  )

  return {
    totalDurationSeconds: durationSeconds,
    totalWalkingSeconds: durationSeconds,
    totalWalkingMeters: Math.round(distanceMeters),
    transferCount: 0,
    departureTime: walkLeg.departureTime,
    arrivalTime: walkLeg.arrivalTime,
    legs: [walkLeg],
    transferAlternatives: [],
  }
}

function uniqueJourneyKey(journey: Journey): string {
  const busLines = journey.legs
    .filter(
      (leg): leg is Leg & { type: 'bus'; lineCode: string } =>
        leg.type === 'bus' && Boolean(leg.lineCode),
    )
    .map((leg) => `${leg.lineCode}:${leg.from.stationName}->${leg.to.stationName}`)
  return busLines.join('|')
}

function createStopCandidateLocation(station: RouteApiStation): RouteLocation {
  return {
    id: `station:${station.stationId}`,
    kind: 'station',
    label: station.stationName,
    lat: station.lat,
    lng: station.lng,
    stationId: station.stationId,
    routes: station.routes,
  }
}

function createCurrentLocation(lat: number, lng: number): RouteLocation {
  return {
    id: 'current-location',
    kind: 'current',
    label: 'Konumum',
    lat,
    lng,
  }
}

function normalizeLocation(input: RouteLocation | LatLng, fallbackLabel: string): RouteLocation {
  if ('kind' in input) return input
  return {
    id: `${input.lat},${input.lng}`,
    kind: 'poi',
    label: fallbackLabel,
    lat: input.lat,
    lng: input.lng,
  }
}

export async function getOfflinePlannerStatus(): Promise<PlannerInstallState> {
  const manifest = await fetchPlannerManifest()
  const dataset = await loadDataset()
  if (!dataset) {
    return setInstallState({
      approvedDatasetVersion: manifest.currentDatasetVersion,
      updateAvailable: false,
    })
  }
  return setInstallState({
    ...hydrateInstallState(dataset),
    approvedDatasetVersion: manifest.currentDatasetVersion,
    updateAvailable: memoryDatasetVersion !== manifest.currentDatasetVersion,
  })
}

export async function installOfflinePlanner(
  onProgress?: (progress: number) => void,
): Promise<PlannerInstallState> {
  setInstallState({ loading: true, progress: 0 })
  const manifest = await fetchPlannerManifest()
  const approvedEntry = manifest.datasets[manifest.currentDatasetVersion]
  const downloadUrl = approvedEntry?.downloadUrl || STATIC_DATASET_URL

  // On native the bundled static dataset isn't shipped with the APK, so the
  // fallback manifest is unusable. Surface an actionable error instead of
  // letting CapacitorHttp throw a cryptic "no protocol" / 404.
  if (Capacitor.isNativePlatform() && manifest.compilerVersion === 'static-fallback') {
    setInstallState({ loading: false, progress: 0 })
    const reason = backendOrigin
      ? `Arka uç manifesti alınamadı (${backendOrigin}). Bağlantıyı kontrol edin.`
      : 'APK VITE_BACKEND_URL olmadan derlendi; arka uç adresi ayarlanmalı.'
    throw new Error(`Rota veri seti indirilemedi: ${reason}`)
  }

  const dataset = await fetchDatasetFromUrl(downloadUrl, (progress) => {
    setInstallState({ loading: true, progress })
    onProgress?.(progress)
  })
  await idbPutRecord({
    key: RECORD_KEY,
    datasetVersion: approvedEntry?.datasetVersion || STATIC_DATASET_VERSION,
    dataset,
  })
  memoryDataset = dataset
  memoryDatasetVersion = approvedEntry?.datasetVersion || STATIC_DATASET_VERSION
  memoryStations = null
  return setInstallState({
    ...hydrateInstallState(dataset),
    approvedDatasetVersion: manifest.currentDatasetVersion,
    updateAvailable: false,
  })
}

export async function clearOfflinePlanner(): Promise<void> {
  await idbDeleteRecord()
  memoryDataset = null
  memoryDatasetVersion = null
  memoryStations = null
  setInstallState({
    installed: false,
    loading: false,
    progress: 0,
    stopCount: 0,
    routeCount: 0,
    generatedAt: null,
    schemaVersion: null,
    datasetVersion: null,
    approvedDatasetVersion: null,
    updateAvailable: false,
  })
}

export async function checkOfflinePlannerHealth(): Promise<HealthResponse> {
  const dataset = await loadDataset()
  if (!dataset) {
    return {
      status: 'initializing',
      ready: false,
      graph: { stops: 0, routes: 0, transferEdges: 0 },
      spatialIndex: { size: 0 },
      estimator: { learnedEdges: 0 },
      headways: { routesWithData: 0 },
      meta: {},
    }
  }

  return {
    status: 'healthy',
    ready: true,
    graph: {
      stops: dataset.stopCount,
      routes: dataset.routeCount,
      transferEdges: dataset.transferTarget.length,
    },
    spatialIndex: { size: Object.keys(dataset.grid).length },
    estimator: { learnedEdges: dataset.routeStops.length },
    headways: { routesWithData: 0 },
    meta: {
      schemaVersion: String(dataset.schemaVersion),
      generatedAt: String(dataset.generatedAt),
    },
  }
}

export async function getAllOfflinePlannerStations(): Promise<RouteApiStation[]> {
  const dataset = await loadDataset()
  if (!dataset) {
    throw new Error('Rota veri seti henüz kurulmadı.')
  }
  return buildStations(dataset)
}

export async function findOfflineRoute(
  request: RouteRequest,
  originInput?: RouteLocation,
  destinationInput?: RouteLocation,
): Promise<RouteResponse> {
  const dataset = await loadDataset()
  if (!dataset) {
    throw new Error('Rota veri seti henüz kurulmadı.')
  }

  const maxTransfers = Math.max(0, Math.min(4, request.maxTransfers ?? 2))
  const maxWalkingDistance = Math.max(200, request.maxWalkingDistance ?? 1500)
  const origin = normalizeLocation(originInput ?? request.origin, 'Başlangıç')
  const destination = normalizeLocation(destinationInput ?? request.destination, 'Varış')

  const directWalkDistance = haversineMeters(origin, destination)
  const journeys: Journey[] = []
  if (directWalkDistance <= maxWalkingDistance) {
    journeys.push(directWalkingJourney(origin, destination, directWalkDistance))
  }

  const originCandidates = nearbyStops(dataset, origin, maxWalkingDistance)
  const destinationCandidates = nearbyStops(dataset, destination, maxWalkingDistance)

  if (originCandidates.length === 0 || destinationCandidates.length === 0) {
    return {
      journeys,
      origin: request.origin,
      destination: request.destination,
    }
  }

  const positions = dataset.routeStops.length
  const stride = maxTransfers + 1
  const stateCount = positions * stride
  const distances = new Float64Array(stateCount)
  distances.fill(Number.POSITIVE_INFINITY)
  const prevEdges: Array<PrevEdge | null> = Array.from({ length: stateCount }, () => null)
  const heap = new MinHeap()

  const visitedStartingStates = new Set<number>()
  for (const candidate of originCandidates) {
    for (const link of getPositionLinksForStop(dataset, candidate.stopIndex)) {
      const stateIndex = link.positionIndex * stride
      if (visitedStartingStates.has(stateIndex)) continue
      visitedStartingStates.add(stateIndex)
      const startCost = candidate.durationSeconds
      distances[stateIndex] = startCost
      prevEdges[stateIndex] = {
        previousStateIndex: -1,
        action: 'start',
        fromStopIndex: candidate.stopIndex,
        toStopIndex: candidate.stopIndex,
        walkSeconds: candidate.durationSeconds,
      }
      heap.push({ priority: startCost, stateIndex })
    }
  }

  while (heap.size > 0) {
    const current = heap.pop()
    if (!current || current.priority > distances[current.stateIndex]) continue

    const transferCount = current.stateIndex % stride
    const positionIndex = Math.floor(current.stateIndex / stride)
    const routeIndex = routeIndexFromPosition(dataset, positionIndex)
    const routeEnd = dataset.routeStopOffsets[routeIndex + 1]
    if (positionIndex + 1 < routeEnd) {
      const travelSeconds = Math.max(
        30,
        dataset.routeTravelTimes[positionIndex + 1] - dataset.routeTravelTimes[positionIndex],
      )
      const nextStateIndex = (positionIndex + 1) * stride + transferCount
      const nextCost = current.priority + travelSeconds
      if (nextCost < distances[nextStateIndex]) {
        distances[nextStateIndex] = nextCost
        prevEdges[nextStateIndex] = {
          previousStateIndex: current.stateIndex,
          action: 'ride',
        }
        heap.push({ priority: nextCost, stateIndex: nextStateIndex })
      }
    }

    if (transferCount >= maxTransfers) continue

    const currentStopIndex = dataset.routeStops[positionIndex]
    const transferStops: Array<{ stopIndex: number; walkSeconds: number }> = [
      { stopIndex: currentStopIndex, walkSeconds: SAME_STOP_TRANSFER_SECONDS },
    ]

    const oppositeStopIndex = dataset.oppositeStop[currentStopIndex]
    if (oppositeStopIndex >= 0) {
      transferStops.push({
        stopIndex: oppositeStopIndex,
        walkSeconds: Math.max(
          SAME_STOP_TRANSFER_SECONDS,
          dataset.oppositeWalkSeconds[currentStopIndex] || SAME_STOP_TRANSFER_SECONDS,
        ),
      })
    }

    const transferStart = dataset.transferOffsets[currentStopIndex]
    const transferEnd = dataset.transferOffsets[currentStopIndex + 1]
    for (let transferIndex = transferStart; transferIndex < transferEnd; transferIndex += 1) {
      transferStops.push({
        stopIndex: dataset.transferTarget[transferIndex],
        walkSeconds: Math.max(
          SAME_STOP_TRANSFER_SECONDS,
          dataset.transferWalkSeconds[transferIndex] || SAME_STOP_TRANSFER_SECONDS,
        ),
      })
    }

    for (const transfer of transferStops) {
      for (const link of getPositionLinksForStop(dataset, transfer.stopIndex)) {
        if (link.routeIndex === routeIndex) continue
        const nextStateIndex = link.positionIndex * stride + transferCount + 1
        const nextCost = current.priority + transfer.walkSeconds + TRANSFER_PENALTY_SECONDS
        if (nextCost < distances[nextStateIndex]) {
          distances[nextStateIndex] = nextCost
          prevEdges[nextStateIndex] = {
            previousStateIndex: current.stateIndex,
            action: 'transfer',
            fromStopIndex: currentStopIndex,
            toStopIndex: transfer.stopIndex,
            walkSeconds: transfer.walkSeconds,
          }
          heap.push({ priority: nextCost, stateIndex: nextStateIndex })
        }
      }
    }
  }

  const goals: GoalCandidate[] = []
  for (const destinationCandidate of destinationCandidates) {
    for (const link of getPositionLinksForStop(dataset, destinationCandidate.stopIndex)) {
      for (let transfersUsed = 0; transfersUsed <= maxTransfers; transfersUsed += 1) {
        const stateIndex = link.positionIndex * stride + transfersUsed
        const distance = distances[stateIndex]
        if (!Number.isFinite(distance)) continue
        goals.push({
          stateIndex,
          stopIndex: destinationCandidate.stopIndex,
          egressSeconds: destinationCandidate.durationSeconds,
          egressMeters: destinationCandidate.distanceMeters,
          score: distance + destinationCandidate.durationSeconds,
          transfersUsed,
        })
      }
    }
  }

  goals.sort((a, b) => a.score - b.score)

  const seenJourneyKeys = new Set<string>(journeys.map(uniqueJourneyKey))
  for (const goal of goals.slice(0, MAX_GOAL_VARIANTS * MAX_RESULTS)) {
    const journey = buildJourneyFromGoal(dataset, goal, prevEdges, origin, destination, stride)
    if (!journey) continue
    if (journey.transferCount > maxTransfers) continue
    const key = uniqueJourneyKey(journey)
    if (seenJourneyKeys.has(key)) continue
    seenJourneyKeys.add(key)
    journeys.push(journey)
    if (journeys.length >= MAX_RESULTS) break
  }

  journeys.sort((a, b) => {
    if (a.totalDurationSeconds !== b.totalDurationSeconds) {
      return a.totalDurationSeconds - b.totalDurationSeconds
    }
    if (a.transferCount !== b.transferCount) {
      return a.transferCount - b.transferCount
    }
    return a.totalWalkingMeters - b.totalWalkingMeters
  })

  return {
    journeys,
    origin: request.origin,
    destination: request.destination,
  }
}

export async function useCurrentLocation(): Promise<RouteLocation> {
  const position = await getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 })
  return createCurrentLocation(position.coords.latitude, position.coords.longitude)
}

export function toRouteLocationFromStation(station: RouteApiStation): RouteLocation {
  return createStopCandidateLocation(station)
}
