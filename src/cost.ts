/**
 * LLM cost estimation per provider/model.
 * Rates are per 1M tokens (input/output).
 * Updated from public provider pricing as of 2026-08.
 */

export interface ModelCost {
  provider: string
  model: string
  inputPer1M: number
  outputPer1M: number
  tier: 'budget' | 'mid' | 'premium'
}

export const COST_TABLE: ModelCost[] = [
  // OpenAI
  { provider: 'openai', model: 'gpt-4o-mini', inputPer1M: 0.15, outputPer1M: 0.6, tier: 'budget' },
  { provider: 'openai', model: 'gpt-4o', inputPer1M: 2.5, outputPer1M: 10, tier: 'mid' },
  { provider: 'openai', model: 'gpt-4.1', inputPer1M: 2, outputPer1M: 8, tier: 'mid' },
  { provider: 'openai', model: 'gpt-4.1-mini', inputPer1M: 0.4, outputPer1M: 1.6, tier: 'budget' },
  { provider: 'openai', model: 'o4-mini', inputPer1M: 1.1, outputPer1M: 4.4, tier: 'mid' },
  { provider: 'openai', model: 'o3', inputPer1M: 10, outputPer1M: 40, tier: 'premium' },

  // Anthropic
  { provider: 'anthropic', model: 'claude-3-haiku', inputPer1M: 0.25, outputPer1M: 1.25, tier: 'budget' },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', inputPer1M: 3, outputPer1M: 15, tier: 'mid' },
  { provider: 'anthropic', model: 'claude-sonnet-4', inputPer1M: 3, outputPer1M: 15, tier: 'mid' },
  { provider: 'anthropic', model: 'claude-opus-4', inputPer1M: 15, outputPer1M: 75, tier: 'premium' },

  // Google
  { provider: 'google', model: 'gemini-2.0-flash', inputPer1M: 0.1, outputPer1M: 0.4, tier: 'budget' },
  { provider: 'google', model: 'gemini-2.5-flash', inputPer1M: 0.15, outputPer1M: 0.6, tier: 'budget' },
  { provider: 'google', model: 'gemini-2.5-pro', inputPer1M: 1.25, outputPer1M: 10, tier: 'mid' },

  // DeepSeek
  { provider: 'deepseek', model: 'deepseek-chat', inputPer1M: 0.14, outputPer1M: 0.28, tier: 'budget' },
  { provider: 'deepseek', model: 'deepseek-reasoner', inputPer1M: 0.55, outputPer1M: 2.19, tier: 'mid' },
]

const costMap = new Map<string, ModelCost>()
for (const c of COST_TABLE) {
  costMap.set(`${c.provider}/${c.model}`, c)
}

/** Look up cost data for a model ID like "openai/gpt-4o" */
export function getModelCost(modelId: string): ModelCost | undefined {
  return costMap.get(modelId)
}

/** Estimate cost for a given token count */
export function estimateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number | undefined {
  const cost = getModelCost(modelId)
  if (!cost) return undefined
  return (inputTokens * cost.inputPer1M + outputTokens * cost.outputPer1M) / 1_000_000
}

/** Get all models in a tier */
export function getModelsByTier(tier: ModelCost['tier']): ModelCost[] {
  return COST_TABLE.filter(c => c.tier === tier)
}

/** Override cost data from a JSON file */
export function loadCostOverrides(overrides: ModelCost[]): void {
  for (const c of overrides) {
    costMap.set(`${c.provider}/${c.model}`, c)
  }
}
