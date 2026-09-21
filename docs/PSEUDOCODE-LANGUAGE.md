# Pseudocode language

This is a vocabulary for an LLM translating source into pseudocode, not an executable language or a custom parser specification. Review criteria live in VERIFICATION.md; scenario selection lives in SLICE-INSTRUCTIONS.md.

## Notation

- Spell the boolean type `bool` in signatures and results.
- Omit a parameter or field annotation whose whole type is a primitive (`string`, `number`, `bool`): write `key` for `key: string` and `limit?` for `limit?: number`. Keep unions, arrays, generics, named types and every return type, since those carry information the name does not.
- `-> status(resolved | dismissed | escalated)` lists the enum variants a function may return. It does not test membership.
- `status.in?(resolved, dismissed, escalated)` tests whether `status` equals any listed value. Prefix the predicate with `!` to negate it. A collection may replace the explicit values when the source uses a named collection.
- Predicates end in `?`. A source name such as `isTerminalInvestigationStatus` may appear as the documented pseudocode alias `terminalInvestigationStatus?`. Common source-derived predicates include `empty?`, `blank?`, `finite?`, `array?`, and `record?`.
- `record?(value)` means value is a non-null object and is not an array. `array?(value)` means value is an array. These are notation aliases for the corresponding source guards, not claims that those methods exist at runtime.
- Guard clauses may put the condition after the explicit action: `return [] if hosts.empty?`, `return if !workflow`, and `next if !workflow`. Express negated guards with `if !condition`. A bare value in an `if` guard means present or absent only when the mapped source performs that existence check; it does not import Ruby or JavaScript truthiness.
- `items.map(id)` is field projection: take the `id` field from every item. The field name is not a callback or a runtime method reference.
- `0..1` is an inclusive range. Use a range only when both endpoints are included by the source.
- Keep explicit `return`, explicit call parentheses, and explicit assignment. Do not introduce Ruby implicit returns or implicit calls.
- Calls retain real function names except for documented predicate aliases. Arguments show relevant data; assignments name returned values.
- An arrow after a call denotes its result or result type.
- Indentation in a call tree denotes a caller invoking a child. Nested calls may expand another function's body; mappings identify their actual source location.
- Object previews may show selected fields with an ellipsis for omitted fields.
- Comments and value annotations supply supplementary information. Their usefulness is judged by the verifier.
- Tenant and organization query/write scope is implicit. Original source and expanded types retain it. Organization identity can remain explicit when it is the actual resource being acted on.
- Routine model construction may be abbreviated as Signal.record(...) for new Signal().record(...). This notation does not assert the method is static. Meaningful constructor dependencies remain visible.
- Workflow.enqueue(...) and Workflow.sendMessage(...) are explicit primitives with relevant arguments. Other workflow machinery may be implicit while preserving the data passed across execution boundaries.
- Source mappings accompany pseudocode: a line or range can map to multiple original ranges, or to another function/file. They are authored during translation, not guessed by runtime text matching.
