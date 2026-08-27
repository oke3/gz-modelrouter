import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { createProxy } from '../src/proxy.js'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Server } from 'node:http'

let dataDir: string
let server: Server
let port: number

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'proxy-test-'))
  server = createProxy({ port: 0, dataDir })
  await new Promise<void>(resolve => {
    server.listen(0, () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        port = addr.port
      }
      resolve()
    })
  })
})

afterEach(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()))
})

describe('proxy', () => {
  it('responds to health check', async () => {
    const res = await fetch(`http://localhost:${port}/health`)
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string; version: string }
    expect(body.status).toBe('ok')
    expect(body.version).toBe('0.1.0')
  })

  it('returns route decision', async () => {
    const res = await fetch(`http://localhost:${port}/route?task=autocomplete`)
    expect(res.status).toBe(200)
    const body = await res.json() as { model: string; provider: string; strategy: string }
    expect(body.model).toBeDefined()
    expect(body.provider).toBeDefined()
    expect(body.strategy).toBe('cheapest')
  })

  it('returns empty rules initially', async () => {
    const res = await fetch(`http://localhost:${port}/rules`)
    expect(res.status).toBe(200)
    const body = await res.json() as unknown[]
    expect(body).toEqual([])
  })

  it('adds rules via POST', async () => {
    const res = await fetch(`http://localhost:${port}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'test', models: ['a'], strategy: 'cheapest' }),
    })
    expect(res.status).toBe(201)

    const list = await fetch(`http://localhost:${port}/rules`)
    const body = await list.json() as unknown[]
    expect(body).toHaveLength(1)
  })

  it('returns 404 for unknown routes', async () => {
    const res = await fetch(`http://localhost:${port}/unknown`)
    expect(res.status).toBe(404)
  })

  it('returns cost report', async () => {
    const res = await fetch(`http://localhost:${port}/report?days=7`)
    expect(res.status).toBe(200)
    const body = await res.json() as { period: string; totalCost: number }
    expect(body.period).toBe('7d')
    expect(body.totalCost).toBe(0)
  })
})
