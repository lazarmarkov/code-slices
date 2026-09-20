# Lower-cost PR preparation

The deterministic preparer resolves two local Git revisions, copies exact changed production blobs, extracts changed functions, and builds compact generation and verification packets. It does not call a model or require credentials.

```sh
node src/prepare-pr.cjs \
  --repo /path/to/repository \
  --base <base-ref> \
  --head <head-ref> \
  --output /private/output/directory
```

The output directory must be empty. The preparer excludes tests, evals, fixtures, helpers, test helpers, and matching filename variants before copying source or forming evidence.

Outputs:

- `generation-packet.md`: concise instructions, referenced file-level contracts, and numbered before/after functions with exact changed-line markers.
- `cards.json`: builder-compatible card skeleton. The model edits only pseudocode and mappings.
- `verification-packet.md`: verifier instructions with the same pinned evidence.
- `packet.json`: machine-readable extracted evidence and card identity.
- `manifest.json`: ready for `build-pr.cjs` after cards are authored.
- `source/base` and `source/head`: exact Git blobs used by the builder.

Validate authored cards before building:

```sh
node src/validate-pr-cards.cjs /private/output/directory cards.json \
  --repair-output /private/output/directory/repair-packet.json
```

Validation checks card identity, added and removed sides, nonempty full-function pseudocode, bounded range validity, and mapping coverage for every nonblank pseudocode line. Known scope-only fields such as `orgId`, `org_id`, `organizationId`, and `tenantId` produce actionable warnings because those identifiers may instead describe meaningful application behavior.

When errors or scope warnings exist, `--repair-output` writes a compact packet containing only affected cards, their exact function evidence, referenced contracts, current authored content, and the same authoring rules used by the initial packet. This supports a focused repair pass without resending unrelated functions or reading implementation files. The validator still exits successfully for scope warnings alone; a reviewer must decide whether each identifier is routine ORM scope or meaningful behavior.

A mapping is one-based, inclusive, and side-specific. For example, `{"pseudo":[1,2],"source":[3,7]}` says that pseudocode lines 1 through 2 describe function-relative source lines 3 through 7 on the same revision.
