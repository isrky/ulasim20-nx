import type {
  BusRoute,
  PlannerDataset,
  PlannerDatasetBuildReport,
  PlannerRoutingDiff,
  PlannerSourceSignature,
  PlannerSourceSnapshot,
  RouteWithStations,
  Station,
} from '../types'

const GRID_CELL_SIZE = 0.002
const SCHEMA_VERSION = 2
const COMPILER_VERSION = 'planner-compiler-1'
const TRANSFER_DISTANCE_METERS = 250
const OPPOSITE_DISTANCE_METERS = 120

interface NormalizedStop {
  stationId: number
  stationName: string
  lat: number
  lng: number
}

function toNumber(input: string | number | null | undefined): number {
  if (typeof input === 'number') return input
  if (!input) return 0
  return Number(String(input).replace(',', '.')) || 0
}

function stationLatLng(station: Station | NormalizedStop): { lat: number; lng: number } {
  if ('lat' in station) return { lat: station.lat, lng: station.lng }
  return {
    lat: toNumber(station.latitudeF || station.latitude),
    lng: toNumber(station.longitudeF || station.longitude),
  }
}

function normalizeStationName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('tr-TR')
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const earth = 6371000
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)))
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function cumulativeTravelTimes(route: RouteWithStations, warnings: string[]): number[] {
  const times: number[] = []
  let previous = 0
  let sureCoverage = 0

  for (let i = 0; i < route.stations.length; i += 1) {
    const station = route.stations[i]
    const parsed = toNumber(station.sure)
    if (i === 0) {
      previous = 0
      times.push(0)
      continue
    }
    if (parsed > previous) {
      previous = parsed
      sureCoverage += 1
      times.push(parsed)
    } else {
      previous += 90
      times.push(previous)
    }
  }

  if (route.stations.length > 1 && sureCoverage === 0) {
    warnings.push(`Route ${route.lineCode} had no usable sure values; defaults applied.`)
  }

  return times
}

async function buildSourceSignaturePayload(
  stations: Station[],
  routes: BusRoute[],
  routeStations: RouteWithStations[],
): Promise<PlannerSourceSignature> {
  const normalizedStations = stations
    .filter((station) => station.isActive)
    .map((station) => ({
      id: station.stationId,
      name: normalizeStationName(station.stationName),
      lat: stationLatLng(station).lat.toFixed(6),
      lng: stationLatLng(station).lng.toFixed(6),
    }))
    .sort((a, b) => a.id - b.id)

  const normalizedRoutes = routes
    .map((route) => ({
      code: route.lineCode,
      name: normalizeStationName(route.lineName || route.shortLineName || route.lineCode),
    }))
    .sort((a, b) => a.code.localeCompare(b.code))

  const normalizedRouteStations = routeStations
    .map((route) => ({
      lineCode: route.lineCode,
      stations: route.stations
        .slice()
        .sort((a, b) => a.sequence - b.sequence)
        .map((station) => ({
          stationId: station.stationId,
          sequence: station.sequence,
          lat: toNumber(station.latitude).toFixed(6),
          lng: toNumber(station.longitude).toFixed(6),
        })),
    }))
    .sort((a, b) => a.lineCode.localeCompare(b.lineCode))

  const [stationHash, routeHash, routeSequenceHash] = await Promise.all([
    sha256Hex(JSON.stringify(normalizedStations)),
    sha256Hex(JSON.stringify(normalizedRoutes)),
    sha256Hex(JSON.stringify(normalizedRouteStations)),
  ])

  const routingHash = await sha256Hex(
    JSON.stringify({
      stationHash,
      routeHash,
      routeSequenceHash,
    }),
  )

  return {
    routingHash,
    stationHash,
    routeHash,
    routeSequenceHash,
    activeStationCount: normalizedStations.length,
    routeCount: normalizedRoutes.length,
    routeSequenceCount: normalizedRouteStations.length,
  }
}

export async function createSourceSnapshot(
  stations: Station[],
  routes: BusRoute[],
  routeStations: RouteWithStations[],
): Promise<PlannerSourceSnapshot> {
  const normalizedRouteStations = routeStations
    .map((route) => ({
      ...route,
      stations: route.stations.slice().sort((a, b) => a.sequence - b.sequence),
    }))
    .filter((route) => route.stations.length > 1)
    .sort((a, b) => a.lineCode.localeCompare(b.lineCode))

  const normalizedStations = stations
    .filter((station) => station.isActive)
    .slice()
    .sort((a, b) => a.stationId - b.stationId)

  const normalizedRoutes = routes.slice().sort((a, b) => a.lineCode.localeCompare(b.lineCode))

  const sourceSignature = await buildSourceSignaturePayload(
    normalizedStations,
    normalizedRoutes,
    normalizedRouteStations,
  )

  const provisional = {
    stations: normalizedStations,
    routes: normalizedRoutes,
    routeStations: normalizedRouteStations,
  }
  return {
    snapshotId: sourceSignature.routingHash.slice(0, 16),
    fetchedAt: Date.now(),
    routingHash: sourceSignature.routingHash,
    sourceSignature,
    ...provisional,
  }
}

