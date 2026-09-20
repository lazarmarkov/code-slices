# Pseudocode language

This is a vocabulary for an LLM translating source into pseudocode, not an executable language or a custom parser specification. Review criteria live in VERIFICATION.md; scenario selection lives in SLICE-INSTRUCTIONS.md.

## Notation

- Calls retain real function names. Arguments show relevant data; assignments name returned values.
- An arrow after a call denotes its result or result type.
- Indentation in a call tree denotes a caller invoking a child. Nested calls may expand another function's body; mappings identify their actual source location.
- Object previews may show selected fields with an ellipsis for omitted fields.
- Comments and value annotations supply supplementary information. Their usefulness is judged by the verifier.
- Tenant and organization query/write scope is implicit. Original source and expanded types retain it. Organization identity can remain explicit when it is the actual resource being acted on.
- Routine model construction may be abbreviated as Signal.record(...) for new Signal().record(...). This notation does not assert the method is static. Meaningful constructor dependencies remain visible.
- Workflow.enqueue(...) and Workflow.sendMessage(...) are explicit primitives with relevant arguments. Other workflow machinery may be implicit while preserving the data passed across execution boundaries.
- Source mappings accompany pseudocode: a line or range can map to multiple original ranges, or to another function/file. They are authored during translation, not guessed by runtime text matching.
