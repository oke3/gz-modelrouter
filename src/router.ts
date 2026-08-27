/**
 * Core routing logic — selects the optimal model for a given task.
 */

import { getModelCost, estimateCost, COST_TABLE, type ModelCost } from './cost.js'
import { getProfile, type RoutingStrategy, type TaskProfile } from './profiles.js'
import { RuleStore, type RoutingRule, type CostLogEntry } from './store.js'

export interface RouteContext {
  preferredProvider?: string
  budget?: number
  taskProfile?: string
  preferredModels?: string[]
  availableProviders?: string[]
}

export interface RouteDecision {
  model: string
  provider: string
  strategy: RoutingStrategy
  estimatedCost?: number
  reason: string
}

export class ModelRouter {
  private store: RuleStore
  private stickyModel: Map<string, string> = new Map()
  private roundRobinIndex: Map<string, number> = new Map()

  constructor(dataDir: string) {
    this.store = new RuleStore(dataDir)
  }

  /** Route a task to the best model */
  route(task: string, context: RouteContext = {}): RouteDecision {
    // 1. Check for explicit routing rule
    const rule = this.store.findRule(task)
    if (rule) {
      return this.routeFromRule(rule, context)
    }

    // 2. Check for built-in profile
    const profile = getProfile(task)
    if (profile) {
      return this.routeFromProfile(profile, context)
    }

    // 3. Fallback: use cheapest available model
    return this.routeCheapest(context)
  }

  /** Route using a custom rule */
  private routeFromRule(rule: RoutingRule, context: RouteContext): RouteDecision {
    const models = this.filterModels(rule.models, context)
    if (models.length === 0) {
      return this.fallbackDecision(rule.fallback, rule.task)
    }

    const strategy = (rule.strategy as RoutingStrategy) ?? 'cheapest'

    switch (strategy) {
      case 'cheapest':
        return this.selectCheapest(models, strategy, rule.task)
      case 'quality-first':
        return this.selectBestQuality(models, rule.budget, strategy, rule.task)
      case 'round-robin':
        return this.selectRoundRobin(models, rule.task, strategy)
      case 'sticky':
        return this.selectSticky(models, rule.task, strategy)
      default:
        return this.selectCheapest(models, strategy, rule.task)
    }
  }

  /** Route using a built-in profile */
  private routeFromProfile(profile: TaskProfile, context: RouteContext): RouteDecision {
    const models = this.filterModels(profile.defaultModels, context)
    if (models.length === 0) {
      return {
        model: profile.defaultModels[0]!,
        provider: profile.defaultModels[0]!.split('/')[0]!,
        strategy: profile.strategy,
        reason: 'No filtered models available, using profile default',
      }
    }

    switch (profile.strategy) {
      case 'cheapest':
        return this.selectCheapest(models, profile.strategy, profile.name)
      case 'quality-first':
        return this.selectBestQuality(models, profile.maxCostPer1MTokens, profile.strategy, profile.name)
      default:
        return this.selectCheapest(models, profile.strategy, profile.name)
    }
  }

  /** Route to cheapest available model */
  private routeCheapest(context: RouteContext): RouteDecision {
    const allModels = COST_TABLE.map(c => `${c.provider}/${c.model}`)
    const models = this.filterModels(allModels, context)
    return this.selectCheapest(models, 'cheapest', 'unknown')
  }

  /** Filter models by available providers */
  private filterModels(models: string[], context: RouteContext): string[] {
    if (!context.availableProviders || context.availableProviders.length === 0) {
      return models
    }
    return models.filter(m => {
      const provider = m.split('/')[0]
      return context.availableProviders!.includes(provider!)
    })
  }

