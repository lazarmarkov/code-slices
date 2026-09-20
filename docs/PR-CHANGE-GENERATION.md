# PR-change pseudocode generation

Model and reasoning defaults, alternatives, and comparison reporting format are defined in [AGENTS.md](../AGENTS.md).

## Input

Read both pinned source snapshots and the pull request diff. Exclude tests, evals, fixtures and test helpers. Select changed implementation functions that help a reviewer understand the PR, then order the most meaningful changes first.

## Output

For every selected function, author complete before and after pseudocode. Do not select a runtime scenario or add a path caption. Preserve meaningful branches, calls, data transformations, fallbacks and returned results across the whole function.

Apply the shared pseudocode notation consistently. Predicate aliases, guard clauses, field projection and inclusive ranges must remain traceable to mapped source. Express negated guards with `if !condition`. Keep explicit returns and call parentheses. Do not use `status(a | b)` as a membership test or infer truthiness where the source checks only null or existence.

Write mappings with the pseudocode. Each mapping range is one-based, inclusive and relative to the extracted function. Map a pseudocode line only to the source statement or declaration it represents. Overlapping mappings are allowed when one source range supports more than one pseudocode line.

Use `null` for the missing side of an added or removed function. Keep the existing side complete.

## Coverage

Every changed symbol without a card remains visible in the report remainder. This lets generation prioritize useful explanations without making the unselected source disappear.
