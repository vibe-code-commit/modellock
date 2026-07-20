# Configuration reference

ModelLock reads `.llm-lock.yml` from the repository root.

JSON Schema: [`schemas/config.schema.json`](../schemas/config.schema.json)

## Example

```yaml
version: 1
include: []
exclude: []
pins:
  - provider: openai
    modelId: gpt-4o-2024-08-06
scan:
  roots:
    - .
  ignore:
    - "**/node_modules/**"
    - "**/dist/**"
policy:
  floatingAliases: warn
  retirementWindowDays: 90
  maxInputPriceIncreasePercent: 10
  maxOutputPriceIncreasePercent: 10
  failOnContextDecrease: true
  failOnMaxOutputDecrease: true
  failOnToolCallingRemoval: true
  failOnStructuredOutputRemoval: true
  failOnVisionRemoval: true
  staleSourceBehavior: warn
  minBlockingConfidence: multi-source-verified
sources:
  allowNetwork: false
  staleAfterDays: 14
  timeoutMs: 10000
  maxBytes: 8388608
```

## Fields

### `include` / `exclude` / `pins`

- `include`: force-add `provider:model` keys even if undiscovered
- `exclude`: drop discovered keys
- `pins`: explicit overrides treated as high-confidence discovery from config

### `scan`

- `roots`: directories to scan
- `ignore`: glob-like skip patterns (`node_modules`, build output, venvs, minified files)

### `policy`

| Key                             | Default                 | Meaning                                         |
| ------------------------------- | ----------------------- | ----------------------------------------------- |
| `floatingAliases`               | `warn`                  | `deny`, `warn`, or `allow` floating aliases     |
| `retirementWindowDays`          | `90`                    | Fail/warn when retirement is within N days      |
| `maxInputPriceIncreasePercent`  | `10`                    | Max allowed input price increase                |
| `maxOutputPriceIncreasePercent` | `10`                    | Max allowed output price increase               |
| `failOnContextDecrease`         | `true`                  | Fail when context shrinks                       |
| `failOnMaxOutputDecrease`       | `true`                  | Fail when max output shrinks                    |
| `failOnToolCallingRemoval`      | `true`                  | Fail when tools support is removed              |
| `failOnStructuredOutputRemoval` | `true`                  | Fail when structured output is removed          |
| `failOnVisionRemoval`           | `true`                  | Fail when vision is removed                     |
| `staleSourceBehavior`           | `warn`                  | `warn`, `fail`, or `ignore` when sources freeze |
| `minBlockingConfidence`         | `multi-source-verified` | Minimum confidence required to block CI         |

### `sources`

| Key              | Default   | Meaning                                          |
| ---------------- | --------- | ------------------------------------------------ |
| `allowNetwork`   | `false`   | Offline-first; opt in to public metadata fetches |
| `staleAfterDays` | `14`      | Age after which facts become `stale`             |
| `timeoutMs`      | `10000`   | Per-request timeout                              |
| `maxBytes`       | `8388608` | Max response size                                |

Network fetches never send repository contents. They only pull allowlisted public metadata.
