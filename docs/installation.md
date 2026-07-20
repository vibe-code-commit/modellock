# Installation

## Requirements

- Node.js 24 or newer (Active LTS). The repository pins `24` in `.nvmrc` and `.node-version`.

## Global install

```bash
npm install -g modellock
modellock --version
```

## Project install

```bash
npm install -D modellock
npx modellock init
```

## From source

```bash
git clone https://github.com/vibe-code-commit/modellock.git
cd modellock
npm ci
npm run build
node dist/cli.js --help
```

## GitHub Action

Pin a released tag after the first public release:

```yaml
- uses: vibe-code-commit/modellock@v0
```

The Action runs the committed bundle at `dist/action/index.cjs`. No secrets are
required for the default offline check path.
