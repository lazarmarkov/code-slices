# Execution-slice manifest

`src/build.cjs` reads a JSON manifest and writes one standalone HTML report. Paths in `sources` and `flows` resolve relative to the manifest. Both snapshot directories use the same relative file paths. [examples/execution-slice](../examples/execution-slice/manifest.json) is a complete example.

```sh
node src/build.cjs path/to/manifest.json path/to/report.html
```

Required fields:

- `title`, `baseRef` and `headRef`: the report title and the two revision labels, ideally commit IDs.
- `sources`: `{ "base": "path/to/base", "head": "path/to/head" }`.
- `files`: changed implementation file paths, or `{ "path", "note" }` objects. List supporting files as well as the files that slices cover. Test, eval and fixture files are left out.
- `flows`: flow objects, or paths to JSON files that hold one flow or `{ "flows": [...] }`.

Optional fields:

- `description` appears under the title.
- `repositoryURL`, a GitHub repository URL, makes source links point at the pinned commits. Without it, links stay inside the report.
- `url` is kept in the report data but not shown.

Each flow has `id`, `title`, `description`, `tree` (the call tree shown for After and Changes), optional `treeBefore` (shown for Before) and `cards`.

Each card has:

- `id`, `file` and `symbol`, plus `className` to pick a method when the name is not unique.
- `scenario`, and optional `scenarioBefore`: the `▹` caption for the selected path, without the `▹`. See [SLICE-INSTRUCTIONS.md](SLICE-INSTRUCTIONS.md).
- `change`: the PR's behavior change, shown under the card.
- `before` and `after`: the pseudocode. Use `before: null` for a function the PR adds.
- `mappingsBefore` and `mappingsAfter`: arrays of `{ "pseudo": [first, last], "source": [first, last] }`. Both ranges are one-based, inclusive and relative to the function, not counting the `▹` caption. Mappings may overlap.

The builder finds function declarations, class and object methods, constructors and function-valued variables. A mapping must point inside the displayed function; references to other functions or files are not supported yet, so do not map them to an unrelated local line.

The builder checks that each mapping range fits its function and reads the exact functions from the snapshots. It does not parse the pseudocode, and it cannot check that a mapping means what it says. That is the verifier's job; see [VERIFICATION.md](VERIFICATION.md).

## What the report shows

- The changed-code index lists every changed function. A function without a card is marked "not covered by a slice", and each file's exact diff opens from the index.
- Files with no changed functions appear under "Supporting changes".
- A yellow dot on a card means more than 30% of the function's nonblank source lines have no mapping. Complete `Logger.log(...)` statements are not counted. Overlapping mappings count each source line once.
- Holding Alt shows the type, interface and enum declarations that a flow's call tree or After pseudocode names.
