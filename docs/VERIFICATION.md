# Verification criteria

The verifier reads the original source, language, slice instructions, generated pseudocode, and authored source mappings. Check omissions as carefully as additions. Do not introduce branches excluded by the selected slice merely to reproduce the complete implementation.

## Calibration

This verifier is currently tuned to avoid false positives: preserving a useful addition matters more than removing every marginally unnecessary detail. It is a source-fidelity reviewer, not a style minimizer. When a comment or detail has a plausible reading benefit and no concrete defect, accept it. A personal preference for a shorter version is not a required correction.

Require evidence for a finding: identify the misleading claim, meaningful omission, incorrect mapping, or clearly redundant information. Do not invent requirements, demand literal source reproduction, or turn every quality guideline into a prohibition. This leniency does not excuse demonstrated errors.

## Source fidelity

- Calls, nesting, inputs, outputs, and execution boundaries must agree with source.
- Preserve meaningful transformations and dependencies. Values used or returned must have an understandable origin; explicitly implicit scope is exempt.
- Retain the source's names unless a documented language shorthand applies. Never silently depict a proposed implementation as existing code.
- Every mapping must target the statement or range it represents. Calls expanded from another function need their own source reference, not a false match in the displayed caller.
- Example outcomes are illustrative, not evidence of an executed test.
- Tree and detailed sections must describe the same flow, stage names, and functions.

## Comments and value annotations

Add a comment only when it supplies information needed to understand the data flow or behavior that the surrounding pseudocode does not already convey. Otherwise omit it.

Evaluate each field or claim independently:

1. What new information does it supply beyond nearby function names, arguments, field accesses, and return values?
2. What operation, transformation, or relationship does that information help the reader understand?
3. Would removing it lose useful context or make that understanding harder? Remove it only when the information is clearly redundant or unrelated; accept uncertain but plausible value.

A concrete example value is useful only when that value explains behavior or a transformation. A placeholder that merely renames a value adds no information. Prefer expressing important transformations in pseudocode over explaining missing operations in comments. Do not copy source comments automatically.

### Calibrated example: omit the envelope annotation

```text
envelope = webhookBody.parse(payload)
// { source: "acmepay", payload: charge }
input = parseAcmePayCharge(envelope.payload, receivedAt)
```

- `source: "acmepay"` duplicates the source identity already conveyed by `parseAcmePayCharge`.
- `payload: charge` duplicates the nesting already conveyed by `envelope.payload`. The placeholder `charge` adds neither structure nor a concrete value.
- Remove the entire comment: neither field contributes information needed to understand this passage.

This rule applies to comments and inline value annotations, including object previews. It does not require explaining every intermediate value.

## Examples that should pass

### A concrete value explains a transformation

```text
tier = SHIPPING_TIER[sourceSpeed] // "express" → PRIORITY
```

Accept: the lookup expression does not expose the table entry. The annotation connects the incoming value to the normalized tier. Do not flag it merely because the source table could be opened elsewhere.

### A value connects distant stages

```text
warehouseRaw = payload.order.warehouse // "wh-lyon"
```

Accept when the slice follows wh-lyon into warehouse lookup and later work: the value helps track the same data across components. It need not affect a branch to be useful. If the exact value is already visible next to this line, assess that local duplication instead of banning example values globally.

### A partial object explains the next consumer

```text
recorded = Order.record(input) → {order, inserted: true, ...}
notifySubscribers(recorded)
```

Accept when insertion state explains notification behavior. The ellipsis deliberately omits unrelated fields; it is not evidence of an incomplete or invalid translation. A selected example value is not a claim that every execution returns true.

### Abbreviation preserves the selected flow

```text
Order.record(input, receivedAt)
```

Accept for an ordinary new Order().record(...) invocation under the language's instance shorthand. Do not demand new, await, logging, query scope, or every fallback simply because they appear in the source. Flag an omission only if it hides a meaningful dependency, transformation, ordering requirement, or outcome in the selected slice.

### A meaningful transformation was lost

If source derives the idempotency key from a normalized, truncated address but pseudocode keys the original address, flag the mismatch: it changes which data determines identity. Request the missing transformation; do not request all unrelated parsing branches.

These examples calibrate judgment, not an exhaustive allowlist. A new useful annotation can pass without matching an example here.

## Verifier result

Return pass only when no required corrections remain. Otherwise return findings identifying the pseudocode location, the violated criterion, source evidence where applicable, and a concrete correction. Distinguish demonstrated defects from uncertainty. Uncertainty about stylistic usefulness should pass. An unresolved source question that prevents assessing material correctness should be reported as unresolved, not asserted as a defect or silently passed. Optional stylistic preferences must not block delivery or force another revision.

## Selected-path captions

Check that each caption is compact, concrete, and supported by the selected flow and source. It should explain the important branch selection without becoming a list of assumptions. Accept different phrasing when it provides useful orientation; do not block on word-count preferences.

`No cached or stored Dispatcher workflow; enqueue succeeds` is useful because it explains why both existing-workflow exits and the failure path are absent. `Registers Dispatcher successfully` adds little beyond the function name and result. Do not demand that every trivial precondition appear in the caption.

A caption selecting one candidate within limits does not justify removing the candidate-selection call that still runs. Review caption accuracy and pseudocode completeness separately.

## Input scope

The tool excludes test and eval files, including their helpers and fixtures. Do not flag missing coverage of these files. Verify that excluded files do not reappear as cards, diffs, index entries, or report evidence.
