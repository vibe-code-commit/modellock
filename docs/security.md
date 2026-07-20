# Security model

## Trust boundaries

1. **Repository source** stays on the local machine or GitHub-hosted runner.
2. **Public metadata** may be fetched from allowlisted endpoints only when network mode is enabled.
3. **Approved facts** live in `llm.lock.json` and are never silently rewritten.

## Guarantees

- No LLM or inference API calls
- No telemetry
- No authentication system
- No secrets required for offline `init` / `check`
- Timeout-limited and size-limited HTTP
- Fixture-backed unit tests never touch live services
- HTML is sanitized before printing
- Lockfiles containing secret-like strings are rejected

## Failure modes

| Event                        | Behavior                                      |
| ---------------------------- | --------------------------------------------- |
| Upstream outage              | Freeze last-known-good registry, emit warning |
| Conflicting sources          | Mark fact `conflicting`; never block on it    |
| Low-confidence discovery     | Record and mark; do not silently promote      |
| Oversized/malformed response | Adapter fails closed for that source          |

## Supply chain

- Node 24 pinned
- Committed Action bundle under `dist/action/`
- npm publish with provenance in release workflow
- Default Action permissions: `contents: read`
