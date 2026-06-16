/**
 * Ulasim Backend - Hono Entry Point
 * Cloudflare Workers üzerinde çalışan API
 *
 * CPU Optimized for Free Tier (10ms limit)
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { feedbackRouter } from './routes/feedback'
import { pharmaciesRouter } from './routes/pharmacies'
import { plannerRouter } from './routes/planner'
import { routesRouter } from './routes/routes'
import { stationsRouter } from './routes/stations'
import type { Env } from './types'

// Create Hono app with Env type
const app = new Hono<{ Bindings: Env }>()

// Middleware - removed logger for CPU optimization
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
)

// Health check (root - for direct worker URL)
app.get('/', (c) => {
  return c.json({
    service: 'ulasim-backend',
    version: '2.0.0',
    status: 'healthy',
    optimizedFor: 'cloudflare-free-tier',
    timestamp: new Date().toISOString(),
  })
})

// Health check under /api (frontend checkBackendStatus() calls GET /api/)
app.get('/api', (c) => {
  return c.json({
    service: 'ulasim-backend',
    version: '2.0.0',
    status: 'healthy',
    optimizedFor: 'cloudflare-free-tier',
    timestamp: new Date().toISOString(),
  })
})
app.get('/api/', (c) => {
  return c.json({
    service: 'ulasim-backend',
    version: '2.0.0',
    status: 'healthy',
    optimizedFor: 'cloudflare-free-tier',
    timestamp: new Date().toISOString(),
  })
})

// API Routes
app.route('/api/stations', stationsRouter)
app.route('/api/routes', routesRouter)
app.route('/api/pharmacies', pharmaciesRouter)
app.route('/api/feedback', feedbackRouter)
app.route('/api/planner', plannerRouter)

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found', path: c.req.path }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err)
  return c.json({ error: 'Internal Server Error', message: err.message }, 500)
})

// Export handlers
export default {
  fetch: app.fetch,
}
