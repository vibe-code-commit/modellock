# Troubleshooting

## `Missing llm.lock.json`

Run `model-lock init` once to create the lockfile.

## Check fails after an upstream outage

By default, source failures freeze last-known-good data and emit warnings.
They should not cause a false policy failure unless `staleSourceBehavior: fail`.

## Conflicting pricing / retirement dates

Conflicts are recorded as `confidence: conflicting` and never become blocking
facts. Inspect with:

```bash
model-lock explain provider:model
```

## Discovery missed a model

Add an explicit pin or include in `.llm-lock.yml`:

```yaml
pins:
  - provider: openai
    modelId: gpt-4o-2024-08-06
```

## Discovery found a false positive

Exclude it:

```yaml
exclude:
  - unknown:some-string
```

## Lockfile rejected for secrets

ModelLock refuses to read or write lockfiles containing API-key-like strings.
Remove secrets from scanned outputs and regenerate.

## Network timeouts / oversized responses

Adapters fail closed for that source. Increase `sources.timeoutMs` /
`sources.maxBytes` only if you understand the risk, or stay offline and use
shipped snapshots.
