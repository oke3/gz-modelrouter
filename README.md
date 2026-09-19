# gz-modelrouter

> Built by [Ground Zero LLC](https://github.com/oke3) — AI infrastructure for the agentic age.

Intelligent LLM cost router for OpenCode — select the cheapest model that meets quality thresholds.

[![CI](https://github.com/oke3/gz-modelrouter/actions/workflows/ci.yml/badge.svg)](https://github.com/oke3/gz-modelrouter/actions)
[![npm](https://img.shields.io/npm/v/@ground-zero-llc/gz-modelrouter)](https://www.npmjs.com/package/@ground-zero-llc/gz-modelrouter)
[![license](https://img.shields.io/npm/l/@ground-zero-llc/gz-modelrouter)](https://github.com/oke3/gz-modelrouter/blob/main/LICENSE)

## Why

OpenCode supports 75+ providers. Teams waste money overpaying for models:
- Using GPT-4 for autocomplete (GPT-4o-mini is fine)
- Using Claude Opus for file edits (Sonnet is fine)
- Hitting rate limits on one provider when alternatives exist
- No visibility into per-task model costs

**modelrouter** sits between OpenCode and model providers, automatically selecting the cheapest model that meets quality thresholds for each task type.

## Install

```bash
npm install -g @ground-zero-llc/gz-modelrouter
```

## Quick Start

```bash
# Test a routing decision
modelrouter route --task autocomplete
# → { model: 'gpt-4o-mini', provider: 'openai', strategy: 'cheapest', ... }

# List known models and costs
modelrouter models

# Start proxy server
modelrouter serve --port 4010
```

## Task Profiles

| Profile | Strategy | Models | Budget |
|---------|----------|--------|--------|
| `autocomplete` | cheapest | gpt-4o-mini, gemini-2.0-flash, claude-3-haiku | $1/1M |
| `code-edit` | quality-first | claude-sonnet-4, gpt-4o, gemini-2.5-pro | $15/1M |
| `reasoning` | quality-first | o3, claude-opus-4, gemini-2.5-pro | — |
| `quick-chat` | cheapest | deepseek-chat, gemini-2.0-flash, gpt-4o-mini | $0.5/1M |
| `heavy-analysis` | quality-first | claude-opus-4, o3, claude-sonnet-4 | — |

## Routing Strategies

| Strategy | Behavior |
|----------|----------|
| `cheapest` | Select lowest cost model from available |
| `quality-first` | Select highest quality model within budget |
| `round-robin` | Distribute across models evenly |
| `latency` | Select fastest responding model |
| `sticky` | Always use last successful model for task |

## Custom Rules

```bash
# Add a routing rule
modelrouter rule add '{"task":"quick-chat","models":["deepseek/deepseek-chat","google/gemini-2.0-flash"],"strategy":"cheapest"}'

# List rules
modelrouter rule list

# Clear rules
modelrouter rule clear
```

## Library API

```typescript
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

## Proxy Mode

Start a proxy that intercepts OpenCode model requests:

```bash
modelrouter serve --port 4010
```

Configure OpenCode to point to the proxy:

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

## Cost Tracking

All routing decisions are logged for cost analysis:

```bash
modelrouter report --period 7
# → Cost Report — Last 7 days
# → Total cost: $0.0000
# → Requests: 0
```

## Data Directory

Default: `~/.modelrouter/`

Override with `MODELRAPPER_DATA_DIR` environment variable.

## Related Projects

- [gz-sessions](https://github.com/oke3/gz-sessions) — Persistent cross-session memory for OpenCode agents
- [gz-codemap](https://github.com/oke3/gz-codemap) — Codebase mapping for OpenCode
- [gz-bench](https://github.com/oke3/gz-bench) — Benchmarking suite for OpenCode
- [gz-remote](https://github.com/oke3/gz-remote) — Drive OpenCode over SSH

## License

MIT © oke3
