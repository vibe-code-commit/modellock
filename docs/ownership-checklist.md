# Ownership checklist status

Copyright holder: **Rabbott LLC** (North Carolina)

Operational GitHub publisher: **[vibe-code-commit/model-lock](https://github.com/vibe-code-commit/model-lock)**

| Step                                    | Status                                       |
| --------------------------------------- | -------------------------------------------- |
| LICENSE copyright = Rabbott LLC         | Done                                         |
| Core license Apache-2.0                 | Done (`0.1.1+`)                              |
| NOTICE + docs/ownership.md              | Done                                         |
| package.json author/repository          | Done                                         |
| GitHub repo created and pushed          | Recreated 2026-07-20                         |
| Branch protection on main               | Re-apply after push                          |
| Commit author uses GitHub noreply email | Done                                         |
| npm login as `vibe-code-commit`         | Required for republish                       |
| npm package `model-lock` published      | Republish `0.1.1` Apache-2.0 after unpublish |
| Domain `modellock.dev` / `.io`          | Appears unregistered (buy manually)          |
| Domain `modellock.com`                  | Taken (do not rely on it)                    |
| USPTO / NC trademark filing             | Manual legal step                            |

## Immediate security

Prefer GitHub Actions trusted publishing / OIDC provenance for releases. Avoid pasting npm tokens into chat.

Personal names are intentionally omitted from public package metadata.
