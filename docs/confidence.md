# Source confidence model

Every material fact carries a confidence classification.

| Level                   | Meaning                               | Blocks CI by default? |
| ----------------------- | ------------------------------------- | --------------------- |
| `official-verified`     | Agrees with curated official evidence | Yes                   |
| `multi-source-verified` | Independent sources agree             | Yes                   |
| `single-source`         | Only one source reported a value      | No                    |
| `conflicting`           | Sources disagree; value withheld      | Never                 |
| `stale`                 | Only aged observations remain         | No (warn)             |
| `unavailable`           | No usable observation                 | No                    |

## Sources

1. **models.dev** (`https://models.dev/api.json`) — pricing, limits, capabilities
2. **deprecations.info** (`https://deprecations.info/v1/feed.json`) — lifecycle / shutdown dates
3. **official-provider** — curated structured packs under `data/official/` (no paid APIs, no browser automation)

## Merger rules

- Agreement across independent sources raises confidence
- Official pack agreement can raise to `official-verified`
- Disagreement yields `conflicting` with `candidates` and `value: null`
- Missing fields stay `null` / `unavailable` (never invented)
- Policy `minBlockingConfidence` controls the blocking floor

Only `official-verified` and `multi-source-verified` facts may block CI unless you deliberately lower `minBlockingConfidence`.