export function diffSourceSignatures(
  previous: PlannerSourceSignature | null,
  next: PlannerSourceSignature,
): PlannerRoutingDiff {
  if (!previous) {
    return {
      previousSnapshotId: null,
      nextSnapshotId: next.routingHash.slice(0, 16),
      hasRoutingChanges: true,
      summary: {
        stationsAdded: next.activeStationCount,
        stationsRemoved: 0,
        stationsChanged: 0,
        routesAdded: next.routeCount,
        routesRemoved: 0,
        routesChanged: 0,
      },
      changes: ['Initial planner source signature.'],
    }
  }

  const stationsAdded = Math.max(0, next.activeStationCount - previous.activeStationCount)
  const stationsRemoved = Math.max(0, previous.activeStationCount - next.activeStationCount)
  const routesAdded = Math.max(0, next.routeCount - previous.routeCount)
  const routesRemoved = Math.max(0, previous.routeCount - next.routeCount)
  const routesChanged = previous.routeSequenceHash !== next.routeSequenceHash ? 1 : 0
  const stationsChanged =
    previous.stationHash !== next.stationHash && stationsAdded === 0 && stationsRemoved === 0
      ? 1
      : 0

  const changes: string[] = []
  if (stationsAdded) changes.push(`${stationsAdded} active stops added.`)
  if (stationsRemoved) changes.push(`${stationsRemoved} active stops removed.`)
  if (stationsChanged) changes.push('Stop metadata changed.')
  if (routesAdded) changes.push(`${routesAdded} routes added.`)
  if (routesRemoved) changes.push(`${routesRemoved} routes removed.`)
  if (routesChanged) changes.push('Route stop sequences changed.')
  if (changes.length === 0 && previous.routingHash !== next.routingHash) {
    changes.push('Routing-relevant source signature changed.')
  }

  return {
    previousSnapshotId: previous.routingHash.slice(0, 16),
    nextSnapshotId: next.routingHash.slice(0, 16),
    hasRoutingChanges: previous.routingHash !== next.routingHash,
    summary: {
      stationsAdded,
      stationsRemoved,
      stationsChanged,
      routesAdded,
      routesRemoved,
      routesChanged,
    },
    changes: changes.length > 0 ? changes : ['No routing-relevant changes detected.'],
  }
}

export function datasetVersionFromSnapshot(snapshot: PlannerSourceSnapshot): string {
  return `planner-${snapshot.snapshotId}`
}

export function diffSnapshots(
  previous: PlannerSourceSnapshot | null,
  next: PlannerSourceSnapshot,
): PlannerRoutingDiff {
  if (!previous) {
    return {
      previousSnapshotId: null,
      nextSnapshotId: next.snapshotId,
      hasRoutingChanges: true,
      summary: {
        stationsAdded: next.stations.length,
        stationsRemoved: 0,
        stationsChanged: 0,
        routesAdded: next.routeStations.length,
        routesRemoved: 0,
        routesChanged: 0,
      },
      changes: ['Initial planner snapshot.'],
    }
  }

  const previousStations = new Map(previous.stations.map((station) => [station.stationId, station]))
  const nextStations = new Map(next.stations.map((station) => [station.stationId, station]))
  let stationsAdded = 0
  let stationsRemoved = 0
  let stationsChanged = 0

  for (const [stationId, station] of nextStations) {
    const prior = previousStations.get(stationId)
    if (!prior) {
      stationsAdded += 1
      continue
    }
    const before = stationLatLng(prior)
    const after = stationLatLng(station)
    if (
      normalizeStationName(prior.stationName) !== normalizeStationName(station.stationName) ||
      before.lat.toFixed(6) !== after.lat.toFixed(6) ||
      before.lng.toFixed(6) !== after.lng.toFixed(6)
    ) {
      stationsChanged += 1
    }
  }
  for (const stationId of previousStations.keys()) {
    if (!nextStations.has(stationId)) stationsRemoved += 1
  }

  const previousRoutes = new Map(previous.routeStations.map((route) => [route.lineCode, route]))
  const nextRoutes = new Map(next.routeStations.map((route) => [route.lineCode, route]))
  let routesAdded = 0
  let routesRemoved = 0
  let routesChanged = 0

  for (const [lineCode, route] of nextRoutes) {
    const prior = previousRoutes.get(lineCode)
    if (!prior) {
      routesAdded += 1
      continue
    }
    const before = JSON.stringify(prior.stations.map((station) => station.stationId))
    const after = JSON.stringify(route.stations.map((station) => station.stationId))
    if (before !== after) routesChanged += 1
  }
  for (const lineCode of previousRoutes.keys()) {
    if (!nextRoutes.has(lineCode)) routesRemoved += 1
  }

  const changes: string[] = []
  if (stationsAdded) changes.push(`${stationsAdded} new stops detected.`)
  if (stationsRemoved) changes.push(`${stationsRemoved} stops removed.`)
  if (stationsChanged) changes.push(`${stationsChanged} stops changed routing-relevant fields.`)
  if (routesAdded) changes.push(`${routesAdded} routes added.`)
  if (routesRemoved) changes.push(`${routesRemoved} routes removed.`)
  if (routesChanged) changes.push(`${routesChanged} route stop sequences changed.`)

  return {
    previousSnapshotId: previous.snapshotId,
    nextSnapshotId: next.snapshotId,
    hasRoutingChanges: changes.length > 0 || previous.routingHash !== next.routingHash,
    summary: {
      stationsAdded,
      stationsRemoved,
      stationsChanged,
      routesAdded,
      routesRemoved,
      routesChanged,
    },
    changes: changes.length > 0 ? changes : ['No routing-relevant changes detected.'],
  }
}

