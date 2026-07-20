# CLI examples

## Initialize

```bash
model-lock init
model-lock init --network
model-lock init --cwd ./services/api --data-dir "$(npm root -g)/model-lock/data"
```

`init` never modifies application source files. It only writes `.llm-lock.yml`
(when absent) and `llm.lock.json`.

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

## Exit codes

Use these in scripts and CI:

```bash
model-lock check
echo $?   # 0 success, 1 policy fail, 2 usage, 3 validation, 4 internal
```
