# Code Slices

Code Slices builds a standalone HTML report that explains selected execution paths through changed TypeScript code. Each report combines authored pseudocode, exact source functions, source mappings, revision comparisons, and an index of changed functions that the selected slices do not cover.

## Quick start

Install dependencies and build the synthetic example:

```sh
pnpm install
pnpm example
```

Open `dist/example.html` in a browser. The report is self-contained and does not need a server.

To build another report, pass a manifest and output path to the builder:

```sh
node src/build.cjs path/to/manifest.json path/to/report.html
```

Source snapshot paths and referenced flow files are resolved relative to the manifest. See [docs/MANIFEST.md](docs/MANIFEST.md) for the input format.

## Prototype status

This repository contains a working report builder and browser renderer. It also documents an authored generator and verifier workflow, but it does not include an automated LLM runner.

The source extractor currently supports TypeScript function declarations, class methods, and function-valued variables. Packaged reports support mappings within the displayed function. External function and file mapping previews from the original prototype have not been generalized yet.

Generated reports embed the source they display. Handle each report according to the confidentiality of its input source.

## Design documents

- [Manifest format](docs/MANIFEST.md)
- [Tool modes](docs/MODES.md)
- [Pseudocode language](docs/PSEUDOCODE-LANGUAGE.md)
- [Generation workflow](docs/GENERATION-WORKFLOW.md)
- [Verification criteria](docs/VERIFICATION.md)
- [Tool interactions](docs/TOOL-INTERACTIONS.md)
