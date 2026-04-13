# AGENTS.md

This repository is a React + TypeScript + Vite frontend for a realtime chat UI.

## Supported UI targets

This project has two explicitly supported UI targets:
- desktop
- mobile

Treat desktop and mobile as separate supported render contracts.

Do not assume that validating one viewport implicitly validates the other.
Any UI-affecting change must consider both targets separately.

## How to work in this repo

- Make the smallest correct change.
- Preserve external behavior unless fixing a confirmed bug.
- Do not rewrite unrelated code.
- Prefer explicit TypeScript types.
- Do not introduce new dependencies unless strictly necessary.
- Prefer user-visible tests over implementation-detail tests.
- Avoid snapshots.
- Follow existing project conventions before introducing new patterns.
- For non-trivial tasks, inspect first, then change code, then validate.

## Project layout

- `src/app/App.tsx`: main app orchestration, websocket lifecycle, chat state, presence, typing, mobile layout
- `src/features/**/components`: feature UI components
- `src/shared/api`: backend and websocket helpers
- `src/shared/adapters`: payload-to-UI mapping helpers
- `src/shared/utils`: pure utilities
- `src/test/setup.tsx`: shared Vitest / Testing Library test setup

## Commands

Run from the repo root.

Core validation:

```bash
npm run lint
npm run test:run