# Code Slices

## PR-change pseudocode generation

- Use `gpt-5.6-sol` with reasoning effort `medium` by default.
- If a Claude alternative is requested, recommend `claude-sonnet-5` with effort `medium`. Treat it as an unbenchmarked alternative, not as proven equivalent. See the official [Sonnet 5 overview](https://platform.claude.com/docs/en/models/sonnet-5/overview) and [effort documentation](https://platform.claude.com/docs/en/build-with-claude/effort).
- Report model or benchmark comparisons as a concise table only.
- Follow [docs/PR-CHANGE-GENERATION.md](docs/PR-CHANGE-GENERATION.md) for authoring requirements.

## Private project context

- Put project-specific or confidential information in `private/`, never in tracked docs, source, tests or examples. This covers company and product names, internal domain models, real code excerpts and calibration examples drawn from a real codebase. See [private/README.md](private/README.md).
- Before generating or verifying a report, read the `private/*.md` notes for the source project. They extend the public docs.
- Tracked docs, tests and examples use fictional code that carries the same idea.
