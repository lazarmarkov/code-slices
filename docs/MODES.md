# Modes

All modes use the same [pseudocode language](PSEUDOCODE-LANGUAGE.md). Each mode decides which source behavior the pseudocode covers.

## Execution slice (active)

An execution slice follows one selected execution across functions and components. It shows the calls, data transformations, parameters, results and handoffs on that path. It leaves out branches the path does not take, but keeps every meaningful operation that still runs. Each function gets a short `▹` caption that names the path it follows.

The current slice follows a placed order through a new Shipment, Pick and Pack execution, to delivery. See [SLICE-INSTRUCTIONS.md](SLICE-INSTRUCTIONS.md). This mode is still being developed.

Build it with `src/build.cjs`; the manifest is in [MANIFEST.md](MANIFEST.md).

## PR change (experimental)

A PR-change report explains a pull request one whole function at a time. Each card shows a pseudocode diff beside the exact TypeScript diff of the function. A pseudocode line is marked only when a source line it maps to changed.

This mode has no selected scenario, no path caption and no scenario filter. It does not replace function review: a PR-change report explains the difference between two revisions, while function review will describe one whole function at one revision.

Build it with `src/build-pr.cjs`; see [PR-CHANGE-MODE.md](PR-CHANGE-MODE.md), [PR-CHANGE-GENERATION.md](PR-CHANGE-GENERATION.md) and [PR-CHANGE-VERIFICATION.md](PR-CHANGE-VERIFICATION.md). The two modes have separate builders, runtimes and styles.

## Function review (not implemented)

Function review will describe a whole function's application logic, including its meaningful branches, without a selected scenario. It will condense TypeScript mechanics but keep real behavior and dependencies.

Its generation and verification instructions are not written yet. If it summarizes inline blocks, the summaries must look different from real function calls, so the pseudocode does not invent structure the source lacks.
