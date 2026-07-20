# Ownership checklist status

Copyright holder: **Rabbott LLC** (North Carolina)

Operational GitHub publisher: **[vibe-code-commit/model-lock](https://github.com/vibe-code-commit/model-lock)**

| Step                                    | Status                                                             |
| --------------------------------------- | ------------------------------------------------------------------ |
| LICENSE copyright = Rabbott LLC         | Done                                                               |
| Core license Apache-2.0                 | Done (`0.1.1+`)                                                    |
| NOTICE + docs/ownership.md              | Done                                                               |
| package.json author/repository          | Done                                                               |
| GitHub repo created and pushed          | Done                                                               |
| Branch protection on main               | Done (no force-push, linear history)                               |
| Commit author uses GitHub noreply email | Done                                                               |
| npm login as `vibe-code-commit`         | Done                                                               |
| npm package published                   | Done: [`modellock@0.1.1`](https://www.npmjs.com/package/modellock) |
| Domain `modellock.dev` / `.io`          | Appears unregistered (buy manually)                                |
| Domain `modellock.com`                  | Taken (do not rely on it)                                          |
| USPTO / NC trademark filing             | Manual legal step                                                  |

## Immediate security

Prefer GitHub Actions trusted publishing / OIDC provenance for releases. Avoid pasting npm tokens into chat.

Personal names are intentionally omitted from public package metadata.
