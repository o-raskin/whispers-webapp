---
name: llm-small-model-friendly-frontend
description: Structure and write React + TypeScript + Vite frontend code for low-context development, so humans and smaller local coding models can understand and modify a feature by reading only a small number of nearby files. Use this skill when designing or refactoring feature structure, boundaries, ownership, and discoverability.
---

# Purpose

Use this skill to keep the frontend easy to work with using limited context.

The code should be understandable not only for human engineers, but also for smaller local coding models that can inspect only a few nearby files at a time.

Optimize for local reasoning.

A reader should be able to open a small set of nearby files and understand:

- what this module does
- where its data comes from
- where state is owned
- where side effects happen
- what can be changed safely
- which files belong to the same concern

Do not rely on full-repository context.

---

# Primary objective

Make the changed frontend area easier to understand in isolation.

Prefer:

- small files
- explicit boundaries
- predictable naming
- local dependencies
- visible data flow
- easy-to-find side effects
- feature-local ownership

Avoid:

- giant mixed-responsibility files
- vague helper dumping grounds
- god components
- god hooks
- clever abstractions that require broad context
- feature logic scattered across distant folders

## Boundary with `frontend-file-decomposition`

Use this skill when the task is broader than one file and the goal is clear ownership across a small nearby file set.

If a single oversized file is the problem, prefer `frontend-file-decomposition`.

---

# Use this skill when

Use this skill when:

- adding new frontend behavior
- refactoring existing frontend code
- splitting large files
- cleaning up `App.tsx`
- extracting components, hooks, adapters, or helpers
- introducing or cleaning up desktop/mobile branches
- preparing code to be maintainable by smaller local models

This skill is especially important when the current code is:

- too long
- hard to scan in one pass
- dependent on too many distant imports
- mixing UI and orchestration
- mixing rendering and side effects
- mixing layout and data transformation
- hard to modify without reading many files first

---

# Core rules

## 1. One file should have one dominant responsibility

A file may coordinate one main concern.
Do not let one file simultaneously own several of these unless the file is still truly small and obvious:

- transport or websocket lifecycle
- state orchestration
- presentational rendering
- desktop/mobile layout branching
- formatting or mapping helpers
- modal or overlay management
- selection or grouping logic

If multiple concerns are present and the file is hard to scan, split it.

## 2. Keep pure logic out of UI-heavy files

Move pure logic out of components when it improves readability.

Typical examples:

- payload mapping
- grouping
- sorting
- filtering
- label/status resolution
- visibility predicates
- derived-state helpers

Pure logic should be easy to test directly and easy to understand without JSX noise.

## 3. Keep side effects easy to locate

Effects, subscriptions, timers, websocket listeners, and transport interactions must be easy to find.

Do not bury side effects inside very large component files or between large JSX blocks.

Prefer either:

- a clearly named orchestration component
- a clearly named stateful hook

## 4. Keep presentational UI separate from orchestration

If a file owns state, effects, subscriptions, transport, or layout switching, keep presentational pieces out of the main file when extraction improves readability.

Do not leave large inline subcomponents or giant JSX branches inside orchestration-heavy files.

## 5. Keep desktop/mobile branching explicit and readable

If desktop and mobile differ meaningfully:

- centralize shared behavior
- keep layout branches readable
- split large layout branches into dedicated layout components when useful
- avoid duplicating business logic across both targets

Do not hide large layout differences inside giant `isMobile ? ... : ...` trees.

## 6. Prefer colocated ownership

Keep feature-specific code near the feature.

Prefer colocated files inside the relevant feature area for:

- feature components
- feature hooks
- feature adapters
- feature types
- feature helpers

Do not move logic to broad shared folders too early.

Only move code to shared when reuse is real and stable.

## 7. Keep names concrete

Names should reveal purpose immediately.

Prefer names like:

- `ChatMessageList`
- `ChatComposer`
- `useChatSession`
- `mapIncomingMessage`
- `buildMessageGroups`

Avoid vague names like:

- `utils`
- `helpers`
- `common`
- `manager`
- `data`
- `process`
- `sharedStuff`

## 8. Do not replace one large problem with another

Do not replace:

- a giant component with a giant hook
- a giant file with many tiny meaningless files
- explicit code with clever indirection
- local clarity with abstract reuse

The goal is not just smaller files.
The goal is easier local reasoning.

---

# Preferred module boundaries

Use the smallest useful decomposition.

Good boundary types:

- component
- hook
- adapter
- formatter
- selector
- layout
- constants
- types

Typical patterns:

## Orchestrator + presentational pieces

- `ChatScreen.tsx`
- `ChatHeader.tsx`
- `ChatMessageList.tsx`
- `ChatComposer.tsx`

## Hook + screen

- `useChatSession.ts`
- `ChatScreen.tsx`

## Layout split

