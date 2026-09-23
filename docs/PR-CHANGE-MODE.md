# PR-change mode

PR-change mode is an experimental report for reviewing one source revision against another. Each changed function gets a card: its full-function pseudocode diff on the left and its exact TypeScript diff on the right. Changed source that has no card is listed in a collapsed section at the bottom.

```sh
node src/build-pr.cjs path/to/manifest.json path/to/report.html
```

To build the manifest and card skeleton from two Git revisions, see [PR-PREPARATION.md](PR-PREPARATION.md). [examples/pr-change](../examples/pr-change/manifest.json) is a complete example.

## Manifest

Required fields:

- `title`, `baseRef` and `headRef`: the report title and the two revision labels, ideally commit IDs.
- `sources`: `{ "base": "path/to/base", "head": "path/to/head" }`, two directories that hold the files at each revision.
- `files`: changed implementation file paths, or `{ "path", "note" }` objects. A file that a card names is added if missing.
- `cards`: card objects, or paths to JSON files that hold one card or `{ "cards": [...] }`.

Optional fields:

- `description` appears under the title.
- `cardOrder` lists card IDs that go first. The other cards keep their input order. Put the cards that best explain the PR first.
- `url` and `repositoryURL` are kept in the report data but not shown.

Each card has:

- `id`, `file` and `symbol`. Use `symbol: "constructor"` for a constructor.
- `className`, optional, to pick a class method, an object method or a constructor. `className: null` picks a top-level function when a method has the same name. Without `className`, the symbol must match exactly one function.
- `before` and `after`: full-function pseudocode. Use `null` for the missing side of an added or removed function.
- `mappingsBefore` and `mappingsAfter`: arrays of `{ "pseudo": [first, last], "source": [first, last] }`. Both ranges are one-based, inclusive and relative to the function.

The builder rejects cards for test, eval, fixture and helper files, and leaves those files out of the report.

## Markers

The builder diffs the two source revisions of each function, then diffs the two pseudocode revisions and marks a pseudocode line only when a line it maps to changed:

- `+`: an added pseudocode line that maps to an added source line.
- `-`: a removed pseudocode line that maps to a deleted source line.
- `~`: an unchanged pseudocode line whose mapped source changed.
- No marker: any other line, including pseudocode that was reworded over unchanged source.

Overlapping mappings count each changed source line once. When every changed line a pseudocode line maps to is in the declaration, before the function body, the line gets a `signature` badge. Otherwise its tooltip calls the change `implementation`. Added and removed functions get no badge, because they have no signature edit to tell apart.

## Views

The toolbar has three views, and the report remembers the choice:

- **Pseudo**: the pseudocode alone, capped at about 105 characters wide. Hold Shift and hover a pseudocode line to open a floating peek at the function's source diff. The peek scrolls to and highlights the changed source lines that the line maps to; for a function whose source did not change, it shows the source. Release Shift, press Escape or click outside to close it; move the pointer into it to keep it open.
- **Pseudo + unified** (the default) and **Pseudo + split**: the pseudocode beside the source diff, unified or side by side. Hovering a pseudocode line highlights its changed source lines.

Pseudocode lines wrap to the pane width with a hanging indent. The source panes use [`@pierre/diffs`](https://www.npmjs.com/package/@pierre/diffs). "Remaining source changes" lists each file with changed functions that have no card, or changes outside every function, even on a line shared with one. Its exact file diff renders when you open it.

Both code panes use the Quiet ink palette by default: muted plum keywords, blue calls, teal types, brown literals, charcoal variables, and gray punctuation and comments. The diff backgrounds and the `+`, `-` and `~` markers keep their own colors. See [CODE-PALETTES.md](CODE-PALETTES.md).
