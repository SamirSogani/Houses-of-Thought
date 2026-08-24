// The handful of console contract values that BOTH the doc-28 core
// (console.ts) and a later phase's module need, extracted here so neither has
// to import the other. Without it CONSOLE_MESSAGE_MAX (used by Loop A's
// ReviseRequestSchema, console-loops.ts) and ReviseCritique (used by
// ConsoleTurn, console.ts) form a genuine import cycle between the two.
// Same role, and the same reason, as router-shared.ts plays for the router
// split.

// Double layer-feedback's message cap (LAYER_FEEDBACK_MESSAGE_MAX, 500) —
// still a chat turn, not an essay, but a whole-house correction can need more
// room than a single-layer one.
export const CONSOLE_MESSAGE_MAX = 1000
