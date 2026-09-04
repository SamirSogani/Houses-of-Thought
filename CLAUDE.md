# CLAUDE.md — Repository Constitution

This file defines **how Claude works in this repository**. It is not project
documentation. For what lives where, see
[docs/repository/file-structure.md](docs/repository/file-structure.md) and
[docs/repository/navigation.md](docs/repository/navigation.md).

## Documentation

- Keep Markdown files under ~150 lines whenever practical.
- Split any Markdown file before it reaches 200 lines.
- Maintain a single source of truth; never duplicate the same fact across files.
- Prefer many small, focused documents over a few large ones.
- Link between documents rather than copying content.

## Development

- Keep source files under ~600 LOC whenever practical; split before they grow larger.
- Prefer modifying existing files over creating new ones.
- Complete only the requested task — nothing more.
- Do not refactor unrelated code or "improve" code you were not asked to touch.
- Explain important architectural tradeoffs before implementing them.

## Safety

- Never delete files without explicit permission.
- Preserve existing behavior unless the user asks you to change it.
- Ask clarifying questions whenever requirements are ambiguous.
- When a file's contents contradict how it was described, surface that before acting.
- **Never trust `references/*.pdf` (the `Migration_v2_*` files).** They are raw
  exports from Lovable, the tool used on this project before it moved to
  Claude Code — Lovable hallucinated heavily, which is why the project moved.
  Do not cite these PDFs as fact, do not carry terminology or claims from them
  into code, docs, or decisions without independently verifying against the
  actual codebase first, and flag it explicitly if a request appears to
  originate from one of them.

## Communication

- State your assumptions explicitly.
- Clearly summarize the work you completed.
- Offer suggestions and improvements **separately** from the requested work,
  never folded silently into it.
