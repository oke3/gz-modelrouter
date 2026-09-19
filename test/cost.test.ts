// Copyright (c) 2026 Ground Zero LLC. All rights reserved.

import { describe, it, expect } from 'bun:test'
import { getModelCost, estimateCost, getModelsByTier, COST_TABLE, loadCostOverrides } from '../src/cost.js'

describe('cost', () => {
  it('COST_TABLE has entries', () => {
    expect(COST_TABLE.length).toBeGreaterThan(0)
  })

  it('getModelCost returns cost for known model', () => {
    const cost = getModelCost('openai/gpt-4o')
    expect(cost).toBeDefined()
    expect(cost!.provider).toBe('openai')
    expect(cost!.model).toBe('gpt-4o')
    expect(cost!.inputPer1M).toBeGreaterThan(0)
    expect(cost!.outputPer1M).toBeGreaterThan(0)
  })

  it('getModelCost returns undefined for unknown model', () => {
    const cost = getModelCost('nonexistent/model')
    expect(cost).toBeUndefined()
  })

  it('estimateCost calculates correctly', () => {
    // gpt-4o-mini: $0.15 input, $0.60 output per 1M
    const cost = estimateCost('openai/gpt-4o-mini', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(0.75, 2)
  })

  it('estimateCost returns undefined for unknown model', () => {
    const cost = estimateCost('nonexistent/model', 1000, 1000)
    expect(cost).toBeUndefined()
  })

  it('getModelsByTier returns correct tier', () => {
    const budget = getModelsByTier('budget')
    expect(budget.length).toBeGreaterThan(0)
    for (const m of budget) {
      expect(m.tier).toBe('budget')
    }
  })

  it('loadCostOverrides adds new models', () => {
    loadCostOverrides([{
      provider: 'custom',
      model: 'my-model',
      inputPer1M: 0.01,
      outputPer1M: 0.02,
      tier: 'budget',
    }])
    const cost = getModelCost('custom/my-model')
    expect(cost).toBeDefined()
    expect(cost!.inputPer1M).toBe(0.01)
  })

  it('all models have valid tiers', () => {
    for (const c of COST_TABLE) {
      expect(['budget', 'mid', 'premium']).toContain(c.tier)
    }
  })

  it('all models have positive costs', () => {
    for (const c of COST_TABLE) {
      expect(c.inputPer1M).toBeGreaterThan(0)
      expect(c.outputPer1M).toBeGreaterThan(0)
    }
  })
})