export async function compilePlannerDataset(
  snapshot: PlannerSourceSnapshot,
): Promise<{ dataset: PlannerDataset; integrityHash: string }> {
  const stopLookup = new Map<number, number>()
  const stops: NormalizedStop[] = snapshot.stations.map((station, index) => {
    stopLookup.set(station.stationId, index)
    const coords = stationLatLng(station)
    return {
      stationId: station.stationId,
      stationName: station.stationName,
      lat: coords.lat,
      lng: coords.lng,
    }
  })

  const routeCandidates = snapshot.routeStations
    .map((route) => {
      const busRoute = snapshot.routes.find((candidate) => candidate.lineCode === route.lineCode)
      return {
        lineCode: route.lineCode,
        lineName: busRoute?.lineName || route.lineName || route.lineCode,
        stations: route.stations.filter((station) => stopLookup.has(station.stationId)),
      }
    })
    .filter((route) => route.stations.length > 1)
    .sort((a, b) => a.lineCode.localeCompare(b.lineCode))

  const routeCodes: string[] = []
  const routeNames: string[] = []
  const routeStops: number[] = []
  const routeStopOffsets: number[] = [0]
  const routeTravelTimes: number[] = []
  const stopRouteLists = Array.from(
    { length: stops.length },
    () => [] as Array<{ routeIndex: number; routePos: number }>,
  )
  const warnings: string[] = []
  let sureWithCoverage = 0
  let routeSegmentsWithSure = 0

  for (const [routeIndex, route] of routeCandidates.entries()) {
    routeCodes.push(route.lineCode)
    routeNames.push(route.lineName)
    const cumulative = cumulativeTravelTimes(route as RouteWithStations, warnings)
    for (let routePos = 0; routePos < route.stations.length; routePos += 1) {
      const station = route.stations[routePos]
      const stopIndex = stopLookup.get(station.stationId)
      if (stopIndex == null) continue
      routeStops.push(stopIndex)
      routeTravelTimes.push(cumulative[routePos] ?? routePos * 90)
      stopRouteLists[stopIndex].push({ routeIndex, routePos })
      if ((cumulative[routePos] ?? 0) > 0) {
        routeSegmentsWithSure += 1
      }
    }
    sureWithCoverage += route.stations.length - 1
    routeStopOffsets.push(routeStops.length)
  }

  const stopRoutes: number[] = []
  const stopRoutePos: number[] = []
  const stopRouteOffsets: number[] = [0]
  for (const list of stopRouteLists) {
    const sortedList = [...list].sort(
      (a, b) => a.routeIndex - b.routeIndex || a.routePos - b.routePos,
    )
    for (const entry of sortedList) {
      stopRoutes.push(entry.routeIndex)
      stopRoutePos.push(entry.routePos)
    }
    stopRouteOffsets.push(stopRoutes.length)
  }

  const oppositeStop = Array.from({ length: stops.length }, () => -1)
  const oppositeWalkSeconds = Array.from({ length: stops.length }, () => 0)
  const transferAdjacency = Array.from(
    { length: stops.length },
    () => [] as Array<{ target: number; seconds: number }>,
  )

  const nameBuckets = new Map<string, number[]>()
  for (const [index, stop] of stops.entries()) {
    const name = normalizeStationName(stop.stationName)
    const bucket = nameBuckets.get(name) ?? []
    bucket.push(index)
    nameBuckets.set(name, bucket)
  }

  let oppositeStopPairs = 0
  for (const bucket of nameBuckets.values()) {
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        const first = stops[bucket[i]]
        const second = stops[bucket[j]]
        const distance = haversineMeters(first, second)
        if (distance <= OPPOSITE_DISTANCE_METERS) {
          oppositeStop[bucket[i]] = bucket[j]
          oppositeStop[bucket[j]] = bucket[i]
          const seconds = Math.max(60, Math.round(distance / 1.25))
          oppositeWalkSeconds[bucket[i]] = seconds
          oppositeWalkSeconds[bucket[j]] = seconds
          oppositeStopPairs += 1
        }
      }
    }
  }

  for (let i = 0; i < stops.length; i += 1) {
    for (let j = i + 1; j < stops.length; j += 1) {
      const distance = haversineMeters(stops[i], stops[j])
      if (distance > TRANSFER_DISTANCE_METERS) continue
      const sharesRoute = stopRouteLists[i].some((left) =>
        stopRouteLists[j].some((right) => left.routeIndex === right.routeIndex),
      )
      if (sharesRoute) continue
      const seconds = Math.max(60, Math.round(distance / 1.25))
      transferAdjacency[i].push({ target: j, seconds })
      transferAdjacency[j].push({ target: i, seconds })
    }
  }

  const transferTarget: number[] = []
  const transferWalkSeconds: number[] = []
  const transferOffsets: number[] = [0]
  let nearbyTransferEdges = 0
  for (const adjacency of transferAdjacency) {
    const sortedAdjacency = [...adjacency].sort((a, b) => a.target - b.target)
    for (const entry of sortedAdjacency) {
      transferTarget.push(entry.target)
      transferWalkSeconds.push(entry.seconds)
      nearbyTransferEdges += 1
    }
    transferOffsets.push(transferTarget.length)
  }

  const grid: Record<string, number[]> = {}
  for (const [stopIndex, stop] of stops.entries()) {
    const key = `${Math.floor(stop.lat / GRID_CELL_SIZE)}:${Math.floor(stop.lng / GRID_CELL_SIZE)}`
    if (!grid[key]) grid[key] = []
    grid[key].push(stopIndex)
  }

  const buildReport: PlannerDatasetBuildReport = {
    totalStations: snapshot.stations.length,
    activeStations: stops.length,
    indexedStops: stops.length,
    totalRoutes: snapshot.routes.length,
    indexedRoutes: routeCandidates.length,
    excludedTakviye: Math.max(0, snapshot.routes.length - routeCandidates.length),
    excludedShort: 0,
    oppositeStopPairs,
    nearbyTransferEdges,
    sureCoverage:
      sureWithCoverage > 0 ? Number((routeSegmentsWithSure / sureWithCoverage).toFixed(4)) : 0,
    warnings,
  }

  const dataset: PlannerDataset = {
    stopCount: stops.length,
    stopIds: stops.map((stop) => stop.stationId),
    stopLat: stops.map((stop) => stop.lat),
    stopLng: stops.map((stop) => stop.lng),
    stopNames: stops.map((stop) => stop.stationName),
    routeCount: routeCandidates.length,
    routeCodes,
    routeNames,
    routeStops,
    routeStopOffsets,
    routeTravelTimes,
    stopRoutes,
    stopRoutePos,
    stopRouteOffsets,
    oppositeStop,
    oppositeWalkSeconds,
    transferTarget,
    transferWalkSeconds,
    transferOffsets,
    grid,
    gridCellSize: GRID_CELL_SIZE,
    schemaVersion: SCHEMA_VERSION,
    generatedAt: Date.now(),
    buildReport,
  }

  const integrityHash = await sha256Hex(JSON.stringify(dataset))
  return { dataset, integrityHash }
}

