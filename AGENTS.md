# AGENTS.md

This repository is a React + TypeScript + Vite frontend for the Whispers realtime chat UI.

## Supported Targets

- desktop
- mobile

Treat desktop and mobile as separate supported render contracts.
Do not treat validating one target as validating the other.

## Core Repo Rules

- Make the smallest correct change that fully solves the task.
- Preserve intended external behavior unless fixing a confirmed bug.
- Inspect first, then change code, then validate.
- Follow existing repo patterns before introducing new ones.
- Prefer explicit TypeScript types and avoid new dependencies unless clearly necessary.
- Prefer user-visible tests over implementation-detail tests.
- Prefer targeted documentation or configuration diffs over broad wording rewrites.
- Do not leave the touched area in a structurally worse state.

## Context Discipline

- Prefer the smallest sufficient context for the task.
- Inspect the directly affected area first before expanding to neighboring files.
- Do not read or refactor broad areas of the repo unless the task or evidence requires it.
- When touching `src/app/App.tsx`, prefer extracting focused app-local hooks or utilities instead of expanding inline auth, websocket, or session orchestration.
- Use repository skills intentionally instead of repeating large workflow instructions manually.
- When updating repo guidance, decide whether the change belongs in `AGENTS.md`, `README.md`, a skill, or `docs/codex/*` before editing.
- For broad or multi-part tasks, use subagents only when the work is clearly parallelizable and the results can be consolidated cleanly.
- For complex tasks, plan first before making large code changes.

## Important Areas

- `src/app/*`: app orchestration, providers, app shell, workspace layout, app-level hooks/utils
- `src/app/testUtils/*`: app-level browser, websocket, and WebRTC test harnesses
- `src/app/styles/*`: shared shell styling and high-impact responsive UI surfaces
- `src/features/*`: feature-local components, hooks, and styles
- `src/shared/api`: backend and websocket helpers
- `src/shared/adapters`: backend-to-UI mapping helpers
- `src/shared/config`: runtime defaults such as backend URL behavior
- `src/shared/utils`: pure shared utilities
- `src/test/setup.tsx`: shared Vitest / Testing Library setup

Changes in app orchestration, websocket lifecycle, app-level styles, adapters, responsive layout branches, or shared UI need broader validation.

## Commands

Run from the repo root.

Core checks:

```bash
npm run lint
npm run test:run
```

Use when relevant:

```bash
npm run build
npm run dev
npm run preview
```

Run `npm run build` for config changes, production-path changes, or meaningful shared frontend changes.

## Testing And Validation

- Update tests when behavior, structure, or important contracts change.
- When changing app orchestration, update the relevant `src/app/App.*.test.tsx` suite or `src/app/components/AppWorkspace.test.tsx` when relevant.
- When changing pure helpers in `src/shared/**` or `src/app/utils/**`, prefer focused unit tests near the source.
- When app-level integration tests accumulate repeated browser fakes or shared flows, extract them into `src/app/testUtils/*` instead of growing one app-level test file.
- Reuse `src/test/setup.tsx` instead of duplicating shared test setup.
- Do not weaken tests just to make a refactor pass.

If a change affects UI, layout, responsive behavior, navigation, forms, dialogs, chat flow, or reusable components:

- validate desktop separately
- validate mobile separately

Do not mark a UI task complete if only one target was validated.

## Documentation

- Keep `README.md` aligned when developer-facing setup, scripts, env behavior, proxy behavior, or validation commands change.
- Keep repo-wide agent behavior in `AGENTS.md`; keep developer-facing setup in `README.md`.

## Skill Routing

Use repository skills when they match the task:

- `react-vite-ts-project-audit-and-refactor`: broader React/Vite/TS audits or structural refactors
- `react-vite-ts-testing`: writing, updating, or repairing tests
- `ui-dual-target-validation`: explicit desktop/mobile UI validation
- `frontend-file-decomposition`: decomposing one oversized frontend file or screen
- `llm-small-model-friendly-frontend`: improving feature ownership and low-context readability across a small nearby file set
- `responsive-fluid-layout`: replacing brittle fixed layout with fluid responsive layout
- `frontend-css-architecture`: moving styles out of oversized global/shared CSS into clearer ownership
- `frontend-visual-cohesion-and-polish`: improving visual consistency without changing product behavior
- `project-readme-maintenance`: README review and maintenance
- `repo-instructions-review`: reviewing and improving `AGENTS.md`

If multiple skills apply, combine them intentionally rather than stretching one skill past its scope.
Pair implementation or refactor skills with `ui-dual-target-validation` when the change affects visible desktop/mobile behavior; the validation skill does not replace the change skill.

## Delegation Guidance

Use subagents only when the work is meaningfully parallelizable, the scopes are explicit, and the added coordination cost is justified.
Prefer independent review and validation streams over tightly coupled editing streams.
For role names, prompt templates, and delegation examples, use `docs/codex/subagent-playbooks.md` as the canonical source instead of duplicating them here.

## Completion Expectations

For non-trivial tasks, do not stop at code edits alone.

A task is complete only after the relevant combination of:

- code changes
- tests updated when needed
- validation run
- desktop validation if UI changed
- mobile validation if UI changed
- README update if developer-facing behavior changed

In the final response, state what changed, what was validated, what was not validated, and any remaining risks or weak spots.
