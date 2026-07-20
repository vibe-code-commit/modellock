# Source confidence model

Every material fact carries a confidence classification.

| Level                   | Meaning                               | Blocks CI by default? |
| ----------------------- | ------------------------------------- | --------------------- |
| `official-verified`     | Agrees with curated official evidence | Yes                   |
| `multi-source-verified` | Independent sources agree             | No (raise floor)      |
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
- Policy `minBlockingConfidence` controls the blocking floor (default: `official-verified`)

By default only `official-verified` facts may block CI. Lower `minBlockingConfidence` to
`multi-source-verified` (or below) if you want multi-source agreement to block as well.
