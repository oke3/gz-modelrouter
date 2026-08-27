/**
 * JSONL-based storage for routing rules and cost logs.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface RoutingRule {
  task: string
  models: string[]
  strategy: string
  fallback?: string
  budget?: number
  enabled?: boolean
}

export interface CostLogEntry {
  timestamp: string
  task: string
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  cost: number
  latencyMs: number
  status: 'success' | 'error' | 'fallback'
}

export class RuleStore {
  private rulesPath: string
  private logPath: string

  constructor(dataDir: string) {
    this.rulesPath = join(dataDir, 'rules.jsonl')
    this.logPath = join(dataDir, 'cost-log.jsonl')

    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true })
    }
  }

  /** Add a routing rule */
  addRule(rule: RoutingRule): void {
    const line = JSON.stringify({ ...rule, enabled: rule.enabled ?? true })
    appendFileSync(this.rulesPath, line + '\n', 'utf-8')
  }

  /** Get all rules, optionally filtered by task */
  getRules(task?: string): RoutingRule[] {
    if (!existsSync(this.rulesPath)) return []
    const lines = readFileSync(this.rulesPath, 'utf-8').split('\n').filter(Boolean)
    const rules = lines.map(l => JSON.parse(l) as RoutingRule)
    return task ? rules.filter(r => r.task === task) : rules
  }

  /** Get the best matching rule for a task */
  findRule(task: string): RoutingRule | undefined {
    const rules = this.getRules(task).filter(r => r.enabled !== false)
    return rules[0]
  }

  /** Clear all rules */
  clearRules(): void {
    const dir = dirname(this.rulesPath)
    const backupPath = join(dir, `rules.backup.${Date.now()}.jsonl`)
    if (existsSync(this.rulesPath)) {
      const { renameSync } = require('node:fs')
      renameSync(this.rulesPath, backupPath)
    }
  }

  /** Append a cost log entry */
  logCost(entry: CostLogEntry): void {
    const line = JSON.stringify(entry)
    appendFileSync(this.logPath, line + '\n', 'utf-8')
  }

  /** Get cost log entries, optionally filtered by time period */
  getCostLog(periodDays?: number): CostLogEntry[] {
    if (!existsSync(this.logPath)) return []
    const lines = readFileSync(this.logPath, 'utf-8').split('\n').filter(Boolean)
    const entries = lines.map(l => JSON.parse(l) as CostLogEntry)

    if (!periodDays) return entries

    const cutoff = new Date(Date.now() - periodDays * 86_400_000)
    return entries.filter(e => new Date(e.timestamp) >= cutoff)
  }

  /** Get cost summary for a period */
  getCostSummary(periodDays: number = 7): {
    totalCost: number
    byModel: Map<string, number>
    byTask: Map<string, number>
    requestCount: number
  } {
    const entries = this.getCostLog(periodDays)
    const byModel = new Map<string, number>()
    const byTask = new Map<string, number>()
    let totalCost = 0

    for (const e of entries) {
      totalCost += e.cost
      byModel.set(e.model, (byModel.get(e.model) ?? 0) + e.cost)
      byTask.set(e.task, (byTask.get(e.task) ?? 0) + e.cost)
    }

    return { totalCost, byModel, byTask, requestCount: entries.length }
  }
}
