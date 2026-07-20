# Ownership checklist status

Copyright holder: **Rabbott LLC** (North Carolina)

Operational GitHub publisher: **[vibe-code-commit/model-lock](https://github.com/vibe-code-commit/model-lock)**

| Step                                    | Status                                                        |
| --------------------------------------- | ------------------------------------------------------------- |
| LICENSE copyright = Rabbott LLC         | Done                                                          |
| NOTICE + docs/ownership.md              | Done                                                          |
| package.json author/repository          | Done                                                          |
| GitHub repo created and pushed          | Done ([link](https://github.com/vibe-code-commit/model-lock)) |
| Branch protection on main               | Done (no force-push, linear history)                          |
| Commit author uses GitHub noreply email | Done                                                          |
| npm login as `vibe-code-commit`         | Done                                                          |
| npm package `model-lock` published      | Done (`model-lock@0.1.0`)                                     |
| Domain `modellock.dev` / `.io`          | Appears unregistered (buy manually)                           |
| Domain `modellock.com`                  | Taken (do not rely on it)                                     |
| USPTO / NC trademark filing             | Manual legal step                                             |

## Immediate security

Revoke **both** npm granular tokens created for this publish (they were shared in chat). Local auth token config was cleared after publish.

Future releases: prefer GitHub Actions trusted publishing / OIDC in `release.yml` instead of long-lived local tokens.

Personal names are intentionally omitted from public package metadata.
