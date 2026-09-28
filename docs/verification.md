# Verification

The background organizer uses pi's native Agent runtime and edits the live memory tree through scoped filesystem tools. Foreground sessions only receive their initial resident snapshot.

## Baseline and regression tests

Before replacing the full-tree proposal workflow, these commands passed:

```sh
npm run test:background
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
```

The new Agent regression first failed with `options.callModel is not a function`; the filesystem regression first failed because `createMemoryTools` was absent. Both passed after the native Agent and file tools were implemented.

Current verification commands:

```sh
npm exec --yes --package=bun -- npm test
npm run build
npm run lint
git diff --check
```

The suite includes 198 Bun tests and five background test scripts. It exercises native tool execution, live partial edits, persisted private context, serialized provider prefixes, model selection, interruption recovery, source deduplication, worker serialization, Recent evidence timestamps, budget feedback, and filesystem containment including Windows junctions, alternate streams and hard links.

With `PI_SDK_ROOT` pointing to an installed pi 0.87.1 package:

```sh
node test/resident-loader.mjs
```

This verifies zero foreground memory tools, complete nested Markdown injection, stable and restored session snapshots, and new-session refreshes.

A local live-provider run also verified actual reading, searching, exact file edits, token measurement and cache hits through the configured provider. Its private source material and transcript are not included in this repository. Mock-provider regression tests do not guarantee a particular provider's future cache hit rate.

The optional upstream API E2E and recall-evaluation harnesses remain historical coverage for the legacy design. They are not part of the default no-credentials CI run and have not been validated against the new default entry point.
