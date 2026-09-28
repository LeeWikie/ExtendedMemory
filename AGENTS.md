# Repository Guidelines

## Project Structure & Module Organization

- `index.ts`: the entire pi extension (single-file, TypeScript loaded directly by `pi`)
- `test/*.test.mjs`: native background Agent and filesystem regression tests
- `test/resident-loader.mjs`: verification through pi's actual extension loader
- `background/skills/para-memory-files/`: the background Agent's private organization Skill
- `templates/basic/MEMORY/`: empty, generic initial Markdown files
- `README.md`: user-facing install/usage docs
- `package.json`: metadata + **peer** dependencies (provided by the pi runtime)

Runtime data lives outside the public repo under `~/.extended-memory/MEMORY/`; private worker state and configuration are its siblings. `registerLegacyMemory` and the upstream API E2E/eval harnesses retain the older `~/.pi/agent/memory/` layout only for historical compatibility.

The default entry point exposes no memory tools or organizer Skill to the foreground Agent. Reuse pi's native Agent for background work; it directly edits live memory using filesystem tools scoped to the memory directory. Do not add a custom Agent loop, candidate-tree validation, or a publication gate. Keep `.git`, raw imports, worker state and credentials outside the Agent's filesystem scope.

## Activity Tracking (Required)

- Track all work sessions by writing a short entry to the pi-memory daily log using `memory_write` (target: `daily`).
- Summaries should include what changed, files touched, and any notable decisions.
- Use the scratchpad tool for follow-ups or TODOs discovered during work.
- If those tools are unavailable, record activity in a local runtime work log outside this public repository. Public commit notes may contain implementation and test details, never personal memory content.

## Build, Test, and Development Commands

- `pi -p -e ./index.ts "remember: I prefer dark mode"`: manual local run (print mode)
- `pi install .`: install the extension into pi
- `npm test`: run the Bun unit/resident suite and five Node background regression scripts; no API key or qmd required
- `npm exec --yes --package=bun -- npm test`: same suite when Bun is not installed globally
- `npm run test:background`: run just the background regression scripts
- `npm run test:e2e` / `npm run test:eval`: historical upstream harnesses; do not treat these as validation of the new default entry point
- `npm run build`: typecheck with `tsc` (`--noEmit`)
- `npm run lint`: lint with Biome
- Optional (for `memory_search`, requires Bun): `command -v qmd >/dev/null 2>&1 || bun install -g https://github.com/tobi/qmd`
- Optional search setup: `qmd collection add ~/.pi/agent/memory --name pi-memory && qmd embed`

## Coding Style & Naming Conventions

- Keep `index.ts` self-contained; avoid adding a build step unless absolutely necessary.
- Match existing formatting: tabs for indentation, semicolons, and double quotes.
- Naming: `camelCase` for functions, `PascalCase` for types, `SCREAMING_SNAKE_CASE` for constants; tool names remain `snake_case` (e.g. `memory_write`).

## Testing Guidelines

- Enforce TDD for every behavior change: follow `red -> green -> refactor`.
- Start by establishing a verifiable baseline: run the relevant existing tests before edits, and record the exact command + outcome in the PR/commit notes.
- Add or update a failing test first that reproduces the bug or captures the new requirement; implement code only after the test fails for the expected reason.
- Keep tests green after implementation and after any refactor; do not merge with skipped failing tests.
- Every bug fix must include a regression test that fails before the fix and passes after it.
- Tests touch `~/.pi/agent/memory/`; ensure backups/restores remain intact and new tests don’t leak user data.
- Prefer behavior-focused assertions (tool availability, file contents, cross-session recall). Keep timeouts generous for model latency.

## Commit & Pull Request Guidelines

- Use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`) and keep messages imperative.
- PRs: include a short summary, exact test command(s) run, and call out any changes to on-disk memory formats or `qmd` behavior.

## Security & Configuration Tips

- Never commit real memory files or secrets. Tests assume `pi` is configured via environment (e.g. `OPENAI_API_KEY`).
