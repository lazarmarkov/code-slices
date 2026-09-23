# Rule categories

## Where each rule belongs

| Category | Question it answers | Rules collected so far | Document |
| --- | --- | --- | --- |
| Language | What does the notation mean, and what is implicit? | Calls, results, nesting, partial objects, model-instance shorthand, implicit tenant/org scope, explicit enqueue/sendMessage primitives, source mapping representation | [PSEUDOCODE-LANGUAGE.md](PSEUDOCODE-LANGUAGE.md) |
| Slice instructions | Which execution and level of detail are we explaining? | One selected execution from its trigger to closure; simplest scenario; no scenario forks or obvious assumptions; code-centered orchestration across components | [SLICE-INSTRUCTIONS.md](SLICE-INSTRUCTIONS.md) |
| Verification | What makes a translation acceptable? | Source fidelity, meaningful transformations, origins of values, consistent vocabulary, correct nesting/mappings, consistency between views, comments that add necessary information, no invented execution evidence | [VERIFICATION.md](VERIFICATION.md) |
| Interactions | How does the reader explore the result? | Global split, persisted view choice, pseudocode left, paired hover highlights, clickable persistent source links, Alt type expansion, stage navigation, concrete filenames, concise controls, standalone report | [TOOL-INTERACTIONS.md](TOOL-INTERACTIONS.md) |
| Generation process | How do roles produce and approve the artifact? | Generator freedom within language/slice; source-aware verifier; actionable feedback; revise and reverify; unresolved issues cannot pass | [GENERATION-WORKFLOW.md](GENERATION-WORKFLOW.md) |

## Routing future decisions

Classify each new rule by the question above and update its owning document when adopted. Do not wait for a separate request to record it.

- If a decision spans categories, split it into the relevant parts and cross-reference them rather than copying the entire rule.
- For example, comments are available notation in the language; the field-by-field test of their usefulness belongs to verification.
- Partial object previews belong to the language; holding Alt to reveal full definitions belongs to interactions; checking that omitted fields do not hide meaningful behavior belongs to verification.
- Selecting one scenario belongs to slice instructions, not a restriction that the language can never express a branch.
- Keep verification criteria actionable without requiring the generator to carry the entire checklist. Give the generator the corresponding high-level quality goals.
- Distinguish adopted requirements from implemented behavior. A documented decision is not proof that the current prototype or a reusable runner implements it.
- Once a UI decision is settled, apply it to the prototype so the user can assess it directly.

## Findings and unfinished work are separate

Findings about an inspected application are not pseudocode rules. Preserve its actual implementation until application code changes.

## Modes

See [MODES.md](MODES.md). Execution slice is active; Function review is TODO. Both share the language. Selected-path captions and omission of alternative branches belong to Execution slice, not universal language or verification requirements. Current slice and verifier instructions target the active mode; Function review needs its own mode-specific instructions before use.

## Tool-wide input exclusions

Ignore test and eval files completely. Exclude them before extraction or generation, including from slices, source views, diffs, changed-code indexes, coverage denominators, and report evidence. This applies to both modes, not only PR review. Test, eval and fixture directories, `*.test.*`, `*.spec.*` and `*.eval.*` files, and `testHelpers` files are outside the report's input set. PR-change mode and PR preparation also leave out `helpers/` and `test-helpers/` directories. Both rules live in `src/excluded-paths.cjs`.
