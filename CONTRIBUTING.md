# Contributing to gz-modelrouter

Thanks for your interest in contributing!

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
npx tsc --noEmit

# Build
bun run build
```

## Pull Requests

1. Fork the repo and create a feature branch
2. Write tests for new functionality
3. Ensure all tests pass: `bun test`
4. Ensure type check passes: `npx tsc --noEmit`
5. Submit a PR with a clear description

## Adding Models

To add a new model to the cost table, edit `src/cost.ts` and add an entry to `COST_TABLE`:

```typescript
{ provider: 'new-provider', model: 'model-name', inputPer1M: 0.1, outputPer1M: 0.2, tier: 'budget' }
```

## Code Style

- TypeScript strict mode
- ES modules (`import`/`export`)
- Zero runtime dependencies
- Tests for all new features

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
