/**
 * @oke3/opencode-modelrouter — Intelligent LLM cost router for OpenCode.
 *
 * @example
 * ```typescript
 * import { ModelRouter } from '@oke3/opencode-modelrouter'
 *
 * const router = new ModelRouter('./data')
 * const decision = router.route('autocomplete')
 * console.log(decision)
 * // → { model: 'gpt-4o-mini', provider: 'openai', strategy: 'cheapest', ... }
 * ```
 */

export { ModelRouter, type RouteContext, type RouteDecision } from './router.js'
export { RuleStore, type RoutingRule, type CostLogEntry } from './store.js'
export { getModelCost, estimateCost, getModelsByTier, loadCostOverrides, COST_TABLE, type ModelCost } from './cost.js'
export { getProfile, listProfiles, registerProfile, PROFILES, type TaskProfile, type RoutingStrategy } from './profiles.js'
export { createProxy, type ProxyOptions } from './proxy.js'
