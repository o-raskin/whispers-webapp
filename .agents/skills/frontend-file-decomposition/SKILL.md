---
name: frontend-file-decomposition
description: Decompose an oversized or mixed-responsibility React + TypeScript + Vite frontend file into smaller, readable modules without changing intended behavior. Use this skill when a specific file or screen has become too large, too tangled, or too hard to maintain.
---

# Purpose

Use this skill to prevent and fix oversized, mixed-responsibility frontend files.

The goal is to keep the codebase readable, reviewable, and maintainable for senior engineers working in a production React + TypeScript + Vite application.

Decompose large frontend files into smaller modules with clear responsibilities while preserving intended behavior unless fixing a confirmed bug.

This skill is especially important when Codex would otherwise keep appending new logic into an existing large component, screen, or root file.

---

# Primary objective

Make the changed area easier to scan and reason about in one pass.

Prefer:

- one dominant responsibility per file
- explicit boundaries
- small, clearly named modules
- presentational UI separated from orchestration when useful
- pure logic extracted from UI-heavy files
- feature-local ownership before shared extraction

Avoid:

- giant mixed-purpose files
- giant root components
- giant hooks
- vague helper dumping grounds
- broad rewrites with low value
- abstractions introduced only to reduce line count

---

# Use this skill when

Use this skill when a frontend file is:

- too large
- hard to scan
- mixing UI and business logic
- mixing orchestration and presentational rendering
- effect-heavy
- full of inline handlers and conditionals
- full of large desktop/mobile branches
- full of helper logic that should live elsewhere
- steadily growing because new work keeps being appended

This skill is especially important for:

- `src/app/App.tsx`
- large feature container components
- chat screen components
- layout-heavy files
- files with desktop/mobile branching
- files containing many effects, callbacks, and derived-state blocks

---

# Core rules

## 1. One file should have one dominant responsibility

A file may coordinate one main concern.
Do not let one file simultaneously own several of these unless the file is still truly small and obvious:

- transport or websocket lifecycle
- state orchestration
- presentational rendering
- layout branching
- modal or overlay management
- data transformation
- formatting or mapping helpers
- grouping or selection logic

If the file mixes several concerns and is hard to read, split it.

## 2. Keep pure logic out of UI-heavy files

Move pure logic out of large component files when this improves readability.

Typical examples:

- payload-to-UI mapping
- grouping or sorting
- filtering
- status or label resolution
- visibility predicates
- repeated condition-building
- derived-state helpers

Pure logic should be easy to unit test directly and easy to read without JSX noise.

## 3. Keep orchestration separate from presentational rendering

If a file owns:

- state
- effects
- subscriptions
- websocket events
- API calls
- layout switching

then large presentational sections should not remain inline unless they are truly tiny and local.

Extract focused presentational pieces when that makes the main file easier to reason about.

## 4. Extract hooks only when they encapsulate real stateful behavior

A custom hook is justified when it groups a meaningful unit of behavior such as:

- websocket lifecycle handling
- typing indicator state management
- presence subscriptions
- reusable composer behavior
- derived screen-level state

Do not create hooks only to move lines around.
Do not replace a giant component with a giant hook.

## 5. Keep desktop/mobile branching readable

If desktop and mobile share behavior but differ in layout:

- centralize shared behavior
- keep layout branches readable
- extract layout sections when branches become visually large
- avoid duplicating business logic in both branches

Do not leave giant `isMobile ? ... : ...` trees inside already large files when they obscure the screen logic.

## 6. Prefer feature-local ownership

Keep feature-specific code near the feature.

Prefer feature-local extraction for:

- components
- hooks
- helpers
- adapters
- types

Do not move code into broad shared folders too early.
Move code to shared only when reuse is real, stable, and improves discoverability.

## 7. Keep names concrete

Names should reveal purpose immediately.

Prefer names like:

- `ChatMessageList`
- `ChatComposer`
- `useChatSession`
- `mapIncomingMessage`
- `buildMessageGroups`

Avoid names like:

- `utils`
- `helpers`
- `common`
- `misc`
- `temp`
- `stuff`

---

# Strong decomposition triggers

Split or restructure when one or more of these are true:

- the file is difficult to understand in one pass
- effects, handlers, and rendering are tangled
- the file contains both transport/state logic and detailed UI rendering
- there are large JSX branches for different layouts
- helper logic is embedded above or below rendering
- many callbacks exist only to support local clutter
- tests are hard to write because responsibilities are mixed
- future work would likely keep appending more code into the same file

