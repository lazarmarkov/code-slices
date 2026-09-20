# Report interactions

These rules govern presentation and interaction, not the meaning of pseudocode or the selected scenario.

- Open the standalone report without Lavish annotation/chat controls.
- Provide one global Pseudocode/Split toggle for all function cards. Remember the selection across refreshes and reopening.
- In split view, put pseudocode on the left and original source on the right. Do not force line alignment between differently sized representations.
- Hovering a mapped line on either side highlights all corresponding ranges in light green. Unmapped lines must not imply a source correspondence.
- References outside the displayed function show clickable source links. Keep the link accessible while the pointer crosses other lines; replace it on another referenced target and clear it on leaving the function card.
- Hold Alt/Option to reveal the second layer of type information globally, without hovering. Release collapses it. Reset on focus loss. Retain the button fallback.
- Keep numbered stage names consistent between the tree and detailed sections. Provide stage navigation and return links. Function-level navigation is intended but not implemented yet.
- Use concrete artifact names, such as telemetry-event-to-closure.call-tree.txt, rather than happy-path.call-tree.txt.
- Keep controls concise. Omit the label "Applies to every function".
- Use the inspected project's visual style. Render code with @pierre/diffs.
- Diagnostics from the full source must be identified as such: return counts are syntactic sites, not execution-path counts; nested returns are separate. Do not present these counts as measurements of the shortened pseudocode.

- Avoid authored line breaks inserted only to fit an earlier pane width. Let the renderer wrap logical lines to the available width.
- Routine tenant/org scope and infrastructure context stay implicit in metadata as well as pseudocode. Omit empty Hidden inputs rows.

- Source references share a sticky bottom footer with the function note and source-call disclosure. Keep that footer visible within the current function card when its natural position falls below the viewport. Showing references must not move the code.

- Display each function's compact Selected path caption as a `▹` comment immediately above its pseudocode signature, in both compact and split views. It is an authored annotation, not an original-source line. Adjust displayed mapping offsets when prepending it.

- Render the ▹ annotation in an italic sans-serif font at the same size as the code, distinct from the monospaced code.

- Keep function signatures on one visual line; allow horizontal scrolling when necessary. The path annotation occupies its own line above the pseudocode signature.

- Omit the Types / models metadata row. Show relevant input/output types in pseudocode signatures, with expanded definitions available in the type layer.
- In split view, align the pseudocode and source signatures on the same horizontal row, accounting for the annotation above pseudocode. Preserve original source line numbers.

- Hovering the ▹ annotation reveals a tooltip explaining that it describes the conditions and outcome followed in the example, with parts of the function not exercised by this example hidden.

- Omit duplicate function-card headings and code-pane filename headers. The signature identifies the function; retain the source-path link above the panes and function names in navigation.

- Hide return/throw-site diagnostic counters from the report, along with their count-specific reading-guide text. Extracted metrics may remain available internally.

- Give Back to call tree links an upward arrow and a visible button-like border to signal navigation up the report.

- Show a yellow dot, hidden percentage, and hidden LoC when more than 30% of nonblank original function lines, excluding complete Logger.log statements, lack a pseudocode source mapping. Compute from the union of mapped ranges, not the ratio of pseudocode/source lengths. Explain in a tooltip that this estimates representation, includes syntax, and is not execution coverage. Broad source mappings can understate omissions.

- Identify excluded Logger.log statements with the TypeScript AST, including multiline arguments. Exclude their lines from both denominator and mapped numerator; retain a line if it also contains other code.

- In split view, hovering a pseudocode reference whose source is outside the visible right pane opens a floating source excerpt over that pane. Include its source location and support references into other functions/files. Do not scroll the reader away or shift the report layout. Allow moving the pointer into the preview; provide close and Escape dismissal. A visible mapped source range needs only the existing highlight.
- Label retained links as Source reference and identify their originating pseudocode statement. A retained reference must not appear to describe whichever unrelated line happens to be highlighted now.
