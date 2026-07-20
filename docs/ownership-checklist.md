# Ownership checklist status

Copyright holder: **Rabbott LLC** (North Carolina)

Operational GitHub publisher: **[vibe-code-commit/model-lock](https://github.com/vibe-code-commit/model-lock)**

| Step                                    | Status                                                        |
| --------------------------------------- | ------------------------------------------------------------- |
| LICENSE copyright = Rabbott LLC         | Done                                                          |
| Core license Apache-2.0                 | Done (`0.1.1+`; `0.1.0` was MIT)                              |
| NOTICE + docs/ownership.md              | Done                                                          |
| package.json author/repository          | Done                                                          |
| GitHub repo created and pushed          | Done ([link](https://github.com/vibe-code-commit/model-lock)) |
| Branch protection on main               | Done (no force-push, linear history)                          |
| Commit author uses GitHub noreply email | Done                                                          |
| npm login as `vibe-code-commit`         | Done                                                          |
| npm package `model-lock` published      | Done (`0.1.0` MIT historical; publish `0.1.1` for Apache)     |
| Domain `modellock.dev` / `.io`          | Appears unregistered (buy manually)                           |
| Domain `modellock.com`                  | Taken (do not rely on it)                                     |
| USPTO / NC trademark filing             | Manual legal step                                             |

## Immediate security

Revoke npm granular tokens that were shared in chat. Prefer GitHub Actions trusted publishing for future releases.

Personal names are intentionally omitted from public package metadata.
