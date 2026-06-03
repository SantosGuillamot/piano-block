# Prompt: Scaffold a basic Piano block plugin

> Phase 0 artifact — the originating request for this pipeline, adapted for the agents running later phases. It is the single source of truth for what the owner asked. Downstream phases must satisfy the intent captured here or surface evidence that a premise is false — never silently substitute a different goal.
>
> Source: GitHub issue [#1](https://github.com/SantosGuillamot/piano-block/issues/1).

## Goal

Stand up a minimal, installable WordPress plugin that registers a "Piano" block. The block should appear in the block editor with a basic edit view and render on the front end via a server-side `render.php`. This is a scaffold only — a foundation that a future task will build the real piano functionality on.

## Constraints

- Keep it minimal: a basic block `edit` and a basic `render.php`, nothing more.
- The actual piano experience (interactive keys, audio, visual design, input handling) is out of scope for this work and will be implemented in a future task.

## Context

- Greenfield repository: only tooling exists so far — Biome for linting/formatting, pinned to Node 24 LTS. There is no WordPress or block code yet.
- The project uses plain CSS (the current toolchain has no SCSS support).

## Assumptions / directions to explore

These are the owner's current hypotheses, recorded as open. Later phases may confirm or revise them with evidence; they are not requirements.

- A `render.php` implies a dynamic, server-rendered block; the spec/design phases should confirm whether "dynamic" is the right shape for this scaffold.
- A basic `edit` component represents the block on the editor side.
