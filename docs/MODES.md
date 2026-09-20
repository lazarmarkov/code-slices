# Tool modes

Both modes use the same pseudocode language. Mode-specific instructions determine which source behavior the translation covers.

## Execution slice - active

Follow one selected execution across functions and components. Show its relevant calls, data transformations, parameters, results, and handoffs. Omit alternative branches while preserving meaningful operations that still execute. Give each function a compact Selected path caption.

The current slice follows a telemetry event through a new Investigation, Job and Task execution, and closure. Continue developing this mode.

## Function review - TODO

Describe a whole function's application logic, including meaningful branches, without requiring a selected scenario. Condense TypeScript mechanics while preserving real behavior and dependencies.

This mode is not implemented. Its mode-specific generation and verification instructions remain to be designed. Any summarized inline blocks must be distinguishable from real function calls so the translation does not invent an architecture that the source lacks.

## PR changes - experimental

Compare a pull request as a set of full-function translations. Each card places a unified pseudocode change beside the exact TypeScript function diff. The report marks a pseudocode line only when its authored mapping intersects a line changed in the pinned source snapshots.

This mode has no selected scenario, path caption or scenario filter. It does not replace function review: PR changes explain a revision delta, while function review will describe one complete function without requiring a revision.

Use `src/build-pr.cjs` and the PR-specific generation and verification documents. The execution-slice builder, runtime and styles remain independent.
