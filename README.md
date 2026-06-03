# Piano Block

A (planned) WordPress block for creating piano song sheets — write out notes to build practice sheets you can use to learn and train piano skills.

> **Status:** Just initialized. There is no implementation yet — this repo currently contains only the project tooling.

## Requirements

- [Node.js 24 LTS](https://nodejs.org/) — an `.nvmrc` is provided, so run `nvm use`
- npm 11+

## Tooling

- [Biome](https://biomejs.dev/) — formatting and linting (single tool, single config).

## Getting started

```bash
nvm use      # selects Node 24 (see .nvmrc)
npm install  # installs dev dependencies (Biome)
```

## Scripts

- `npm run lint` — lint the codebase with Biome.
- `npm run format` — format the codebase with Biome.
- `npm run check` — run Biome's combined lint + format with autofix.
