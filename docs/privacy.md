# Privacy statement

ModelLock is designed so **your source code never leaves the runner**.

## What runs where

- The CLI runs entirely on your machine
- The GitHub Action runs on your GitHub-hosted or self-hosted runner
- There is no ModelLock backend, account system, or telemetry channel

## What network mode does

When `--network` / `sources.allowNetwork: true` is enabled, ModelLock may fetch
public metadata only from allowlisted endpoints such as:

- `https://models.dev/api.json`
- `https://deprecations.info/v1/feed.json`

Those requests do not include your repository contents, lockfile, or source files.

## What is written locally

- `.llm-lock.yml`
- `llm.lock.json`
- optional `llm.lock.proposed.json` and `llm.lock.report.md`
- Action report artifacts under `model-lock-report/` (findings only)

## Secrets

ModelLock does not require API keys for the free offline path. Secret-like
strings are scrubbed or rejected from lockfile I/O.
