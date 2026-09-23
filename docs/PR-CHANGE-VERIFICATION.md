# PR-change verification

Verify the authored cards against both pinned source snapshots before building the report.

## Function completeness

- Before and after pseudocode describe the complete extracted function on each existing side.
- Meaningful branches, calls, transformations, fallbacks and return values are present.
- Added functions have no before translation. Removed functions have no after translation.
- No scenario assumption or selected-path caption narrows the function.

## Source fidelity

- Every operation and claim is supported by source.
- A refactor is not described as a behavior change unless the source supports that conclusion.
- Each mapping targets the declaration or statement represented by its pseudocode line.
- Function-relative ranges are valid on their respective revisions.
- Shared and overlapping source ranges do not imply that unrelated pseudocode lines changed.
- `status(a | b)` appears only as a return-value variant declaration; membership checks use `.in?`.
- Predicate aliases, `if` guards, field projections and ranges preserve the mapped source semantics without claiming runtime APIs.
- Returns and call parentheses remain explicit, and existence guards do not broaden into generic truthiness.
- Routine ORM organization or tenant scope stays implicit. Validator warnings for known scope identifiers require review because organization identity can be meaningful application behavior.

## Change grounding

Inspect the built report as well as the JSON:

- A pseudocode addition or removal receives `+` or `-` only when its mapping intersects an actual added or deleted source line.
- Identical pseudocode receives `~` when its mapped source changed.
- A wording-only pseudocode change over unchanged source has no change marker or change color.
- On a modified function, a line whose mapped changes are all in the declaration shows a `signature` badge. A line with mapped body changes is called `implementation` in its tooltip.
- Removed functions remain visible.

## Coverage and privacy

- Changed functions without cards are named under Remaining source changes, and their exact file diff opens there.
- A change outside every extracted function, even on a line it shares with one, also lists its file there.
- Test, eval, fixture and test-helper paths do not appear in cards, diffs, indexes or evidence.
- The output remains at the requested private location when its source is private.