  /** Select the cheapest model from a list */
  private selectCheapest(
    models: string[],
    strategy: RoutingStrategy,
    task: string,
  ): RouteDecision {
    let cheapest: { model: string; cost: number } | null = null

    for (const m of models) {
      const cost = getModelCost(m)
      if (!cost) continue
      const total = cost.inputPer1M + cost.outputPer1M
      if (!cheapest || total < cheapest.cost) {
        cheapest = { model: m, cost: total }
      }
    }

    if (!cheapest) {
      return this.fallbackDecision(models[0], task)
    }

    const [provider, ...modelParts] = cheapest.model.split('/')
    return {
      model: modelParts.join('/'),
      provider: provider!,
      strategy,
      reason: `Cheapest model (combined rate: $${cheapest.cost.toFixed(2)}/1M tokens)`,
    }
  }

  /** Select highest quality model within budget */
  private selectBestQuality(
    models: string[],
    budget: number | undefined,
    strategy: RoutingStrategy,
    task: string,
  ): RouteDecision {
    const scored = models
      .map(m => {
        const cost = getModelCost(m)
        if (!cost) return null
        return { model: m, cost, score: this.qualityScore(cost) }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score)

    if (scored.length === 0) {
      return this.fallbackDecision(models[0], task)
    }

    // If budget specified, find best within budget
    if (budget !== undefined) {
      const withinBudget = scored.filter(s => (s.cost.inputPer1M + s.cost.outputPer1M) <= budget)
      if (withinBudget.length > 0) {
        const best = withinBudget[0]!
        const [provider, ...modelParts] = best.model.split('/')
        return {
          model: modelParts.join('/'),
          provider: provider!,
          strategy,
          estimatedCost: best.cost.inputPer1M,
          reason: `Best quality within $${budget}/1M budget (score: ${best.score.toFixed(1)})`,
        }
      }
    }

    // No budget or nothing within budget — pick best overall
    const best = scored[0]!
    const [provider, ...modelParts] = best.model.split('/')
    return {
      model: modelParts.join('/'),
      provider: provider!,
      strategy,
      estimatedCost: best.cost.inputPer1M,
      reason: `Highest quality (score: ${best.score.toFixed(1)})`,
    }
  }

  /** Round-robin selection */
  private selectRoundRobin(
    models: string[],
    task: string,
    strategy: RoutingStrategy,
  ): RouteDecision {
    const idx = this.roundRobinIndex.get(task) ?? 0
    const model = models[idx % models.length]!
    this.roundRobinIndex.set(task, idx + 1)

    const [provider, ...modelParts] = model.split('/')
    return {
      model: modelParts.join('/'),
      provider: provider!,
      strategy,
      reason: `Round-robin (index ${idx % models.length})`,
    }
  }

  /** Sticky selection — always use last successful model */
  private selectSticky(
    models: string[],
    task: string,
    strategy: RoutingStrategy,
  ): RouteDecision {
    const last = this.stickyModel.get(task)
    if (last && models.includes(last)) {
      const [provider, ...modelParts] = last.split('/')
      return {
        model: modelParts.join('/'),
        provider: provider!,
        strategy,
        reason: 'Sticky — reusing last successful model',
      }
    }

    // First time or last model unavailable — pick cheapest
    return this.selectCheapest(models, strategy, task)
  }

  /** Update sticky model after successful use */
  setSticky(task: string, model: string): void {
    this.stickyModel.set(task, model)
  }

  /** Fallback decision */
  private fallbackDecision(
    model: string | undefined,
    task: string,
  ): RouteDecision {
    const fallback = model ?? 'openai/gpt-4o-mini'
    const [provider, ...modelParts] = fallback.split('/')
    return {
      model: modelParts.join('/'),
      provider: provider!,
      strategy: 'cheapest',
      reason: `Fallback — no routing data for task "${task}"`,
    }
  }

  /** Quality score: higher = better, penalized by cost */
  private qualityScore(cost: ModelCost): number {
    const tierBonus = cost.tier === 'premium' ? 3 : cost.tier === 'mid' ? 2 : 1
    const costPenalty = Math.log10(cost.inputPer1M + cost.outputPer1M + 1)
    return tierBonus * 10 - costPenalty
  }

  /** Access the underlying store */
  getStore(): RuleStore {
    return this.store
  }
}