export function validateCompiledDataset(dataset: PlannerDataset): string[] {
  const errors: string[] = []
  if (dataset.stopIds.length !== dataset.stopCount) errors.push('stopIds length mismatch')
  if (dataset.routeCodes.length !== dataset.routeCount) errors.push('routeCodes length mismatch')
  if (dataset.routeStopOffsets.length !== dataset.routeCount + 1)
    errors.push('routeStopOffsets length mismatch')
  if (dataset.stopRouteOffsets.length !== dataset.stopCount + 1)
    errors.push('stopRouteOffsets length mismatch')
  if (dataset.transferOffsets.length !== dataset.stopCount + 1)
    errors.push('transferOffsets length mismatch')
  if (dataset.routeStops.some((stopIndex) => stopIndex < 0 || stopIndex >= dataset.stopCount)) {
    errors.push('routeStops contains out-of-range stop index')
  }
  if (dataset.transferTarget.some((stopIndex) => stopIndex < 0 || stopIndex >= dataset.stopCount)) {
    errors.push('transferTarget contains out-of-range stop index')
  }
  if (dataset.routeCount === 0 || dataset.stopCount === 0) {
    errors.push('compiled dataset is empty')
  }
  return errors
}

export function plannerCompilerVersion(): string {
  return COMPILER_VERSION
}
