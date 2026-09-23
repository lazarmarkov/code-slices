# Preparing a PR-change report

`src/prepare-pr.cjs` turns two Git revisions into everything needed to author a PR-change report. It copies the exact changed source files, extracts the changed functions and writes the packets a model reads. It does not call a model and needs no credentials.

## 1. Prepare

```sh
node src/prepare-pr.cjs \
  --repo /path/to/repository \
  --base <base-ref> \
  --head <head-ref> \
  --output /private/output/directory
```

The output directory must be empty or not exist yet. `--title` sets the report title; it defaults to `PR changes <base>..<head>`. Tests, evals, fixtures and helpers are left out before anything is copied.

The output directory then holds:

- `generation-packet.md`: the authoring rules, the imports, types and constants that the changed functions use from their files, and every changed function before and after, with its changed lines marked.
- `verification-packet.md`: the same evidence, with instructions for the verifier.
- `cards.json`: one card per changed function. Only the pseudocode and mapping fields are left to fill in.
- `packet.json`: the extracted evidence and card identities, for the validator.
- `manifest.json`: the manifest for `build-pr.cjs`.
- `source/base` and `source/head`: the exact Git blobs the builder reads.

## 2. Author the cards

Give the model `generation-packet.md` and have it fill in `before`, `after`, `mappingsBefore` and `mappingsAfter` in `cards.json`. See [PR-CHANGE-GENERATION.md](PR-CHANGE-GENERATION.md).

A mapping is one-based, inclusive and relative to the function on the same revision. For example, `{"pseudo":[1,2],"source":[3,7]}` says that pseudocode lines 1 to 2 describe lines 3 to 7 of the function.

## 3. Validate

```sh
node src/validate-pr-cards.cjs /private/output/directory cards.json \
  --repair-output repair-packet.json
```

Relative paths resolve against the prepared directory. The validator checks that:

- every prepared card is present once, no other card is, and `file`, `symbol`, `className` and `status` are unchanged;
- each side that has source has nonempty pseudocode, and each side without source has `null` pseudocode and no mappings;
- every mapping range is valid, and every nonblank pseudocode line is mapped.

It exits 1 when there are errors. It also warns when pseudocode names a scope identifier such as `orgId`, `org_id`, `organizationId` or `tenantId`, because routine tenant scope should stay implicit. A warning alone still exits 0: a reviewer decides whether the identifier is routine scope or the behavior under review.

When there are errors or warnings, `--repair-output` writes a repair packet with only the affected cards, their function evidence, the imports, types and constants they use, and the authoring rules. A model can fix those cards without the rest of the PR.

## 4. Build

```sh
node src/build-pr.cjs /private/output/directory/manifest.json /private/output/directory/report.html
```

The report embeds the source it shows, so keep it wherever the source is allowed to be.
