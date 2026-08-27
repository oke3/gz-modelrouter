import { describe, it, expect } from 'bun:test'
import { execSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const CLI = join(import.meta.dir, '..', 'src', 'cli.ts')

function run(args: string, env?: Record<string, string>): string {
  const dataDir = mkdtempSync(join(tmpdir(), 'cli-test-'))
  return execSync(
    `bun run ${CLI} ${args}`,
    {
      env: { ...process.env, MODELRAPPER_DATA_DIR: dataDir, ...env },
      encoding: 'utf-8',
      timeout: 10_000,
    },
  ).trim()
}

describe('CLI', () => {
  it('shows help with no args', () => {
    const output = run('')
    expect(output).toContain('modelrouter')
    expect(output).toContain('Usage')
  })

  it('shows help with --help', () => {
    const output = run('--help')
    expect(output).toContain('Usage')
  })

  it('health returns ok', () => {
    const output = run('health')
    const body = JSON.parse(output) as { status: string }
    expect(body.status).toBe('ok')
  })

  it('route returns decision', () => {
    const output = run('route --task autocomplete')
    const body = JSON.parse(output) as { model: string; provider: string }
    expect(body.model).toBeDefined()
    expect(body.provider).toBeDefined()
  })

  it('profiles lists built-in profiles', () => {
    const output = run('profiles')
    expect(output).toContain('autocomplete')
    expect(output).toContain('code-edit')
    expect(output).toContain('reasoning')
  })

  it('models lists known models', () => {
    const output = run('models')
    expect(output).toContain('gpt-4o')
    expect(output).toContain('claude')
    expect(output).toContain('gemini')
  })

  it('report shows empty report', () => {
    const output = run('report --period 7')
    expect(output).toContain('Cost Report')
    expect(output).toContain('$0.0000')
  })
})
