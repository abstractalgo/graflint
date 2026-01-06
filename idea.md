# Initial proposal

Similar to how regular code linters traverse AST, output diagnostics and even do automatic changes to fix it, I see the potential for "linters for OCIF", and they could then be used to offer various "functionality" - guides for alignment of the nodes, parent-child relations, loop detections and highlighting,...

While the structure of such behavior can be modeled as a pure function (output_canvas = lint(input_canvas)), I like to think about it from the POV of linters as it may potentially overlay its "diagnostics" on top of the existing canvas etc, and not just necessarily merge it with the input canvas content; or even have several different "diagnostics layers" that can be stacked on top of each other.

Another advantage of the canvas format being very rich and extensible is that the output of linters for it can similarly be very rich (in contrast to code lint diagnostics mostly being about just a start and end position in the text (or AST node) and a diagnostics message), a linter for OCIF could output all kinds of useful visual guides/lines, messages and elements.

# Replies

Reply #1:

This is a cool idea. We had thought about a validator, which would also list errors.
However, our current validator only does JSON Schema validation, no structural checks beyond that.
Furthermore, we never had the idea to show errors in the canvas itself (within an OCIF file). Neat!

A particular case we did think about is a "generic merge". Use case: App A exports OCIF. App B reads it, discards all elements it does not know (it should not do this, but some apps will do this. Or another external converter converts OCIF to app-B-format, which has no extension semantics.). So then app B loads the data, user edits it, and stores back as app-b-native format. Then either an external converter or a plugin within app-B brings it back into OCIF shape.
Now we have before.ocif.json (went into app B) and after.ocif.json (came out of app B).
Challenge: Compare both files, understand the diff (which elements have been added/deleted/edited?). Then, apply the diff back to the before.ocif.json, so that the extension data of all nodes, which have not been deleted, are still there.
I guess, in this process lots of things can go wrong which also would benefit from displaying stuff as a canvas, e.g. the computed diff?
Yeah, maybe a visual diff would be a cool special case of linter.

Reply #2:

You can get diff, linter, etc for free with a treesitter grammar. Difftastic and mergiraf supports it and there's a whole ecosystem of IDEs and tools for it.