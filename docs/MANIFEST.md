# Manifest format

The builder accepts an authored JSON manifest and writes one standalone HTML report. Paths in sources and flows are relative to the manifest. Snapshots must contain matching relative source file paths.

Required top-level fields:

- `title`, `baseRef`, `headRef`: report labels and pinned revision IDs when available.
- `sources`: `{ "base": "path/to/base", "head": "path/to/head" }`.
- `files`: changed implementation file paths, or `{ "path", "note" }` objects. Include supporting files as well as functions covered by slices. Test/eval files are excluded.
- `flows`: flow objects, or JSON file paths containing one flow or `{ "flows": [...] }`.

Optional `description`, `url`, and `repositoryURL` add context. repositoryURL should be a GitHub repository URL for commit-pinned source links. Without it, the report remains local.

Each flow has `id`, `title`, `description`, `tree`, optional `treeBefore`, and `cards`.

Each card has:

- `id`, `file`, `symbol`; optional `className` disambiguates methods.
- `scenario`, optional `scenarioBefore`: compact path captions without a marker.
- `change`: the PR's behavioral change.
- `before`, `after`: authored pseudocode strings; `before: null` for new functions.
- `mappingsBefore`, `mappingsAfter`: arrays of `{ "pseudo": [first,last], "source": [first,last] }` using one-based inclusive lines relative to each function, excluding the generated caption. Overlapping mappings are allowed and counted once for the hidden-line gauge.

The source extractor supports TypeScript function declarations, class methods, and function-valued variable declarations. The renderer currently supports local function mappings. References to other functions/files remain a packaging TODO; do not invent a local mapping for them.

Pseudocode is LLM-authored following the language and verifier instructions. The builder does not parse or execute it, and cannot independently prove a mapping's semantic fidelity. It validates ranges and reads exact source functions from the snapshots.

A changed function outside the slices is shown as not covered. File-level diffs remain available. Supporting declarations are visible in exact diffs; type definitions can be revealed with Alt.
