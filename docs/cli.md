# CLI examples

## Initialize

```bash
modellock init
modellock init --network
modellock init --force
modellock init --cwd ./services/api --data-dir "$(npm root -g)/modellock/data"
```

`init` never modifies application source files. It only writes `.llm-lock.yml`
(when absent) and `llm.lock.json`. If `llm.lock.json` already exists, pass `--force`
to overwrite.

## Scan

```bash
modellock scan
modellock scan --format json
```

Inventory discovered dependencies without writing files.

## Check

```bash
modellock check
modellock check --format json
modellock check --format sarif > modellock.sarif
modellock check --fail-on-warn
modellock check --network
```

## Update

```bash
# Proposal only
modellock update --no-network

# Replace approved lockfile explicitly
modellock update --write
```

Without `--write`, ModelLock writes:

- `llm.lock.proposed.json`
- `llm.lock.report.md`

## Explain

```bash
modellock explain openai:gpt-4o-2024-08-06
modellock explain anthropic:claude-sonnet-4-20250514 --network
```

## Validate

```bash
modellock validate
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
modellock check
echo $?
```
