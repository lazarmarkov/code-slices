# Code Slices

Code Slices builds standalone HTML reports that explain changed TypeScript code. The active execution-slice mode follows selected paths. The experimental PR-change mode compares full-function pseudocode with exact TypeScript changes and marks only changes backed by mapped source lines.

## Quick start

Install dependencies and build the synthetic example:

```sh
pnpm install
pnpm example
```

Open `dist/example.html` in a browser. The report is self-contained and does not need a server.

Build the synthetic PR-change example separately:

```sh
pnpm example:pr
```

Open `dist/pr-change.html`. It demonstrates added, removed and source-backed modification markers, a wording-only edit that stays neutral, and a collapsed remainder for source changes without pseudocode cards.

To build another report, pass a manifest and output path to the builder:

```sh
node src/build.cjs path/to/manifest.json path/to/report.html
```

PR-change reports use their own builder:

```sh
node src/build-pr.cjs path/to/pr-manifest.json path/to/report.html
```

Source snapshot paths and referenced flow files are resolved relative to the manifest. See [docs/MANIFEST.md](docs/MANIFEST.md) for the input format.

## Prototype status

This repository contains a working report builder and browser renderer. It also documents an authored generator and verifier workflow, but it does not include an automated LLM runner.

The source extractor currently supports TypeScript function declarations, class methods, and function-valued variables. Packaged reports support mappings within the displayed function. External function and file mapping previews from the original prototype have not been generalized yet.

Generated reports embed the source they display. Handle each report according to the confidentiality of its input source.

## Design documents

- [Manifest format](docs/MANIFEST.md)
- [Tool modes](docs/MODES.md)
- [PR-change mode](docs/PR-CHANGE-MODE.md)
- [PR-change generation](docs/PR-CHANGE-GENERATION.md)
- [PR-change verification](docs/PR-CHANGE-VERIFICATION.md)
- [Pseudocode language](docs/PSEUDOCODE-LANGUAGE.md)
- [Code palettes](docs/CODE-PALETTES.md)
- [Generation workflow](docs/GENERATION-WORKFLOW.md)
- [Verification criteria](docs/VERIFICATION.md)
- [Tool interactions](docs/TOOL-INTERACTIONS.md)
