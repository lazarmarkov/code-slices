# Code palettes

Pseudocode and TypeScript use the same semantic color roles: keyword, call, type, literal, variable, punctuation, and comment. A selected palette must assign every role and apply the same value to both panes.

Reusable palette definitions live in `src/code-palettes.cjs`. Palette previews tokenize TypeScript with the TypeScript compiler scanner and use lightweight contextual classification for identifiers. This is lexical highlighting; it does not perform type checking.

Quiet ink is the main PR report default. The renderer registers a Pierre theme from the same palette values used by pseudocode, so Pierre retains ownership of line and intra-line diff markup. Building the comparison preview does not change this default.
