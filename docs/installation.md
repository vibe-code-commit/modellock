# Installation

## Requirements

- Node.js 24 or newer (Active LTS). The repository pins `24` in `.nvmrc` and `.node-version`.

## Global install

```bash
npm install -g model-lock
model-lock --version
```

## Project install

```bash
npm install -D model-lock
npx model-lock init
```

## From source

```bash
git clone https://github.com/vibe-code-commit/model-lock.git
cd model-lock
npm ci
npm run build
node dist/cli.js --help
```

## GitHub Action

Pin a released tag after the first public release:

```yaml
- uses: vibe-code-commit/model-lock@v0
```

The Action runs the committed bundle at `dist/action/index.js`. No secrets are
required for the default offline check path.
