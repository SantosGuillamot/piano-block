# AGENTS.md

Guidance for AI agents (and other automated contributors) working in this repository.

- **Keep the development workflow out of shipped artifacts.** This project is built with an internal, multi-phase pipeline workflow whose artifacts (specs, design docs, plans, and review notes) live under `.rp/`. Do not reference that workflow — or cite its artifacts (e.g. `design §X`, acceptance criteria `AC#`, plan tasks `T#`, "review N") — in source code, comments, or user-facing docs. Confine all such references to `.rp/`; the shipped code and docs should read as a standalone project.
