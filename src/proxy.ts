/**
 * HTTP proxy server that intercepts OpenCode model requests
 * and routes them to the optimal model.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { ModelRouter, type RouteContext } from './router.js'
import type { CostLogEntry } from './store.js'

export interface ProxyOptions {
  port: number
  host?: string
  dataDir: string
}

export function createProxy(options: ProxyOptions): ReturnType<typeof createServer> {
  const router = new ModelRouter(options.dataDir)

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // Health check
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', version: '0.1.0' }))
      return
    }

    // Route info endpoint
    if (req.method === 'GET' && req.url?.startsWith('/route')) {
      const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)
      const task = url.searchParams.get('task') ?? 'quick-chat'
      const decision = router.route(task)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(decision, null, 2))
      return
    }

    // Rules management
    if (req.method === 'GET' && req.url === '/rules') {
      const rules = router.getStore().getRules()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(rules, null, 2))
      return
    }

    if (req.method === 'POST' && req.url === '/rules') {
      const body = await readBody(req)
      try {
        const rule = JSON.parse(body)
        router.getStore().addRule(rule)
        res.writeHead(201, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid rule JSON' }))
      }
      return
    }

    // Cost report
    if (req.method === 'GET' && req.url?.startsWith('/report')) {
      const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)
      const days = parseInt(url.searchParams.get('days') ?? '7', 10)
      const summary = router.getStore().getCostSummary(days)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        period: `${days}d`,
        totalCost: summary.totalCost,
        requestCount: summary.requestCount,
        byModel: Object.fromEntries(summary.byModel),
        byTask: Object.fromEntries(summary.byTask),
      }, null, 2))
      return
    }

    // Proxy: intercept chat completion requests
    if (req.method === 'POST' && req.url?.includes('/chat/completions')) {
      const body = await readBody(req)
      try {
        const request = JSON.parse(body)
        const task = inferTask(request)
        const context = buildContext(request)
        const decision = router.route(task, context)

        // Rewrite the model in the request
        request.model = `${decision.provider}/${decision.model}`

        // Log the routing decision
        const startTime = Date.now()
        const logEntry: CostLogEntry = {
          timestamp: new Date().toISOString(),
          task,
          model: decision.model,
          provider: decision.provider,
          inputTokens: estimateTokens(request.messages),
          outputTokens: 0,
          cost: 0,
          latencyMs: 0,
          status: 'success',
        }

        // Forward to the actual provider (passthrough for now)
        // In production, this would forward to the real API endpoint
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          routed: true,
          decision,
          originalRequest: request,
        }))

        // Log cost
        logEntry.latencyMs = Date.now() - startTime
        router.getStore().logCost(logEntry)
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid request' }))
      }
      return
    }

    // Default: 404
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  })

  return server
}

/** Read the full request body */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

/** Infer task type from the request */
function inferTask(request: Record<string, unknown>): string {
  const messages = request.messages as Array<{ role: string; content: string }> | undefined
  if (!messages || messages.length === 0) return 'quick-chat'

  const lastMsg = messages[messages.length - 1]
  const content = lastMsg?.content?.toLowerCase() ?? ''

  if (content.includes('autocomplete') || content.includes('complete')) return 'autocomplete'
  if (content.includes('edit') || content.includes('refactor') || content.includes('fix')) return 'code-edit'
  if (content.includes('explain') || content.includes('why') || content.includes('reason')) return 'reasoning'
  if (content.includes('analyze') || content.includes('review') || content.includes('audit')) return 'heavy-analysis'

  return 'quick-chat'
}

/** Build routing context from request */
function buildContext(request: Record<string, unknown>): RouteContext {
  const model = request.model as string | undefined
  const provider = model?.split('/')[0]

  return {
    preferredProvider: provider,
    availableProviders: provider ? [provider] : undefined,
  }
}

/** Rough token estimate (4 chars ≈ 1 token) */
function estimateTokens(messages: Array<{ role: string; content: string }> | undefined): number {
  if (!messages) return 0
  let total = 0
  for (const m of messages) {
    total += Math.ceil((m.content?.length ?? 0) / 4)
  }
  return total
}
