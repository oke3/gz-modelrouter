# opencode-modelrouter — Spec v1.0

## What

Zero-dep TypeScript CLI + library that acts as an intelligent LLM cost router for OpenCode. It sits between OpenCode and model providers, automatically selecting the cheapest model that meets quality thresholds for a given task type.

## Why

OpenCode supports 75+ providers. Teams waste money overpaying for models:
- Using GPT-4 for autocomplete (GPT-4o-mini is fine)
- Using Claude Opus for file edits (Sonnet is fine)
- Hitting rate limits on one provider when alternatives exist
- No visibility into per-task model costs

**The problem we personally hit**: Big Pickle 429s on free tier, alpha 503s on Forbes — routing is chaos. This tool makes it deterministic.

## Architecture

```
OpenCode → modelrouter proxy → best model for task
                ↓
         routing log (JSONL)
```

Two modes:
1. **Proxy mode** (primary): HTTP proxy that OpenCode points to instead of providers directly
2. **Config mode** (library): Exports a `route(taskType, context)` function that returns the optimal model ID

## Core Concepts

### Task Profiles
Predefined task types with quality/cost tradeoffs:
- `autocomplete` — fast, cheap, good enough
- `code-edit` — precise, medium cost
- `reasoning` — best available, higher cost
- `quick-chat` — fast response, minimal cost
- `heavy-analysis` — thorough, cost-agnostic

### Routing Rules
JSONL-based rule storage:
```json
{"task":"autocomplete","models":["gpt-4o-mini","claude-3-haiku","gemini-flash"],"strategy":"cheapest","fallback":"gpt-4o-mini"}
{"task":"code-edit","models":["claude-sonnet","gpt-4o","gemini-pro"],"strategy":"quality-first","budget":0.05}
```

### Cost Tracking
Logs every request with:
- Model used, tokens in/out, cost estimate
- Task profile, routing decision, latency
- Provider response status

## Files

```
src/
  router.ts      — Core routing logic (route, select, fallback)
  cost.ts        — Cost estimation per provider/model
  store.ts       — JSONL rule storage + cost log
  proxy.ts       — HTTP proxy server (Node http)
  profiles.ts    — Built-in task profiles
  cli.ts         — CLI entry point
  index.ts       — Public API exports
test/
  router.test.ts — Routing logic tests
  cost.test.ts   — Cost estimation tests
  store.test.ts  — Store tests
  proxy.test.ts  — Proxy integration tests
  cli.test.ts    — CLI tests
```

## CLI Commands

```bash
# Start proxy server
modelrouter serve --port 4010

# Add routing rule
modelrouter rule add --task autocomplete --models gpt-4o-mini,gemini-flash --strategy cheapest

# List rules
modelrouter rule list

# Show cost report
modelrouter report --period 7d

# Test routing decision (dry run)
modelrouter route --task code-edit --model claude-sonnet
```

## API (Library)

```typescript
import { ModelRouter, TaskProfile } from '@oke3/opencode-modelrouter'

const router = new ModelRouter()
router.addRule({
  task: 'autocomplete',
  models: ['gpt-4o-mini', 'gemini-flash'],
  strategy: 'cheapest',
  fallback: 'gpt-4o-mini'
})

const decision = router.route('autocomplete', {
  preferredProvider: 'openai',
  budget: 0.01
})
// → { model: 'gpt-4o-mini', provider: 'openai', estimatedCost: 0.0003 }
```

## Routing Strategies

| Strategy | Behavior |
|----------|----------|
| `cheapest` | Select lowest cost model from available |
| `quality-first` | Select highest quality model within budget |
| `round-robin` | Distribute across models evenly |
| `latency` | Select fastest responding model |
| `sticky` | Always use last successful model for task |

## Cost Data

Hardcoded cost table (updated via releases, not runtime):
- Based on public provider pricing
- Per-1M-token rates for input/output
- Updated quarterly or on major pricing changes

## TypeScript Config

Match existing oke3 pattern:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true,
    "noEmitOnError": true,
    "types": ["node"]
  }
}
```

## Package Config

```json
{
  "name": "@oke3/opencode-modelrouter",
  "type": "module",
  "bin": { "modelrouter": "./dist/cli.js" },
  "engines": { "node": ">=18" },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0"
  }
}
```

## Gate Criteria

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `bun test` — all tests pass
- [ ] No runtime dependencies (devDeps only)
- [ ] IP scan clean (no GZ/client references)
- [ ] CI green
- [ ] README with badges/TOC/API ref/integration guide
- [ ] MIT LICENSE © oke3
- [ ] CONTRIBUTING, CHANGELOG, issue templates
- [ ] gh description + topics set

## Estimated Size

- ~500-800 LOC (src)
- ~400-600 LOC (tests)
- 8-12 test files

## Risk

- HTTP proxy adds complexity vs pure library — keep proxy thin (passthrough with intercept)
- Cost data goes stale — make it easy to update via JSON file override
- Provider APIs vary — use OpenAI-compatible format as the common denominator (OpenCode already does this)
