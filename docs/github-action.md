# GitHub Action examples

## Default (read-only)

See [`examples/workflows/modellock.yml`](../examples/workflows/modellock.yml).

```yaml
permissions:
  contents: read

jobs:
  modellock:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: vibe-code-commit/modellock@v0
        with:
          working-directory: .
          network: "false"
          fail-on-warn: "false"
          format: human
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: modellock-report
          path: modellock-report/
          if-no-files-found: ignore
```

## Optional write workflow

See [`examples/workflows/modellock-with-pr.yml`](../examples/workflows/modellock-with-pr.yml)
for a narrowly scoped workflow that can open a PR with a proposed lockfile update.

## Inputs

| Input               | Default | Description                 |
| ------------------- | ------- | --------------------------- |
| `working-directory` | `.`     | Path to check               |
| `network`           | `false` | Fetch public metadata       |
| `fail-on-warn`      | `false` | Treat warnings as failures  |
| `format`            | `human` | `human`, `json`, or `sarif` |

## Behavior

- Runs `modellock check`
- Writes a GitHub step summary
- Adds file annotations for findings with paths
- Uploads machine-readable reports under `modellock-report/`
- Never sends repository contents to ModelLock servers (there are none)
