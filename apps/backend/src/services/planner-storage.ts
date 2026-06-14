import type {
  Env,
  PlannerCompiledDataset,
  PlannerManifest,
  PlannerRoutingDiff,
  PlannerSourceSnapshot,
} from '../types'

const PREFIX = 'planner'
const MANIFEST_KEY = `${PREFIX}:manifest`
const LATEST_SNAPSHOT_KEY = `${PREFIX}:snapshot:latest`
const LATEST_COMPILED_KEY = `${PREFIX}:compiled:latest`
const LATEST_SOURCE_SIGNATURE_KEY = `${PREFIX}:source-signature:latest`

function datasetBlobKey(datasetVersion: string): string {
  return `${PREFIX}/datasets/${datasetVersion}/raptor-index.json`
}

function buildReportBlobKey(datasetVersion: string): string {
  return `${PREFIX}/datasets/${datasetVersion}/build-report.json`
}

function diffBlobKey(datasetVersion: string): string {
  return `${PREFIX}/datasets/${datasetVersion}/source-diff.json`
}

function sourceSignatureBlobKey(datasetVersion: string): string {
  return `${PREFIX}/datasets/${datasetVersion}/source-signature.json`
}

function snapshotBlobKey(snapshotId: string): string {
  return `${PREFIX}/snapshots/${snapshotId}.json`
}

function latestSnapshotPointerKey(): string {
  return LATEST_SNAPSHOT_KEY
}

function latestCompiledPointerKey(): string {
  return LATEST_COMPILED_KEY
}

function latestSourceSignaturePointerKey(): string {
  return LATEST_SOURCE_SIGNATURE_KEY
}

async function putText(env: Env, key: string, value: string): Promise<void> {
  if (env.DATASETS) {
    await env.DATASETS.put(key, value, {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
    })
    return
  }
  await env.CACHE.put(key, value)
}

async function getText(env: Env, key: string): Promise<string | null> {
  if (env.DATASETS) {
    const object = await env.DATASETS.get(key)
    if (object) return object.text()
  }
  return env.CACHE.get(key, 'text')
}

export class PlannerStorageService {
  constructor(private env: Env) {}

  async putSnapshot(snapshot: PlannerSourceSnapshot): Promise<void> {
    await putText(this.env, snapshotBlobKey(snapshot.snapshotId), JSON.stringify(snapshot))
    await putText(this.env, latestSnapshotPointerKey(), snapshot.snapshotId)
  }

  async getSnapshot(snapshotId: string): Promise<PlannerSourceSnapshot | null> {
    const raw = await getText(this.env, snapshotBlobKey(snapshotId))
    return raw ? (JSON.parse(raw) as PlannerSourceSnapshot) : null
  }

  async getLatestSnapshot(): Promise<PlannerSourceSnapshot | null> {
    const snapshotId = await getText(this.env, latestSnapshotPointerKey())
    if (!snapshotId) return null
    return this.getSnapshot(snapshotId)
  }

  async putCompiledDataset(
    metadata: PlannerCompiledDataset,
    datasetRaw: string,
    buildReportRaw: string,
    diffRaw: string,
    sourceSignatureRaw: string,
  ): Promise<void> {
    await Promise.all([
      putText(this.env, datasetBlobKey(metadata.datasetVersion), datasetRaw),
      putText(this.env, buildReportBlobKey(metadata.datasetVersion), buildReportRaw),
      putText(this.env, diffBlobKey(metadata.datasetVersion), diffRaw),
      putText(this.env, sourceSignatureBlobKey(metadata.datasetVersion), sourceSignatureRaw),
      this.env.CACHE.put(`${PREFIX}:compiled:${metadata.datasetVersion}`, JSON.stringify(metadata)),
      this.env.CACHE.put(latestCompiledPointerKey(), metadata.datasetVersion),
      this.env.CACHE.put(latestSourceSignaturePointerKey(), sourceSignatureRaw),
    ])
  }

  async getCompiledDatasetMetadata(datasetVersion: string): Promise<PlannerCompiledDataset | null> {
    const raw = await this.env.CACHE.get(`${PREFIX}:compiled:${datasetVersion}`, 'text')
    return raw ? (JSON.parse(raw) as PlannerCompiledDataset) : null
  }

  async getLatestCompiledDataset(): Promise<PlannerCompiledDataset | null> {
    const datasetVersion = await this.env.CACHE.get(latestCompiledPointerKey(), 'text')
    if (!datasetVersion) return null
    return this.getCompiledDatasetMetadata(datasetVersion)
  }

  async putManifest(manifest: PlannerManifest): Promise<void> {
    await this.env.CACHE.put(MANIFEST_KEY, JSON.stringify(manifest))
  }

  async getManifest(): Promise<PlannerManifest | null> {
    const raw = await this.env.CACHE.get(MANIFEST_KEY, 'text')
    return raw ? (JSON.parse(raw) as PlannerManifest) : null
  }

  async getDatasetRaw(datasetVersion: string): Promise<string | null> {
    return getText(this.env, datasetBlobKey(datasetVersion))
  }

  async getBuildReportRaw(datasetVersion: string): Promise<string | null> {
    return getText(this.env, buildReportBlobKey(datasetVersion))
  }

  async getDiffRaw(datasetVersion: string): Promise<string | null> {
    return getText(this.env, diffBlobKey(datasetVersion))
  }

  async getSourceSignatureRaw(datasetVersion: string): Promise<string | null> {
    return getText(this.env, sourceSignatureBlobKey(datasetVersion))
  }

  async putLatestDiff(diff: PlannerRoutingDiff): Promise<void> {
    await this.env.CACHE.put(`${PREFIX}:diff:${diff.nextSnapshotId}`, JSON.stringify(diff))
  }

  async getLatestDiff(snapshotId: string): Promise<PlannerRoutingDiff | null> {
    const raw = await this.env.CACHE.get(`${PREFIX}:diff:${snapshotId}`, 'text')
    return raw ? (JSON.parse(raw) as PlannerRoutingDiff) : null
  }

  async getLatestSourceSignatureRaw(): Promise<string | null> {
    return this.env.CACHE.get(latestSourceSignaturePointerKey(), 'text')
  }
}
