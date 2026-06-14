import { Hono } from 'hono'
import { PlannerPipelineService } from '../services/planner-pipeline'
import type { Env } from '../types'

export const plannerRouter = new Hono<{ Bindings: Env }>()

plannerRouter.get('/manifest', async (c) => {
  const pipeline = new PlannerPipelineService(c.env)
  const manifest = await pipeline.getManifest()
  if (!manifest) {
    return c.json(
      {
        error: 'Planner manifest not found',
        message: 'No compiled dataset has been published yet.',
      },
      404,
    )
  }
  return c.json(manifest)
})

plannerRouter.post('/rebuild', async (c) => {
  return c.json(
    {
      success: false,
      error: 'Planner rebuild is handled by CI, not the Worker runtime.',
    },
    410,
  )
})

plannerRouter.get('/datasets/:datasetVersion/:asset', async (c) => {
  const datasetVersion = c.req.param('datasetVersion')
  const asset = c.req.param('asset')
  const pipeline = new PlannerPipelineService(c.env)

  const type =
    asset === 'raptor-index.json'
      ? 'raptor-index'
      : asset === 'build-report.json'
        ? 'build-report'
        : asset === 'source-diff.json'
          ? 'source-diff'
          : asset === 'source-signature.json'
            ? 'source-signature'
            : null

  if (!type) {
    return c.json({ error: 'Unsupported planner asset' }, 404)
  }

  const payload = await pipeline.getDataset(datasetVersion, type)
  if (!payload) {
    return c.json({ error: 'Planner dataset asset not found' }, 404)
  }

  return new Response(payload, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  })
})
