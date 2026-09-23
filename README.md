# Code Slices

Code Slices builds standalone HTML reports that explain changed TypeScript code. A report shows authored pseudocode beside the exact source, and each pseudocode line maps to the source lines it describes.

There are two modes:

- **Execution slice** follows one selected execution path through the changed functions.
- **PR change** (experimental) shows each changed function as a pseudocode diff beside its exact TypeScript diff. A pseudocode line is marked as changed only when the source lines it maps to changed.

See [docs/MODES.md](docs/MODES.md) for how the modes differ.

## Quick start

You need Node.js 20 or later, pnpm and Git.

```sh
pnpm install
pnpm example           # writes dist/example.html (execution slice)
pnpm example:pr        # writes dist/pr-change.html (PR change)
pnpm example:palettes  # writes dist/palettes.html (code palette comparison)
pnpm test
```

Open a report file directly in a browser; it needs no server. It does need network access, because it loads its code renderer, [`@pierre/diffs`](https://www.npmjs.com/package/@pierre/diffs), from esm.sh.

## What the examples show

Both examples are small synthetic changes to one file, `message.ts`.

[`examples/execution-slice`](examples/execution-slice/manifest.json) has one flow, "Normalize one message", with a card for `normalizeMessage`. The changed-code index also lists `isEmptyMessage`, which no slice covers. Use the toolbar to switch between the After, Before and Changes revisions, and between the Pseudocode and Split views.

[`examples/pr-change`](examples/pr-change/manifest.json) has four cards, one for each kind of marker:

| Card               | What it shows                                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `normalizeMessage` | `-` and `+`: a pseudocode line was replaced, and its mapped source line changed.                                                          |
| `legacySlug`       | A removed function: every line is marked `-`.                                                                                             |
| `formatLabel`      | `~`: the pseudocode is the same, but the source it maps to changed.                                                                       |
| `stableGreeting`   | No marker: the pseudocode was reworded, but the source did not change. An identical function, `copiedGreeting`, was added right above it. |

The "Remaining source changes" section lists the changes that have no card: the added `copiedGreeting`, the changed `uncoveredHelper`, and the `FORMAT_VERSION` constant, which is outside any function.

## Build a report

Each mode has its own builder. Both take a manifest and an output path:

```sh
node src/build.cjs path/to/manifest.json path/to/report.html      # execution slice
node src/build-pr.cjs path/to/manifest.json path/to/report.html   # PR change
```

Source snapshot paths and referenced JSON files resolve relative to the manifest. The manifest formats are in [docs/MANIFEST.md](docs/MANIFEST.md) (execution slice) and [docs/PR-CHANGE-MODE.md](docs/PR-CHANGE-MODE.md) (PR change).

To review a real pull request, [docs/PR-PREPARATION.md](docs/PR-PREPARATION.md) shows how to extract the changed functions from two Git revisions, author and validate the cards, and build the report.

## Limits

- The repository does not run a model. Pseudocode and mappings are authored by a model or a person, following the generation and verification documents below.
- The extractor finds function declarations, class and object methods, constructors and function-valued variables in `.ts`, `.tsx`, `.mts` and `.cts` files.
- A mapping must point inside the displayed function. Mappings to other functions or files are not supported yet.
- Tests, evals and fixtures are always left out of reports. PR-change reports also leave out helper directories.
- A report embeds the source it displays. Keep it as confidential as that source.

## Documents

| Document                                                       | Covers                                                                           |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [MODES.md](docs/MODES.md)                                      | The execution-slice, PR-change and planned function-review modes                 |
| [MANIFEST.md](docs/MANIFEST.md)                                | The execution-slice manifest                                                     |
| [PR-CHANGE-MODE.md](docs/PR-CHANGE-MODE.md)                    | The PR-change manifest, markers and report views                                 |
| [PR-PREPARATION.md](docs/PR-PREPARATION.md)                    | Preparing, validating and building a report for a real pull request              |
| [PR-CHANGE-GENERATION.md](docs/PR-CHANGE-GENERATION.md)        | How to write PR-change pseudocode and mappings                                   |
| [PR-CHANGE-VERIFICATION.md](docs/PR-CHANGE-VERIFICATION.md)    | How to check PR-change cards before building                                     |
| [PSEUDOCODE-LANGUAGE.md](docs/PSEUDOCODE-LANGUAGE.md)          | The pseudocode notation shared by both modes                                     |
| [SLICE-INSTRUCTIONS.md](docs/SLICE-INSTRUCTIONS.md)            | Which execution the current slice follows, and the `▹` caption                   |
| [GENERATION-WORKFLOW.md](docs/GENERATION-WORKFLOW.md)          | The generator and verifier roles for execution slices                            |
| [VERIFICATION.md](docs/VERIFICATION.md)                        | How to check an execution slice                                                  |
| [TOOL-INTERACTIONS.md](docs/TOOL-INTERACTIONS.md)              | How the execution-slice report looks and responds                                |
| [CODE-PALETTES.md](docs/CODE-PALETTES.md)                      | The code color palettes                                                          |
| [RULES.md](docs/RULES.md)                                      | Which document each kind of rule belongs in                                      |
