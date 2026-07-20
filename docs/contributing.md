# Contributing

Thanks for helping improve ModelLock.

## Setup

```bash
git clone https://github.com/vibe-code-commit/model-lock.git
cd model-lock
npm ci
npm run check-all
```

## Development loop

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run build
```

## Stage discipline

Implement changes in small stages. After each stage, formatting, lint, typecheck,
and unit tests must pass before continuing.

## Tests

- Unit tests must never depend on live external services
- Put HTTP bodies under `data/fixtures/`
- Scheduled/live checks live under `test/live/` and run with `npm run test:live`

## Scope control

Do not add dashboards, databases, accounts, billing, Slack, webhooks, model
benchmarks, recommendations, or runtime LLM testing.

## Pull requests

- Keep diffs focused
- Update docs when behavior changes
- Do not leave TODO placeholders in the released path
