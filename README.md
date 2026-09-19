# gz-modelrouter

> Intelligent LLM cost router — sits between AI coding agents and model providers, routes to the cheapest model per task without quality loss.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Ground Zero LLC](https://img.shields.io/badge/Built%20by-Ground%20Zero%20LLC-purple)](https://github.com/oke3)
[![npm](https://img.shields.io/npm/v/@ground-zero-llc/gz-modelrouter)](https://www.npmjs.com/package/@ground-zero-llc/gz-modelrouter)
[![CI](https://github.com/oke3/gz-modelrouter/actions/workflows/ci.yml/badge.svg)](https://github.com/oke3/gz-modelrouter/actions)

---

## Why

OpenCode supports 75+ providers. Teams waste money overpaying for models:

- Using GPT-4 for autocomplete — GPT-4o-mini is fine
- Using Claude Opus for file edits — Sonnet is fine
- Hitting rate limits on one provider when cheaper alternatives exist
- No visibility into per-task model costs

A solo dev spending $200/mo on LLM APIs can cut that to $60–80 by routing intelligently. A team of 5 can save thousands. **modelrouter** automates this — it sits between your AI agents and model providers, selecting the cheapest model that meets quality thresholds for each task type.

## Quick Start

```bash
# Install globally
npm install -g @ground-zero-llc/gz-modelrouter

# Test a routing decision
modelrouter route --task autocomplete
# → { model: 'gpt-4o-mini', provider: 'openai', strategy: 'cheapest', ... }

# List known models and costs
modelrouter models

# Start proxy server (intercepts OpenCode model requests)
modelrouter serve --port 4010
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    AI Coding Agent                       │
│              (OpenCode / Cursor / Copilot)               │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                   gz-modelrouter                         │
│                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────┐ │
│  │ Task Profile │──▶│   Routing    │──▶│ Cost-Aware  │ │
│  │   Detection  │   │   Strategy   │   │  Selection  │ │
│  │              │   │              │   │             │ │
│  │ - autocomplete│   │ - cheapest  │   │ - input/1M  │ │
│  │ - code-edit  │   │ - quality-1st│   │ - output/1M │ │
│  │ - reasoning  │   │ - round-robin│   │ - budget    │ │
│  │ - chat       │   │ - sticky    │   │ - tier      │ │
│  └──────────────┘   └──────────────┘   └──────┬──────┘ │
│                                                │        │
│  ┌────────────────────────────────────────────┐ │        │
│  │             Rule Store (SQLite)             │ │        │
│  │  custom rules · cost logs · per-task history│◄┘        │
│  └────────────────────────────────────────────┘         │
│                        │                                 │
└────────────────────────┼─────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  Model Providers                         │
│   OpenAI · Anthropic · Google · DeepSeek · (75+ more)   │
└─────────────────────────────────────────────────────────┘
```

### Routing Flow

1. **Task detection** — Infer task type from the request (autocomplete, code-edit, reasoning, chat)
2. **Rule lookup** — Check for custom routing rules first
3. **Profile matching** — Fall back to built-in task profiles
4. **Strategy execution** — Apply the routing strategy (cheapest, quality-first, round-robin, sticky)
5. **Cost logging** — Log the decision for reporting and analysis

## Task Profiles

Each task type has a built-in profile with default models and a routing strategy.

| Profile | Strategy | Models | Budget (per 1M tokens) |
|---------|----------|--------|------------------------|
| `autocomplete` | cheapest | gpt-4o-mini, gemini-2.0-flash, claude-3-haiku | $1 |
| `code-edit` | quality-first | claude-sonnet-4, gpt-4o, gemini-2.5-pro | $15 |
| `reasoning` | quality-first | o3, claude-opus-4, gemini-2.5-pro | — |
| `quick-chat` | cheapest | deepseek-chat, gemini-2.0-flash, gpt-4o-mini | $0.5 |
| `heavy-analysis` | quality-first | claude-opus-4, o3, claude-sonnet-4 | — |

## Routing Strategies

| Strategy | Behavior | Best For |
|----------|----------|----------|
| `cheapest` | Select lowest cost model from available | Autocomplete, simple chat |
| `quality-first` | Select highest quality model within budget | Code edits, reasoning |
| `round-robin` | Distribute across models evenly | Load balancing, avoiding rate limits |
| `latency` | Select fastest responding model | Real-time interaction |
| `sticky` | Always use last successful model for task | Consistent experience per session |

## Cost Comparison

Real-world savings by routing intelligently. Prices per 1M tokens.

| Task | Default (no routing) | With modelrouter | Savings |
|------|---------------------|------------------|---------|
| Autocomplete (10K req/day) | gpt-4o ($12.50) | gpt-4o-mini ($0.75) | **94%** |
| Code edits (100 req/day) | claude-opus-4 ($90) | claude-sonnet-4 ($18) | **80%** |
| Quick chat (500 req/day) | gpt-4o ($12.50) | deepseek-chat ($0.42) | **97%** |
| Reasoning (20 req/day) | o3 ($50) | o3 (no change) | 0% |
| **Monthly total** | **~$3,775** | **~$1,140** | **~70%** |

> **Note:** Reasoning tasks use quality-first — modelrouter doesn't sacrifice quality where it matters. Savings come from routing cheap tasks to cheap models.

## Custom Rules

Override built-in profiles with your own routing rules.

```bash
# Add a routing rule
modelrouter rule add '{"task":"quick-chat","models":["deepseek/deepseek-chat","google/gemini-2.0-flash"],"strategy":"cheapest"}'

# List rules
modelrouter rule list

# Clear all custom rules
modelrouter rule clear
```

### Rule Schema

```json
{
  "task": "quick-chat",
  "models": ["deepseek/deepseek-chat", "google/gemini-2.0-flash"],
  "strategy": "cheapest",
  "budget": 0.5,
  "fallback": "openai/gpt-4o-mini"
}
```

## Proxy Mode

Start a proxy that intercepts OpenCode model requests and routes them to the optimal model.

### Start the Proxy

```bash
modelrouter serve --port 4010
```

### Configure OpenCode

Point your OpenCode instance at the proxy:

```jsonc
// opencode.jsonc
{
  "provider": {
    "modelrouter": {
      "models": {
        "proxied": {
          "api": { "url": "http://localhost:4010" }
        }
      }
    }
  }
}
```

### Proxy Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — returns `{ status: "ok" }` |
| `GET` | `/route?task=<name>` | Get routing decision for a task |
| `POST` | `/chat/completions` | Intercept and route chat completion requests |
| `GET` | `/rules` | List all custom routing rules |
| `POST` | `/rules` | Add a new custom routing rule |
| `GET` | `/report?days=<n>` | Cost report for the last N days |

### How Proxy Routing Works

The proxy inspects incoming `POST /chat/completions` requests and:

1. **Infers task type** from the message content (autocomplete, code-edit, reasoning, chat)
2. **Routes** using the task profile or custom rules
3. **Rewrites the model field** in the request to the selected model
4. **Logs** the routing decision with token estimates and latency
5. **Forwards** the request to the actual provider

```bash
# Example: test routing via the proxy
curl http://localhost:4010/route?task=autocomplete
# → { model: "gpt-4o-mini", provider: "openai", strategy: "cheapest", reason: "..." }

# Example: get cost report
curl http://localhost:4010/report?days=7
# → { period: "7d", totalCost: 12.34, requestCount: 1500, byModel: {...}, byTask: {...} }
```

## Library API

Use modelrouter as a TypeScript library in your own applications.

```typescript
// Copyright (c) 2026 Ground Zero LLC.
import { ModelRouter } from '@ground-zero-llc/gz-modelrouter'

const router = new ModelRouter('./data')

// Add custom rule
router.getStore().addRule({
  task: 'autocomplete',
  models: ['gpt-4o-mini', 'gemini-flash'],
  strategy: 'cheapest',
  fallback: 'gpt-4o-mini',
})

// Route a task
const decision = router.route('autocomplete', {
  preferredProvider: 'openai',
  budget: 0.01,
})
// → { model: 'gpt-4o-mini', provider: 'openai', strategy: 'cheapest', ... }
```

### API Reference

#### `ModelRouter`

```typescript
// Copyright (c) 2026 Ground Zero LLC.
import { ModelRouter, getModelCost, estimateCost } from '@ground-zero-llc/gz-modelrouter'

const router = new ModelRouter(dataDir: string)

// Route a task to the best model
router.route(task: string, context?: RouteContext): RouteDecision

// Get the underlying rule store
router.getStore(): RuleStore
```

#### `RouteContext`

```typescript
interface RouteContext {
  preferredProvider?: string      // e.g., "openai"
  budget?: number                 // max cost per 1M tokens
  taskProfile?: string            // override task profile
  preferredModels?: string[]      // restrict to these models
  availableProviders?: string[]   // only consider these providers
}
```

#### `RouteDecision`

```typescript
interface RouteDecision {
  model: string           // e.g., "gpt-4o-mini"
  provider: string        // e.g., "openai"
  strategy: string        // e.g., "cheapest"
  estimatedCost?: number  // per 1M tokens
  reason: string          // human-readable explanation
}
```

#### Cost Utilities

```typescript
// Copyright (c) 2026 Ground Zero LLC.
import { getModelCost, estimateCost, getModelsByTier } from '@ground-zero-llc/gz-modelrouter'

// Look up cost data for a model
const cost = getModelCost('openai/gpt-4o')
// → { provider: 'openai', model: 'gpt-4o', inputPer1M: 2.5, outputPer1M: 10, tier: 'mid' }

// Estimate cost for a request
const cost = estimateCost('openai/gpt-4o', 1000, 500)
// → 0.0075

// Get all models in a tier
const budgetModels = getModelsByTier('budget')
// → [{ model: 'gpt-4o-mini', ... }, { model: 'gemini-2.0-flash', ... }, ...]
```

## Built-in Model Pricing

Updated from public provider pricing as of 2026-08.

| Provider | Model | Input/1M | Output/1M | Tier |
|----------|-------|----------|-----------|------|
| **OpenAI** | gpt-4o-mini | $0.15 | $0.60 | budget |
| | gpt-4.1-mini | $0.40 | $1.60 | budget |
| | gpt-4o | $2.50 | $10.00 | mid |
| | gpt-4.1 | $2.00 | $8.00 | mid |
| | o4-mini | $1.10 | $4.40 | mid |
| | o3 | $10.00 | $40.00 | premium |
| **Anthropic** | claude-3-haiku | $0.25 | $1.25 | budget |
| | claude-3-5-sonnet | $3.00 | $15.00 | mid |
| | claude-sonnet-4 | $3.00 | $15.00 | mid |
| | claude-opus-4 | $15.00 | $75.00 | premium |
| **Google** | gemini-2.0-flash | $0.10 | $0.40 | budget |
| | gemini-2.5-flash | $0.15 | $0.60 | budget |
| | gemini-2.5-pro | $1.25 | $10.00 | mid |
| **DeepSeek** | deepseek-chat | $0.14 | $0.28 | budget |
| | deepseek-reasoner | $0.55 | $2.19 | mid |

Override costs at runtime with `loadCostOverrides()` if provider pricing changes.

## Cost Tracking

All routing decisions are logged for cost analysis.

```bash
# View cost report for the last 7 days
modelrouter report --period 7
# → Cost Report — Last 7 days
# → Total cost: $12.34
# → Requests: 1,500
# → By model: gpt-4o-mini (800), deepseek-chat (400), claude-sonnet-4 (300)

# View via proxy endpoint
curl http://localhost:4010/report?days=30
```

## Data Directory

Default: `~/.modelrouter/`

Override with `MODELRAPPER_DATA_DIR` environment variable.

```bash
export MODELRAPPER_DATA_DIR=/path/to/custom/dir
modelrouter serve --port 4010
```

## Related Projects

- [gz-codemap](https://github.com/oke3/gz-codemap) — Codebase mapping for OpenCode config generation
- [gz-context-engine](https://github.com/oke3/gz-context-engine) — Production-grade RAG context engine
- [gz-sessions](https://github.com/oke3/gz-sessions) — Persistent cross-session memory for agents
- [gz-bench](https://github.com/oke3/gz-bench) — Benchmarking suite for AI coding tools
- [gz-remote](https://github.com/oke3/gz-remote) — Drive OpenCode over SSH

## License

MIT — Ground Zero LLC

---

Built by [Ground Zero LLC](https://github.com/oke3) — AI infrastructure for the agentic age.
