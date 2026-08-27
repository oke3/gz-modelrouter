/**
 * Built-in task profiles with quality/cost tradeoffs.
 */

export interface TaskProfile {
  name: string
  description: string
  defaultModels: string[]
  strategy: RoutingStrategy
  maxCostPer1MTokens?: number
}

export type RoutingStrategy =
  | 'cheapest'
  | 'quality-first'
  | 'round-robin'
  | 'latency'
  | 'sticky'

export const PROFILES: TaskProfile[] = [
  {
    name: 'autocomplete',
    description: 'Fast, cheap, good enough for simple completions',
    defaultModels: ['openai/gpt-4o-mini', 'google/gemini-2.0-flash', 'anthropic/claude-3-haiku'],
    strategy: 'cheapest',
    maxCostPer1MTokens: 1,
  },
  {
    name: 'code-edit',
    description: 'Precise code edits, medium cost',
    defaultModels: ['anthropic/claude-sonnet-4', 'openai/gpt-4o', 'google/gemini-2.5-pro'],
    strategy: 'quality-first',
    maxCostPer1MTokens: 15,
  },
  {
    name: 'reasoning',
    description: 'Best available for complex reasoning tasks',
    defaultModels: ['openai/o3', 'anthropic/claude-opus-4', 'google/gemini-2.5-pro'],
    strategy: 'quality-first',
  },
  {
    name: 'quick-chat',
    description: 'Fast response, minimal cost',
    defaultModels: ['deepseek/deepseek-chat', 'google/gemini-2.0-flash', 'openai/gpt-4o-mini'],
    strategy: 'cheapest',
    maxCostPer1MTokens: 0.5,
  },
  {
    name: 'heavy-analysis',
    description: 'Thorough analysis, cost-agnostic',
    defaultModels: ['anthropic/claude-opus-4', 'openai/o3', 'anthropic/claude-sonnet-4'],
    strategy: 'quality-first',
  },
]

const profileMap = new Map<string, TaskProfile>()
for (const p of PROFILES) {
  profileMap.set(p.name, p)
}

/** Get a task profile by name */
export function getProfile(name: string): TaskProfile | undefined {
  return profileMap.get(name)
}

/** List all built-in profiles */
export function listProfiles(): TaskProfile[] {
  return [...PROFILES]
}

/** Register a custom profile */
export function registerProfile(profile: TaskProfile): void {
  profileMap.set(profile.name, profile)
}
