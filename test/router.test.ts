import { describe, it, expect, beforeEach } from 'bun:test'
import { ModelRouter } from '../src/router.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let dataDir: string
let router: ModelRouter

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'modelrouter-test-'))
  router = new ModelRouter(dataDir)
})

describe('ModelRouter', () => {
  it('routes unknown task to cheapest model', () => {
    const decision = router.route('nonexistent-task')
    expect(decision.model).toBeDefined()
    expect(decision.provider).toBeDefined()
    expect(decision.strategy).toBe('cheapest')
  })

  it('routes autocomplete to budget model', () => {
    const decision = router.route('autocomplete')
    expect(decision.strategy).toBe('cheapest')
    // Should pick a budget-tier model
    expect(['gpt-4o-mini', 'gemini-2.0-flash', 'claude-3-haiku']).toContain(decision.model)
  })

  it('routes code-edit to mid-tier model', () => {
    const decision = router.route('code-edit')
    expect(decision.strategy).toBe('quality-first')
    expect(['claude-sonnet-4', 'gpt-4o', 'gemini-2.5-pro']).toContain(decision.model)
  })

  it('routes reasoning to premium model', () => {
    const decision = router.route('reasoning')
    expect(decision.strategy).toBe('quality-first')
    expect(['o3', 'claude-opus-4', 'gemini-2.5-pro']).toContain(decision.model)
  })

  it('respects budget constraint', () => {
    const decision = router.route('code-edit', { budget: 5 })
    expect(decision.estimatedCost).toBeDefined()
    if (decision.estimatedCost !== undefined) {
      expect(decision.estimatedCost).toBeLessThanOrEqual(5)
    }
  })

  it('filters by available providers', () => {
    const decision = router.route('autocomplete', { availableProviders: ['google'] })
    expect(decision.provider).toBe('google')
  })

  it('uses custom rules over built-in profiles', () => {
    router.getStore().addRule({
      task: 'autocomplete',
      models: ['deepseek/deepseek-chat'],
      strategy: 'cheapest',
    })
    const decision = router.route('autocomplete')
    expect(decision.model).toBe('deepseek-chat')
    expect(decision.provider).toBe('deepseek')
  })

  it('round-robin distributes across models', () => {
    router.getStore().addRule({
      task: 'test',
      models: ['openai/gpt-4o', 'anthropic/claude-sonnet-4'],
      strategy: 'round-robin',
    })

    const d1 = router.route('test')
    const d2 = router.route('test')
    // Should alternate (or at least use both models over time)
    expect([d1.model, d2.model]).toContain('gpt-4o')
    expect([d1.model, d2.model]).toContain('claude-sonnet-4')
  })

  it('sticky reuses last model', () => {
    router.getStore().addRule({
      task: 'sticky-test',
      models: ['openai/gpt-4o', 'anthropic/claude-sonnet-4'],
      strategy: 'sticky',
    })

    const d1 = router.route('sticky-test')
    router.setSticky('sticky-test', `${d1.provider}/${d1.model}`)
    const d2 = router.route('sticky-test')
    expect(d2.model).toBe(d1.model)
    expect(d2.reason).toContain('Sticky')
  })

  it('getRules returns all rules', () => {
    router.getStore().addRule({ task: 'a', models: ['m1'], strategy: 'cheapest' })
    router.getStore().addRule({ task: 'b', models: ['m2'], strategy: 'cheapest' })
    const rules = router.getStore().getRules()
    expect(rules).toHaveLength(2)
  })

  it('getRules filters by task', () => {
    router.getStore().addRule({ task: 'a', models: ['m1'], strategy: 'cheapest' })
    router.getStore().addRule({ task: 'b', models: ['m2'], strategy: 'cheapest' })
    const rules = router.getStore().getRules('a')
    expect(rules).toHaveLength(1)
    expect(rules[0]!.task).toBe('a')
  })
})
