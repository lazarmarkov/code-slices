# Private project context

This folder holds context that must not reach the public repository: company and product names, internal domain models, real code excerpts and calibration examples drawn from a real codebase. Everything here except this README is gitignored.

Put any such information here, never in tracked docs, source or tests. The tracked docs keep fictional examples that carry the same rule.

- `*.md`: project notes. `prepare-pr.cjs` appends them to the generation and verification packets, and agents read them alongside the public docs before generating or verifying a report. Name each file after its project, for example `acme.md`.
- `config.json` (optional): `scopeIdentifiers` extends the routine scope identifiers the card validator warns about, and `pseudocodeLiterals` extends the words the pseudocode highlighter renders as literals.
