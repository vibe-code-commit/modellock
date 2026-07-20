# Release checklist

- [ ] `npm ci`
- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Confirm `dist/cli.js` and `dist/action/index.cjs` are committed
- [ ] Confirm `action.yml` points at `dist/action/index.cjs`
- [ ] Confirm README opening line is exact
- [ ] Confirm Node 24 pinned in `.nvmrc`, `.node-version`, and `engines`
- [ ] Tag release: `git tag v0.1.0 && git push origin v0.1.0`
- [ ] Ensure `NPM_TOKEN` secret exists for the Release workflow
- [ ] Verify npm package publishes with provenance
- [ ] Verify GitHub Release assets include CLI/Action bundles

## First public publish (manual fallback)

```bash
npm ci
npm run build
npm test
npm publish --access public --provenance
```

Then create a GitHub release from tag `v0.1.0`.
