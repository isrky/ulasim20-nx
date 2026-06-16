import type { Env, PlannerManifest } from '../types'
import { PlannerStorageService } from './planner-storage'

export class PlannerPipelineService {
  private storage: PlannerStorageService

  constructor(env: Env) {
    this.storage = new PlannerStorageService(env)
  }

  async getManifest(): Promise<PlannerManifest | null> {
    return this.storage.getManifest()
  }

  async getDataset(
    version: string,
    type: 'raptor-index' | 'build-report' | 'source-diff' | 'source-signature',
  ): Promise<string | null> {
    if (type === 'build-report') return this.storage.getBuildReportRaw(version)
    if (type === 'source-diff') return this.storage.getDiffRaw(version)
    if (type === 'source-signature') return this.storage.getSourceSignatureRaw(version)
    return this.storage.getDatasetRaw(version)
  }
}
