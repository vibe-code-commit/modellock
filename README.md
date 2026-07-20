Stop silent AI-model dependency drift before it reaches production.

# ModelLock

ModelLock is `package-lock.json` for AI model dependencies.

It scans a repository for AI provider/model declarations, writes an approved
`llm.lock.json` snapshot of the material facts you accepted, and fails CI when
those facts drift in ways your policy cares about.

## Why

Model identifiers float. Pricing changes. Context windows shrink. Tool calling
disappears. Deprecation dates move closer. Teams usually notice after production
breaks or the bill spikes.

ModelLock makes the approved facts explicit and checks them locally or in CI.

## What it locks

Material facts include:

- provider and requested model identifier
- floating vs fixed identifier
- lifecycle status and retirement date
- input/output token pricing
- context and maximum output limits
- tool-calling, structured-output, and vision support
- evidence sources, timestamps, digests, and confidence

## Non-goals

ModelLock does **not**:

- call LLM or provider inference APIs
- use a database, hosted backend, or accounts
- require secrets on the free path
- send your repository source anywhere
- recommend models or run prompt benchmarks

## Quick start

```bash
npm install -g model-lock
cd your-repo
model-lock init
model-lock check
```

Or with npx:

```bash
npx model-lock init
npx model-lock check
```

## Commands

| Command                               | Purpose                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `model-lock init`                     | Discover dependencies, create `.llm-lock.yml` if missing, write `llm.lock.json` |
| `model-lock check`                    | Diff approved lockfile vs current registry and apply policy                     |
| `model-lock update`                   | Propose a replacement lockfile + Markdown report (`--write` to apply)           |
| `model-lock explain <provider:model>` | Show approved, current, diffs, policy, confidence, evidence                     |

Exit codes:

| Code | Meaning                        |
| ---- | ------------------------------ |
| 0    | Success (warnings allowed)     |
| 1    | Blocking policy failure        |
| 2    | Invalid CLI usage              |
| 3    | Invalid config/lockfile/schema |
| 4    | Unexpected internal error      |

## GitHub Action

```yaml
permissions:
  contents: read

jobs:
  model-lock:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: vibe-code-commit/model-lock@v0
        with:
          network: "false"
```

Default permissions are `contents: read`. The Action never uploads repository
source contents. See [docs/github-action.md](docs/github-action.md) and
[examples/workflows](examples/workflows).

## Documentation

- [Installation](docs/installation.md)
- [Configuration reference](docs/configuration.md)
- [Lockfile specification](docs/lockfile.md)
- [Security model](docs/security.md)
- [Source confidence model](docs/confidence.md)
- [GitHub Action examples](docs/github-action.md)
- [CLI examples](docs/cli.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Contributing](docs/contributing.md)
- [Privacy](docs/privacy.md)
- [Ownership](docs/ownership.md)
- [Known limitations](docs/known-limitations.md)
- [Release checklist](docs/release-checklist.md)

## Requirements

- Node.js 24 (Active LTS), pinned via `.nvmrc` / `.node-version`

## License

Apache-2.0. Copyright 2026 Rabbott LLC.

See [LICENSE](LICENSE), [NOTICE](NOTICE), and [docs/ownership.md](docs/ownership.md).
