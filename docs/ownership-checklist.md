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
| npm package `model-lock` published      | Blocked: npm requires 2FA / granular token to publish         |
| Domain `modellock.dev` / `.io`          | Appears unregistered (buy manually)                           |
| Domain `modellock.com`                  | Taken (do not rely on it)                                     |
| USPTO / NC trademark filing             | Manual legal step                                             |

## Finish npm claim (required)

1. Enable 2FA on the npm account: https://www.npmjs.com/settings/~/account/recovery
2. Create a granular access token with **publish** permission for `model-lock`, or finish 2FA setup and re-run:

```bash
npm publish --access public
```

Prefer later releases via GitHub Actions trusted publishing (OIDC) so local tokens are unnecessary.

Personal names are intentionally omitted from public package metadata.
