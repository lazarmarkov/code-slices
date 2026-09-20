# Slice instructions

## Telemetry event to closure

Follow one ingested event through detection, Sentinel, a newly opened Investigation, assessment, Job and Task execution, successful work, and Investigation closure. Select the simplest scenario without an existing Investigation. Do not expand alternative scenario branches or list obvious setup assumptions.

Use code and call orchestration as the primary explanation. Show relevant parameters, returned data, and dependencies across components. Use the same numbered stage names and function names in the tree and detailed sections. Infrastructure is treated as understood except for the explicit workflow primitives defined in the language.

These are instructions for this slice, not universal restrictions of the pseudocode language.

## Selected-path caption

For each displayed function, author one compact `▹` caption above its code. State the conditions or chosen outcome that explain the omitted branches. Prefer one short sentence with concrete domain facts; include only distinctions that matter in this function. Do not list all alternatives or repeat the signature, setup assumptions, or function purpose. Do not force a fixed checklist into every caption.

Examples:

- `No cached or stored Sentinel workflow; enqueue succeeds.`
- `One new, unowned fingerprint; within limits; recent evidence exists.`

The caption describes the selected execution, not every execution of the original function. It must not excuse omitting meaningful operations that still occur on that path.

## PR-scoped documents

A PR document can contain multiple Execution slices. The diff sets the review boundary; each slice remains one selected path. List eligible changed files and functions, link those covered by slices, and explicitly mark the rest as not covered. Review schema and supporting registrations separately rather than forcing them into invented runtime flows. Use actual PR base/head revisions; do not substitute the assembled stack tip. Show absent Before implementations honestly for new APIs. Generate the two pseudocode revisions consistently so wording changes do not imply source changes.
