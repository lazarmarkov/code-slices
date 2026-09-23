# Code Slices

## PR-change pseudocode generation

- Use `gpt-5.6-sol` with reasoning effort `medium` by default.
- If a Claude alternative is requested, recommend `claude-sonnet-5` with effort `medium`. Treat it as an unbenchmarked alternative, not as proven equivalent. See the official [Sonnet 5 overview](https://platform.claude.com/docs/en/models/sonnet-5/overview) and [effort documentation](https://platform.claude.com/docs/en/build-with-claude/effort).
- Report model or benchmark comparisons as a concise table only.
- Follow [docs/PR-CHANGE-GENERATION.md](docs/PR-CHANGE-GENERATION.md) for authoring requirements.

## Checking changes

- Run `pnpm test`.
- The rendered reports are the product. After changing a builder, runtime or stylesheet, run `pnpm example` and `pnpm example:pr` and compare `dist/example.html` and `dist/pr-change.html` in a browser against the previous build, in every toolbar view. Reports load `@pierre/diffs` from esm.sh, so this needs network access.
- `src/runtime.js` and `src/runtime-pr.js` run in the browser, inlined into the report. They cannot `require` the shared Node modules in `src/`, so they keep their own small helpers.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
