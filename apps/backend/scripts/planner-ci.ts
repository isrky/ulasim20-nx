import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import {
  compilePlannerDataset,
  createSourceSnapshot,
  datasetVersionFromSnapshot,
  diffSourceSignatures,
  plannerCompilerVersion,
  validateCompiledDataset,
} from '../src/services/planner-compiler'
import type {
  BusRoute,
  GetAllRoutesResponse,
  GetAllStationsResponse,
  GetRouteStationsResponse,
  PlannerCompiledDataset,
  PlannerManifest,
  PlannerManifestEntry,
  PlannerSourceSignature,
  PlannerSourceSnapshot,
  RouteWithStations,
  Station,
} from '../src/types'

type Command =
  | 'fetch-normalize'
  | 'compute-source-signature'
  | 'compile-dataset'
  | 'validate-dataset'
  | 'promote-manifest'

function getArg(flag: string): string | null {
  const index = process.argv.indexOf(flag)
  if (index === -1) return null
  return process.argv[index + 1] ?? null
}

function requireArg(flag: string): string {
  const value = getArg(flag)
  if (!value) {
    throw new Error(`Missing required argument: ${flag}`)
  }
  return value
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  const target = resolve(filePath)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(resolve(filePath), 'utf8')) as T
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })

  if (!response.ok) {
    throw new Error(`Upstream request failed: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

function upstreamUrl(baseUrl: string, path: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  return `${trimmed}/UlasimBackend/api/Calc${path}`
}

async function fetchStations(baseUrl: string): Promise<Station[]> {
  const payload = await fetchJson<GetAllStationsResponse>(upstreamUrl(baseUrl, '/GetAllStations'))
  return Array.isArray(payload.value) ? payload.value : []
}

async function fetchRoutes(baseUrl: string): Promise<BusRoute[]> {
  const payload = await fetchJson<GetAllRoutesResponse>(upstreamUrl(baseUrl, '/GetAllRoutes'))
  return Array.isArray(payload.value) ? payload.value : []
}

async function fetchRouteStations(
  baseUrl: string,
  lineCode: string,
): Promise<RouteWithStations | null> {
  try {
    const payload = await fetchJson<GetRouteStationsResponse>(
      upstreamUrl(baseUrl, `/GetRouteStations?routeCode=${encodeURIComponent(lineCode)}`),
    )

    const stations = payload?.value?.stations
    if (!Array.isArray(stations) || stations.length < 2) return null

    return {
      lineCode,
      lineName: payload?.value?.lineName || lineCode,
      stations,
    }
  } catch {
    return null
  }
}

async function fetchAllRouteStations(
  baseUrl: string,
  routes: BusRoute[],
): Promise<RouteWithStations[]> {
  const results: RouteWithStations[] = []
  const batchSize = 10

  for (let start = 0; start < routes.length; start += batchSize) {
    const batch = routes.slice(start, start + batchSize)
    const fetched = await Promise.all(
      batch.map((route) => fetchRouteStations(baseUrl, route.lineCode)),
    )
    for (const route of fetched) {
      if (route) results.push(route)
    }
  }

  return results
}

async function commandFetchNormalize(): Promise<void> {
  const out = requireArg('--out')
  const baseUrl =
    getArg('--upstream') ?? process.env.UPSTREAM_API ?? 'https://ulasim.denizli.bel.tr'

  const [stations, routes] = await Promise.all([fetchStations(baseUrl), fetchRoutes(baseUrl)])
  const routeStations = await fetchAllRouteStations(baseUrl, routes)
  const snapshot = await createSourceSnapshot(stations, routes, routeStations)

  await writeJson(out, snapshot)
}

async function commandComputeSourceSignature(): Promise<void> {
  const snapshotPath = requireArg('--snapshot')
  const out = requireArg('--out')
  const snapshot = await readJson<PlannerSourceSnapshot>(snapshotPath)
  await writeJson(out, snapshot.sourceSignature)
}

function buildManifestEntry(compiled: PlannerCompiledDataset): PlannerManifestEntry {
  return {
    datasetVersion: compiled.datasetVersion,
    sourceSnapshotId: compiled.sourceSnapshotId,
    sourceSignature: compiled.sourceSignature,
    schemaVersion: compiled.schemaVersion,
    generatedAt: compiled.generatedAt,
    integrityHash: compiled.integrityHash,
    downloadUrl: compiled.downloadPath,
    buildReportUrl: compiled.buildReportPath,
    diffUrl: compiled.diffPath,
    sourceSignatureUrl: compiled.sourceSignaturePath,
  }
}

async function commandCompileDataset(): Promise<void> {
  const snapshotPath = requireArg('--snapshot')
  const outDir = resolve(requireArg('--out-dir'))
  const previousSignaturePath = getArg('--previous-signature')
  const snapshot = await readJson<PlannerSourceSnapshot>(snapshotPath)
  const previousSignature = previousSignaturePath
    ? await readJson<PlannerSourceSignature>(previousSignaturePath)
    : null

  const { dataset, integrityHash } = await compilePlannerDataset(snapshot)
  const datasetVersion = datasetVersionFromSnapshot(snapshot)
  const diff = diffSourceSignatures(previousSignature, snapshot.sourceSignature)
  const compiled: PlannerCompiledDataset = {
    datasetVersion,
    sourceSnapshotId: snapshot.snapshotId,
    sourceSignature: snapshot.sourceSignature,
    schemaVersion: dataset.schemaVersion,
    compilerVersion: plannerCompilerVersion(),
    generatedAt: dataset.generatedAt,
    integrityHash,
    downloadPath: `/api/planner/datasets/${datasetVersion}/raptor-index.json`,
    buildReportPath: `/api/planner/datasets/${datasetVersion}/build-report.json`,
    diffPath: `/api/planner/datasets/${datasetVersion}/source-diff.json`,
    sourceSignaturePath: `/api/planner/datasets/${datasetVersion}/source-signature.json`,
    buildReport: dataset.buildReport,
  }

  await mkdir(outDir, { recursive: true })
  await Promise.all([
    writeJson(join(outDir, 'raptor-index.json'), dataset),
    writeJson(join(outDir, 'build-report.json'), dataset.buildReport),
    writeJson(join(outDir, 'source-diff.json'), diff),
    writeJson(join(outDir, 'source-signature.json'), snapshot.sourceSignature),
    writeJson(join(outDir, 'compiled-metadata.json'), compiled),
  ])
}

async function commandValidateDataset(): Promise<void> {
  const datasetPath = requireArg('--dataset')
  const dataset =
    await readJson<Awaited<ReturnType<typeof compilePlannerDataset>>['dataset']>(datasetPath)
  const errors = validateCompiledDataset(dataset)
  if (errors.length > 0) {
    console.error(JSON.stringify({ valid: false, errors }, null, 2))
    process.exitCode = 1
    return
  }
  console.info(JSON.stringify({ valid: true }, null, 2))
}

async function commandPromoteManifest(): Promise<void> {
  const compiledMetadataPath = requireArg('--compiled-metadata')
  const out = requireArg('--out')
  const currentManifestPath = getArg('--current-manifest')
  const compiled = await readJson<PlannerCompiledDataset>(compiledMetadataPath)
  const currentManifest = currentManifestPath
    ? await readJson<PlannerManifest>(currentManifestPath)
    : null

  const manifest: PlannerManifest = {
    currentDatasetVersion: compiled.datasetVersion,
    rollbackDatasetVersion:
      currentManifest?.currentDatasetVersion ?? currentManifest?.rollbackDatasetVersion ?? null,
    currentSourceSignature: compiled.sourceSignature,
    minSupportedSchemaVersion: compiled.schemaVersion,
    compiledAt: Date.now(),
    compilerVersion: compiled.compilerVersion,
    datasets: {
      ...(currentManifest?.datasets ?? {}),
      [compiled.datasetVersion]: buildManifestEntry(compiled),
    },
  }

  await writeJson(out, manifest)
}

async function main(): Promise<void> {
  const command = process.argv[2] as Command | undefined

  switch (command) {
    case 'fetch-normalize':
      await commandFetchNormalize()
      return
    case 'compute-source-signature':
      await commandComputeSourceSignature()
      return
    case 'compile-dataset':
      await commandCompileDataset()
      return
    case 'validate-dataset':
      await commandValidateDataset()
      return
    case 'promote-manifest':
      await commandPromoteManifest()
      return
    default:
      console.error(
        [
          'Usage:',
          '  npx tsx backend/scripts/planner-ci.ts fetch-normalize --out <snapshot.json> [--upstream <url>]',
          '  npx tsx backend/scripts/planner-ci.ts compute-source-signature --snapshot <snapshot.json> --out <source-signature.json>',
          '  npx tsx backend/scripts/planner-ci.ts compile-dataset --snapshot <snapshot.json> --out-dir <dir> [--previous-signature <source-signature.json>]',
          '  npx tsx backend/scripts/planner-ci.ts validate-dataset --dataset <raptor-index.json>',
          '  npx tsx backend/scripts/planner-ci.ts promote-manifest --compiled-metadata <compiled-metadata.json> --out <manifest.json> [--current-manifest <manifest.json>]',
        ].join('\n'),
      )
      process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
