# PR-change mode

PR-change mode is an experimental, standalone report for reviewing one source revision against another. It leads with authored full-function pseudocode and places the exact TypeScript function diff beside it. Changed source that has no pseudocode card appears in a collapsed remainder at the bottom.

## Manifest

Run:

```sh
node src/build-pr.cjs path/to/manifest.json path/to/report.html
```

The manifest requires:

- `title`, `baseRef` and `headRef`.
- `sources`: `{ "base": "path/to/base", "head": "path/to/head" }`.
- `files`: changed implementation file paths, or `{ "path", "note" }` objects.
- `cards`: card objects or paths to JSON containing one card or `{ "cards": [...] }`.

Optional `description`, `url` and `repositoryURL` fields provide report context.
Optional `cardOrder` lists card IDs that should lead the report. Unlisted cards retain their input order.
Optional `sections` groups the report into numbered reading stages, as an alternative to `cardOrder`. Each section has a `title`, an optional `intro` (blank lines separate paragraphs, a paragraph whose lines all start with `1. ` or `- ` renders as a list, backticks mark code), optional `terms` as `[term, meaning]` pairs, and the `cards` it contains in reading order. Section order is report order. A card may appear in at most one section, every listed ID must exist, and unlisted cards follow under Other changes. Each section opens with a heading panel in the report and a heading in the sidebar.

Each card has:

- `id`, `file` and `symbol`.
- Optional `className` to disambiguate class methods, object-owned methods and constructors. Use `symbol: "constructor"` for a constructor. Set `className: null` to select a top-level function when a method has the same name; omitting it allows one unambiguous match.
- `before` and `after`: full-function pseudocode strings. Use `null` on the missing side of an added or removed function.
- Optional `calls` and `calledBy`: card IDs rendered as links under the card header. IDs without a card in the report are dropped, and links follow report order.
- `mappingsBefore` and `mappingsAfter`: arrays of `{ "pseudo": [first, last], "source": [first, last] }`. Both ranges are one-based, inclusive and relative to the extracted function.

Card order is report order. Put the changes that best explain the PR first.

## Marker contract

The builder asks Git for zero-context source hunks and intersects those exact line sets with authored mappings. It then builds the pseudocode display itself:

- `+` is an added pseudocode line mapped to an added source line.
- `-` is a removed pseudocode line mapped to a deleted source line.
- `~` is unchanged pseudocode text whose mapped source changed.
- A wording-only pseudocode edit with no mapped source change stays neutral.

Overlapping mappings use line sets, so one changed source line is counted once. An evidence badge labels mapped edits as `signature` when all changed lines precede the function body, or `implementation` when any changed line reaches the function body.

The toolbar offers three views, remembered across reloads: Pseudo (pseudocode alone, no source pane rendered), Pseudo + unified and Pseudo + split. Pseudocode lines wrap to the pane width with a hanging indent instead of scrolling horizontally, and the Pseudo view caps each card at about 105 characters of code. In the Pseudo view, Shift + hover on a pseudocode line opens a floating peek at the function's source, rendered on demand, scrolled to the mapped lines and highlighted; it closes on Shift release, Escape or a click outside, and stays open while the pointer is inside it. The adjacent TypeScript pane uses Pierre `FileDiff` on the extracted source functions. A registered Pierre theme derives its token colors from the same selected palette as the pseudocode while preserving Pierre's line and intra-line diff markup. The remainder uses exact file diffs. Test, eval, fixture and test-helper paths are excluded before report data is assembled.

Both code panes use Quiet ink by default: muted plum keywords, blue calls, teal types, brown literals, charcoal variables, and gray punctuation or comments. Diff backgrounds and `+`, `-`, and `~` grounding retain their separate meaning.
