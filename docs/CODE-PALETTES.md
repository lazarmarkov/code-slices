# Code palettes

Pseudocode and TypeScript share seven color roles: keyword, call, type, literal, variable, punctuation and comment. A palette assigns a color to every role, and both panes use the same colors.

The palettes are defined in `src/code-palettes.cjs`. PR-change reports use Quiet ink. They register it as a Pierre theme for the source diff, so Pierre still draws its own line and word-level diff highlighting. Execution-slice reports use Pierre's GitHub light theme.

To compare the palettes on one card of a PR-change manifest, build the preview page:

```sh
pnpm example:palettes
# or: node src/build-palette-preview.cjs <manifest.json> <card-id-or-symbol> <output.html>
```

The preview colors TypeScript with the TypeScript compiler's scanner and a few rules for identifiers, such as a name followed by `(` being a call. It is lexical highlighting only; it does not type-check. Building the preview does not change the default palette.
