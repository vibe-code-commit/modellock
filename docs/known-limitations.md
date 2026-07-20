# Known limitations

- Official-provider evidence is curated structured JSON under `data/official/`, not live HTML scraping. Keep packs updated via the registry refresh workflow and manual review.
- Python discovery uses robust pattern scanning rather than a full native tree-sitter binding, so unusual formatting may need `pins` / `include`.
- JS/TS discovery focuses on literal model identifiers in SDK/config shapes; dynamically computed model IDs are not resolved.
- Renamed models appear as remove+add across keys (`provider:old` vs `provider:new`); there is no automatic rename graph.
- Offline `check` compares against the shipped/frozen registry snapshot unless `--network` is enabled.
- GitHub Action `uses:` path assumes a published repository tag; until published, reference this repo by commit SHA or run `npx modellock check`.
- Live endpoint tests (`npm run test:live`) depend on third-party availability and are excluded from default CI unit tests.
