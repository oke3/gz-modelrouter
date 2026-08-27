# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-27

### Added
- Core routing logic with 5 strategies (cheapest, quality-first, round-robin, latency, sticky)
- 5 built-in task profiles (autocomplete, code-edit, reasoning, quick-chat, heavy-analysis)
- JSONL-based rule storage and cost logging
- HTTP proxy server with health, routing, rules, and report endpoints
- CLI with serve, route, rule, report, profiles, models, and health commands
- Cost estimation for 15 models across OpenAI, Anthropic, Google, and DeepSeek
- 41 tests covering router, cost, store, proxy, and CLI