If a reasonable senior engineer would hesitate before editing the file, it needs decomposition.

---

# Preferred decomposition patterns

Use the smallest useful structure.

## Orchestrator + presentational pieces

Example shape:

- `ChatScreen.tsx`
- `ChatHeader.tsx`
- `ChatMessageList.tsx`
- `ChatComposer.tsx`

## Hook + screen

Example shape:

- `useChatSession.ts`
- `ChatScreen.tsx`

## Pure mapping/helper extraction

Example shape:

- `mapIncomingMessage.ts`
- `buildMessageGroups.ts`
- `presenceLabel.ts`

## Desktop/mobile layout extraction

Example shape:

- `ChatDesktopLayout.tsx`
- `ChatMobileLayout.tsx`

Keep shared behavior outside layout files when possible.

Do not apply all patterns at once.
Use only the minimum decomposition that materially improves readability.

---

# Repo-safe rules

## Prefer local improvement over broad rewrites

Make the smallest structural change that clearly improves readability and ownership.

Do not perform large architecture rewrites unless explicitly requested.

## Do not create generic dumping grounds

Avoid files like:

- `utils.ts`
- `helpers.ts`
- `common.ts`

unless they are very small and tightly scoped.

## Do not extract to shared too early

Do not move code to broad shared folders just because two nearby files use it.

Prefer feature-local reuse first.

## Do not create fake abstractions

Do not split files only to reduce line count.

Bad decomposition includes:

- meaningless wrapper components
- hooks that only rename variables
- abstractions used once with no clarity gain
- excessive indirection that makes behavior harder to trace

## Do not break discoverability

After refactoring, a reader should still find the relevant code quickly.

Do not trade readability for cleverness.

---

# Workflow

## 1. Inspect first

Before editing, inspect:

- the target file
- nearby related files
- existing naming conventions
- current tests in the affected area
- whether the code is feature-local or shared
- where side effects currently live
- whether desktop/mobile branches exist

Do not invent a new local architecture that conflicts with surrounding code unless there is a strong reason.

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

Do not split aggressively.

A good result often looks like:

- one orchestrator or screen
- a few focused components
- one or more meaningful hooks if justified
- extracted pure helpers or adapters where useful

## 4. Preserve local ownership

Keep feature-specific code close to the feature.
Do not promote code to shared too early.

## 5. Preserve behavior

Do not change intended behavior unless fixing a confirmed bug.

The purpose of this refactor is primarily to improve:

- readability
- maintainability
- testability
- local reasoning

## 6. Validate

After the structural change:

- run lint
- run relevant tests
- run build when relevant
- validate desktop and mobile separately if UI behavior changed

## 7. Report clearly

Explain:

- what made the file hard to read
- what responsibilities were separated
- what stayed feature-local
- what was intentionally not abstracted
- what still remains large or risky

---

# Testing implications

When decomposition changes structure:

- preserve behavior-focused tests
- do not rewrite good tests only because file structure changed
- add tests only when extraction exposes meaningful pure logic or new behavioral risk
- keep integration tests for orchestration behavior
- keep presentational tests focused on visible behavior
- avoid snapshot-heavy testing

If `App.tsx` or another orchestration-heavy file changes, update integration coverage where needed.

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

- keep appending code into a giant file because it is convenient
- split purely by line count without responsibility boundaries
- replace one giant file with one giant hook
- create many tiny meaningless files
- move feature logic into vague shared buckets
- introduce abstractions with no clear payoff
- duplicate business logic across desktop and mobile branches
- leave unreadable JSX trees in place when they should be named and extracted

---

# Completion criteria

A decomposition refactor is complete when:

- the affected area is materially easier to read
- file responsibilities are clearer
- intended behavior is preserved
- the resulting structure follows existing repo conventions
- ownership boundaries are more explicit
- tests remain relevant
- validations were run
- desktop/mobile were checked separately if UI behavior was affected

---

# Output format

For any task using this skill, provide:

## Decomposition summary
- which file(s) were too large or mixed
- what made them hard to read

## Structural changes
- what files/components/hooks/helpers were introduced or changed
- what responsibilities were separated

## Ownership decisions
- what stayed feature-local
- what was intentionally not moved to shared
- what was intentionally not abstracted

## Behavior preservation
- what was intentionally kept unchanged

## Validation
- tests run
- lint/build run
- desktop/mobile validation status if relevant

## Remaining risks
- anything still too large
- follow-up extraction opportunities