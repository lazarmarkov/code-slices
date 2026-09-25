# Tool modes

Both modes use the same pseudocode language. Mode-specific instructions determine which source behavior the translation covers.

## Review order

Both modes order a report so the reviewer meets each thing before the code that uses it. Order files, flows, sections and cards by whichever of these the change follows:

1. Data flow: follow the data from where it enters, such as a request, event or scheduled run, through each transformation to where it is stored, returned or sent on.
2. Dependency: introduce an entity, type or function before the code that creates, calls or depends on it. A new model comes before the service that writes it, and a helper before its callers.

When the two disagree, follow the data flow and link the backward references. Place supporting changes such as schema, registration and configuration with the stage that first needs them, or after the main flow when several stages share them. Never order alphabetically or in the order Git lists files.

## Execution slice - active

Follow one selected execution across functions and components. Show its relevant calls, data transformations, parameters, results, and handoffs. Omit alternative branches while preserving meaningful operations that still execute. Give each function a compact Selected path caption.

The slice being developed is described in [SLICE-INSTRUCTIONS.md](SLICE-INSTRUCTIONS.md). Continue developing this mode.

## Function review - TODO

Describe a whole function's application logic, including meaningful branches, without requiring a selected scenario. Condense TypeScript mechanics while preserving real behavior and dependencies.

This mode is not implemented. Its mode-specific generation and verification instructions remain to be designed. Any summarized inline blocks must be distinguishable from real function calls so the translation does not invent an architecture that the source lacks.

## PR changes - experimental

Compare a pull request as a set of full-function translations. Each card places a unified pseudocode change beside the exact TypeScript function diff. The report marks a pseudocode line only when its authored mapping intersects a line changed in the pinned source snapshots.

This mode has no selected scenario, path caption or scenario filter. It does not replace function review: PR changes explain a revision delta, while function review will describe one complete function without requiring a revision.

Use `src/build-pr.cjs` and the PR-specific generation and verification documents. The execution-slice builder, runtime and styles remain independent.
