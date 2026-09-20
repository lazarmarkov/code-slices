# Pseudocode generation and verification

## Generator role

Inputs: original source with a pinned revision, PSEUDOCODE-LANGUAGE.md, and SLICE-INSTRUCTIONS.md.

Produce pseudocode and its source mappings together. Aim for a concise, faithful explanation of the selected flow: preserve meaningful data transformations and dependencies, and avoid redundant explanation. The generator has freedom over presentation within the language and slice; it need not carry the verifier's full checklist.

## Verifier role

Inputs: the same original source, language, and slice instructions, plus the generated pseudocode, mappings, and VERIFICATION.md.

The verifier is deliberately biased against false positives: preserve plausibly useful detail and require a concrete reason for corrections.

Return pass or actionable findings. Use source evidence rather than assuming that plausible pseudocode is faithful. Check both unnecessary content and missing behavior.

## Revision loop

1. Generate pseudocode and mappings.
2. Verify against source and criteria.
3. On pass, deliver the verified result.
4. Otherwise feed findings back to the generator, revise pseudocode and affected mappings, and verify again.

If source evidence is missing or the roles cannot resolve a finding, report the unresolved issue rather than treating it as success. Rendering and interaction checks remain separate from semantic verification.

## Status

This document defines the adopted role contract. The current report is an authored prototype; an automated two-role runner has not been implemented.
