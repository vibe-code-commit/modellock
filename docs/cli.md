# CLI examples

## Initialize

```bash
model-lock init
model-lock init --network
model-lock init --force
model-lock init --cwd ./services/api --data-dir "$(npm root -g)/model-lock/data"
```

`init` never modifies application source files. It only writes `.llm-lock.yml`
(when absent) and `llm.lock.json`. If `llm.lock.json` already exists, pass `--force`
to overwrite.

## Scan

```bash
model-lock scan
model-lock scan --format json
```

Inventory discovered dependencies without writing files.

## Check

```bash
model-lock check
model-lock check --format json
model-lock check --format sarif > model-lock.sarif
model-lock check --fail-on-warn
model-lock check --network
```

## Update

```bash
# Proposal only
model-lock update --no-network

# Replace approved lockfile explicitly
model-lock update --write
```

Without `--write`, ModelLock writes:

- `llm.lock.proposed.json`
- `llm.lock.report.md`

## Explain

```bash
model-lock explain openai:gpt-4o-2024-08-06
model-lock explain anthropic:claude-sonnet-4-20250514 --network
```

## Validate

```bash
model-lock validate
```

Validate configuration, lockfile schema, and the local registry snapshot.

## Exit codes

| Code | Meaning                                      |
| ---- | -------------------------------------------- |
| 0    | Success (warnings allowed)                   |
| 1    | Policy failure                               |
| 2    | Invalid configuration / CLI usage            |
| 3    | Invalid lockfile                             |
| 4    | Registry unavailable with no usable fallback |
| 5    | Internal error                               |
| 6    | Unsupported lockfile version                 |
| 7    | Discovery ambiguity requiring input          |

```bash
model-lock check
echo $?
```
