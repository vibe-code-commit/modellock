# Lockfile specification

File: `llm.lock.json`

JSON Schema: [`schemas/llm-lock.schema.json`](../schemas/llm-lock.schema.json)

## Properties

| Field              | Type         | Notes                         |
| ------------------ | ------------ | ----------------------------- |
| `lockfileVersion`  | `1`          | Forward-versioned integer     |
| `generatedAt`      | ISO datetime | Generation timestamp          |
| `generatorVersion` | string       | ModelLock version             |
| `configDigest`     | string       | SHA-256 of canonical config   |
| `registryDigest`   | string       | SHA-256 of registry model set |
| `dependencies`     | array        | Sorted by `key`               |

Each dependency stores:

- `key` (`provider:model`)
- discovery provenance (path, line, confidence, low-confidence flag)
- fact envelopes for all material fields
- evidence references (source id, URL, timestamps, digests, parser version)

## Fact envelopes

Every material fact is an envelope:

```json
{
  "value": 128000,
  "sourceId": "models.dev",
  "sourceUrl": "https://models.dev/api.json",
  "fetchedAt": "2026-07-20T00:00:00.000Z",
  "sourceDigest": "...",
  "parserVersion": "1.0.0+models-dev.1",
  "confidence": "multi-source-verified"
}
```

Unknown values use `value: null` with `confidence: "unavailable"`.
Conflicts use `value: null`, `confidence: "conflicting"`, and `candidates`.

## Determinism

- Object keys are sorted at every level
- Dependencies are sorted by `key`
- Trailing newline is always written
- Secrets are scrubbed/rejected before write
- The file is validated with Zod before read and write

## Mutation rules

- `init` / `update --write` may replace the lockfile explicitly
- `check` never modifies the approved lockfile
- `update` without `--write` only writes `llm.lock.proposed.json` and a Markdown report
