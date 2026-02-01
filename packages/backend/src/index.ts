/**
 * AI Translation Agent - Cloudflare Worker Entry Point
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Env } from './types'
import { translateRoute } from './routes/translate'
import { summaryRoute } from './routes/summary'
import { memoryRoute } from './routes/memory'
import { contextRoute } from './routes/context'

// Create Hono app with typed env
const app = new Hono<{ Bindings: Env }>()

// Middleware
app.use('*', logger())
app.use(
  '*',
  cors({
    origin: (origin) => origin || '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })
)

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'AI Translation Agent',
    version: '1.0.0',
    status: 'healthy',
    endpoints: {
      translate: '/api/translate',
      batch: '/api/translate/batch',
      summary: '/api/summary',
      context: '/api/context',
      memory: '/api/memory',
    },
  })
})

// API Routes
app.route('/api/translate', translateRoute)
app.route('/api/summary', summaryRoute)
app.route('/api/context', contextRoute)
app.route('/api/memory', memoryRoute)

// 404 handler
app.notFound((c) => {
  return c.json({ success: false, error: 'Not Found' }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Error:', err)
  return c.json(
    {
      success: false,
      error: err.message || 'Internal Server Error',
    },
    500
  )
})

export default app
