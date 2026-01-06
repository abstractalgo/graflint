# Composing rules with extensions

Certain rules can only work if there are certain extensions available. It means that rules and extensions are composed together, this is similar to [Lexical Extensions](https://lexical.dev/docs/extensions/intro) for example, in the way you compose-up the extensions together.

# Lint rule-dependant extension of a node extension

Let's say that you have a lint rule for detecting alignment between the edges and suggesting to align them (`visual/nodes-aligned`). We're making an assumption that _there is_ a left and right and a top and bottom edge on every node type, but it's not clear how nodes should be able to express their own edges when node types can also be arbitrary. Even if we allowed for each of the nodes to specify only some of the edges, or maybe none, it's still unclear how a node type that is a completely new extension should be able to do this.

# Concept of "active/current/selected" nodes

It seems that there should be a notion of "current" or "active" or "selected" nodes. Again, as a simple example, let's say that you have this visual nodes aligned rule (`visual/nodes-aligned`). If you don't have something as a base reference point, then for every pair of nodes that's misaligned, you'll get two lint errors, and you can either apply one or the other lint fix, and in one case it moves one node and in the other case it moves the second node. But, if we know which of those nodes is the "selected" one, then we can filter out the rules to only show one diagnostic and thus the action to fix lints will only execute one fixer.

But maybe this is a concern for the app and not for the linter.