- `ChatDesktopLayout.tsx`
- `ChatMobileLayout.tsx`

## Adapter extraction

- `mapIncomingMessage.ts`
- `mapPresenceUpdate.ts`

## Derived-state helpers

- `buildMessageGroups.ts`
- `getTypingLabel.ts`

Use only what the change actually needs.
Do not decompose mechanically.

---

# Strong decomposition triggers

Split or restructure when one or more of these are true:

- the file is hard to understand in one pass
- the file mixes rendering, state, and effects
- the file has large desktop/mobile branches
- the file has long helper sections above or below JSX
- the file requires reading many distant imports to understand safely
- the file contains several unrelated callbacks or effects
- the same file owns both transport logic and fine-grained UI detail
- tests are hard to write because responsibilities are mixed
- future changes would likely keep appending to the same file

If a reasonable engineer or a smaller local model would struggle to modify the file safely after a quick read, restructure it.

---

# Repo-safe rules

## Prefer local improvement over broad rewrites

Make the smallest structural improvement that meaningfully increases clarity.

Do not perform broad architecture rewrites unless explicitly requested.

## Do not move everything into shared

Do not extract code into global shared folders just because two local files use it.

Prefer feature-local extraction first.

## Do not create generic dumping grounds

Avoid files like:

- `utils.ts`
- `helpers.ts`
- `common.ts`

unless they are very small and tightly scoped.

## Do not introduce unstable abstractions

Do not introduce abstractions whose value depends on future hypothetical reuse.

Wait until the boundary is justified by real clarity or stable reuse.

## Do not break discoverability

After refactoring, a reader should still be able to find the relevant code quickly.

Do not trade readability for clever indirection.

---

# Workflow

## 1. Inspect first

Before editing, inspect:

- the target file
- nearby related files
- existing naming conventions
- current test coverage
- whether the current code is feature-local or shared
- whether desktop/mobile branches exist
- where side effects currently live

## 2. Identify current responsibilities

List the concerns currently mixed in the target area.

Typical concerns:

- orchestration
- side effects
- rendering
- layout branching
- event handlers
- pure mapping
- derived state
- reusable UI sections

## 3. Choose the minimum useful decomposition

Split only as much as needed to make the area easier to reason about locally.

A good result often looks like:

- one orchestrator or screen
- a few focused components
- one or more meaningful hooks if needed
- extracted pure helpers or adapters where useful

## 4. Preserve local ownership

Keep feature-specific code close to the feature.
Do not promote code to shared too early.

## 5. Preserve behavior

Do not change intended behavior unless fixing a confirmed bug.

## 6. Validate

After the structural change:

- run lint
- run relevant tests
- run build when relevant
- validate desktop and mobile separately if UI behavior changed

## 7. Report clearly

Explain:

- what made the area hard to reason about locally
- what responsibilities were separated
- what was intentionally kept local
- what was intentionally not abstracted
- what still remains large or risky

---

# Writing rules

When writing or refactoring code:

- prefer direct code over clever code
- prefer explicit conditionals over dense compactness
- prefer short named helpers over repeated inline logic
- prefer small clear prop contracts
- prefer typed boundaries
- prefer discoverability over abstraction
- prefer predictable imports
- prefer one clear ownership path for state and side effects

A smaller model should be able to follow the main behavior without reconstructing hidden architecture.

---

# Testing implications

A small-model-friendly structure should also be easier to test.

Prefer structures where:

- pure logic can be unit tested directly
- orchestration is covered with integration tests
- presentational components are tested by visible behavior
- desktop and mobile layout can be validated separately when relevant

Do not create structures that force every change through one giant integration test.

---

# Validation

For most changes, run:

`npm run lint`

`npm run test:run`

Also run when relevant:

`npm run build`

If UI behavior or layout changed, validate desktop and mobile separately.

---

# What not to do

Do not:

- keep appending to large root files
- replace one giant file with one giant hook
- spread one behavior across too many files
- hide important logic in vague helpers
- optimize for “smartness” over readability
- create shared abstractions too early
- duplicate business logic across desktop and mobile branches
- require broad repository context for a local change

---

# Completion criteria

A task is complete when:

- the changed area is easier to understand in isolation
- file responsibilities are clearer
- state and side effects are easier to locate
- dependencies are more local and predictable
- the structure is friendlier to smaller local models
- intended behavior is preserved
- validations were run

---

# Output format

For any task using this skill, provide:

## Local reasoning summary
- what made the original area hard to understand locally

## Structural changes
- what files were added, split, or simplified
- what boundaries were introduced

## Ownership decisions
- what stayed feature-local
- what was intentionally not moved to shared
- what was intentionally not abstracted

## Behavior preservation
- what remained unchanged

## Validation
- tests run
- lint/build run
- desktop/mobile validation if relevant

## Remaining weak spots
- files or areas still too large
- any remaining coupling or follow-up opportunities
