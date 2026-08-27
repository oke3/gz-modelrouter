#!/usr/bin/env node

/**
 * modelrouter CLI — intelligent LLM cost router for OpenCode.
 */

import { ModelRouter } from './router.js'
import { PROFILES, listProfiles } from './profiles.js'
import { COST_TABLE } from './cost.js'
import { createProxy } from './proxy.js'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const DEFAULT_DATA_DIR = join(homedir(), '.modelrouter')

function getDataDir(): string {
  const dir = process.env['MODELRAPPER_DATA_DIR'] ?? DEFAULT_DATA_DIR
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function printUsage(): void {
  console.log(`
modelrouter — Intelligent LLM cost router for OpenCode

Usage:
  modelrouter <command> [options]

Commands:
  serve [--port <port>]        Start proxy server (default: 4010)
  route --task <task>          Test routing decision (dry run)
  rule add <json>              Add a routing rule
  rule list [--task <task>]    List routing rules
  rule clear                   Clear all rules
  report [--period <days>]     Show cost report
  profiles                     List built-in task profiles
  models                       List known models and costs
  health                       Check proxy health

Options:
  --port <port>                Port for serve mode (default: 4010)
  --task <task>                Task profile name
  --model <model>              Preferred model ID
  --budget <amount>            Max cost per 1M tokens
  --data-dir <path>            Data directory (default: ~/.modelrouter)

Examples:
  modelrouter serve --port 4010
  modelrouter route --task autocomplete
  modelrouter route --task code-edit --budget 10
  modelrouter rule add '{"task":"quick-chat","models":["deepseek/deepseek-chat"],"strategy":"cheapest"}'
  modelrouter report --period 7
  `)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage()
    return
  }

  const command = args[0]!
  const dataDir = getDataDir()

  switch (command) {
    case 'serve': {
      const port = getArg(args, '--port') ?? '4010'
      const server = createProxy({ port: parseInt(port, 10), dataDir })
      server.listen(parseInt(port, 10), () => {
        console.log(`modelrouter proxy listening on port ${port}`)
        console.log(`Data dir: ${dataDir}`)
      })
      break
    }

    case 'route': {
      const task = getArg(args, '--task') ?? 'quick-chat'
      const model = getArg(args, '--model')
      const budget = getArg(args, '--budget')

      const router = new ModelRouter(dataDir)
      const decision = router.route(task, {
        preferredProvider: model?.split('/')[0],
        budget: budget ? parseFloat(budget) : undefined,
      })

      console.log(JSON.stringify(decision, null, 2))
      break
    }

    case 'rule': {
      const sub = args[1]
      if (sub === 'add') {
        const json = args[2]
        if (!json) {
          console.error('Usage: modelrouter rule add \'{"task":"...","models":[...],"strategy":"..."}\'')
          process.exit(1)
        }
        const router = new ModelRouter(dataDir)
        const rule = JSON.parse(json)
        router.getStore().addRule(rule)
        console.log('Rule added.')
      } else if (sub === 'list') {
        const router = new ModelRouter(dataDir)
        const task = getArg(args, '--task')
        const rules = router.getStore().getRules(task)
        if (rules.length === 0) {
          console.log('No rules found.')
        } else {
          console.log(JSON.stringify(rules, null, 2))
        }
      } else if (sub === 'clear') {
        const router = new ModelRouter(dataDir)
        router.getStore().clearRules()
        console.log('Rules cleared (backup created).')
      } else {
        console.error('Usage: modelrouter rule <add|list|clear>')
        process.exit(1)
      }
      break
    }

    case 'report': {
      const period = getArg(args, '--period') ?? '7'
      const router = new ModelRouter(dataDir)
      const summary = router.getStore().getCostSummary(parseInt(period, 10))

      console.log(`\nCost Report — Last ${period} days`)
      console.log('─'.repeat(40))
      console.log(`Total cost:  $${summary.totalCost.toFixed(4)}`)
      console.log(`Requests:    ${summary.requestCount}`)

      if (summary.byModel.size > 0) {
        console.log('\nBy Model:')
        for (const [model, cost] of summary.byModel) {
          console.log(`  ${model}: $${cost.toFixed(4)}`)
        }
      }

      if (summary.byTask.size > 0) {
        console.log('\nBy Task:')
        for (const [task, cost] of summary.byTask) {
          console.log(`  ${task}: $${cost.toFixed(4)}`)
        }
      }
      break
    }

    case 'profiles': {
      const profiles = listProfiles()
      console.log('\nBuilt-in Task Profiles')
      console.log('─'.repeat(60))
      for (const p of profiles) {
        console.log(`\n  ${p.name}`)
        console.log(`    ${p.description}`)
        console.log(`    Strategy: ${p.strategy}`)
        console.log(`    Models:   ${p.defaultModels.join(', ')}`)
        if (p.maxCostPer1MTokens) {
          console.log(`    Budget:   $${p.maxCostPer1MTokens}/1M tokens`)
        }
      }
      break
    }

    case 'models': {
      console.log('\nKnown Models & Costs (per 1M tokens)')
      console.log('─'.repeat(70))
      console.log(`${'Model'.padEnd(35)} ${'Input'.padStart(10)} ${'Output'.padStart(10)} ${'Tier'.padStart(10)}`)
      console.log('─'.repeat(70))
      for (const c of COST_TABLE) {
        const id = `${c.provider}/${c.model}`
        console.log(
          `${id.padEnd(35)} $${c.inputPer1M.toFixed(2).padStart(8)} $${c.outputPer1M.toFixed(2).padStart(8)} ${c.tier.padStart(10)}`,
        )
      }
      break
    }

    case 'health': {
      console.log(JSON.stringify({ status: 'ok', version: '0.1.0', dataDir }))
      break
    }

    default:
      console.error(`Unknown command: ${command}`)
      printUsage()
      process.exit(1)
  }
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag)
  if (idx === -1) return undefined
  return args[idx + 1]
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
