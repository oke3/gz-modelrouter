// Copyright (c) 2026 Ground Zero LLC. All rights reserved.

import { describe, it, expect, beforeEach } from 'bun:test'
import { RuleStore } from '../src/store.js'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let dataDir: string
let store: RuleStore

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'store-test-'))
  store = new RuleStore(dataDir)
})

describe('RuleStore', () => {
  it('starts with no rules', () => {
    const rules = store.getRules()
    expect(rules).toHaveLength(0)
  })

  it('adds and retrieves rules', () => {
    store.addRule({ task: 'test', models: ['a', 'b'], strategy: 'cheapest' })
    const rules = store.getRules()
    expect(rules).toHaveLength(1)
    expect(rules[0]!.task).toBe('test')
    expect(rules[0]!.models).toEqual(['a', 'b'])
  })

  it('filters rules by task', () => {
    store.addRule({ task: 'a', models: ['m1'], strategy: 'cheapest' })
    store.addRule({ task: 'b', models: ['m2'], strategy: 'cheapest' })
    store.addRule({ task: 'a', models: ['m3'], strategy: 'quality-first' })

    const aRules = store.getRules('a')
    expect(aRules).toHaveLength(2)
    expect(aRules.every(r => r.task === 'a')).toBe(true)
  })

  it('findRule returns first matching rule', () => {
    store.addRule({ task: 'x', models: ['m1'], strategy: 'cheapest' })
    store.addRule({ task: 'x', models: ['m2'], strategy: 'quality-first' })
    const rule = store.findRule('x')
    expect(rule).toBeDefined()
    expect(rule!.task).toBe('x')
  })

  it('findRule skips disabled rules', () => {
    store.addRule({ task: 'x', models: ['m1'], strategy: 'cheapest', enabled: false })
    store.addRule({ task: 'x', models: ['m2'], strategy: 'cheapest', enabled: true })
    const rule = store.findRule('x')
    expect(rule!.models[0]).toBe('m2')
  })

  it('findRule returns undefined for unknown task', () => {
    const rule = store.findRule('nonexistent')
    expect(rule).toBeUndefined()
  })

  it('logs and retrieves cost entries', () => {
    store.logCost({
      timestamp: new Date().toISOString(),
      task: 'test',
      model: 'gpt-4o',
      provider: 'openai',
      inputTokens: 1000,
      outputTokens: 500,
      cost: 0.01,
      latencyMs: 150,
      status: 'success',
    })

    const log = store.getCostLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.model).toBe('gpt-4o')
  })

  it('getCostSummary aggregates correctly', () => {
    const now = new Date().toISOString()
    store.logCost({ timestamp: now, task: 'a', model: 'm1', provider: 'p', inputTokens: 0, outputTokens: 0, cost: 0.1, latencyMs: 0, status: 'success' })
    store.logCost({ timestamp: now, task: 'b', model: 'm1', provider: 'p', inputTokens: 0, outputTokens: 0, cost: 0.2, latencyMs: 0, status: 'success' })
    store.logCost({ timestamp: now, task: 'a', model: 'm2', provider: 'p', inputTokens: 0, outputTokens: 0, cost: 0.3, latencyMs: 0, status: 'success' })

    const summary = store.getCostSummary(1)
    expect(summary.totalCost).toBeCloseTo(0.6, 2)
    expect(summary.requestCount).toBe(3)
    expect(summary.byModel.get('m1')).toBeCloseTo(0.3, 2)
    expect(summary.byModel.get('m2')).toBeCloseTo(0.3, 2)
    expect(summary.byTask.get('a')).toBeCloseTo(0.4, 2)
    expect(summary.byTask.get('b')).toBeCloseTo(0.2, 2)
  })
})
