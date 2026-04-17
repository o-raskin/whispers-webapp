---
name: frontend-css-architecture
description: Refactor frontend styling so CSS is split by responsibility instead of accumulating in one giant global stylesheet. Use this skill when global.css is oversized, styles are hard to maintain, or desktop/mobile styling needs clearer separation with shared styles kept only where truly global.
---

# Purpose

Use this skill to keep frontend styling maintainable, discoverable, and easy to reason about.

The goal is to prevent styling from collapsing into one giant `global.css` file.

Global CSS should contain only styles that are truly global.
Feature styles, component styles, and desktop/mobile-specific styling should be separated into more local and intentional files.

This skill is especially important when Codex would otherwise keep appending new CSS rules into a massive shared stylesheet.

---

# Primary objective

Do not keep styling in one oversized global stylesheet when responsibilities are mixed.

Prefer a CSS structure where styling is separated by purpose:

- true global base styles
- shared reusable styling primitives
- app-shell or layout styles
- feature-local styles
- component-local styles
- desktop/mobile-specific styling where appropriate

The objective is not to create many random CSS files.
The objective is to make style ownership explicit.

## Boundary with visual and layout skills

This skill decides where styles live and what stays global versus local.

Do not use it as a substitute for visual polish or fluid layout work. Pair it with `frontend-visual-cohesion-and-polish` or `responsive-fluid-layout` only when those concerns are actually present.

---

# Use this skill when

Use this skill when:

- `global.css` is too large
- global styling mixes unrelated concerns
- desktop/mobile styles are tangled together
- feature styles are stored globally without good reason
- component-specific rules are far from the component
- layout styles and UI detail styles are mixed together
- styling is hard to modify without searching through a giant file
- new work keeps appending CSS to the same global stylesheet

This skill is especially important when `global.css` contains:

- reset/base styles
- layout rules
- component rules
- feature-specific rules
- utility-like classes
- mobile overrides
- desktop overrides
- page-specific styling

all in the same file.

---

# Core rules

## 1. Keep global.css truly global

`global.css` should contain only styles that are truly global, such as:

- reset or normalize rules
- base typography defaults
- root color variables or design tokens
- body/html/app-root defaults
- globally shared CSS custom properties
- a minimal set of app-wide element defaults

Do not keep feature-specific or screen-specific styling in `global.css`.

## 2. Separate styles by ownership

Style ownership should follow code ownership when possible.

Prefer separating styles into:

- global base styles
- shared reusable styling
- app-shell/layout styles
- feature-local styles
- component-local styles

A reader should be able to locate a style near the area it affects.

## 3. Separate shared styles from feature styles

Do not move everything into global or shared.

Only keep styles shared if they are:

- genuinely reused
- stable
- discoverable
- not tied to one feature or screen

If a style exists mainly for one feature, keep it near that feature.

## 4. Keep desktop/mobile separation readable

If desktop and mobile differ meaningfully:

- keep shared rules centralized
- separate target-specific styling when it improves clarity
- avoid giant piles of overrides in one file
- avoid mixing unrelated desktop/mobile rules for many components in one stylesheet

If a style block exists only for one target, it should be easy to identify.

## 5. Prefer local styles for local behavior

Component-specific and feature-specific styles should not live globally unless there is a clear reason.

A style that only supports one component or one screen should usually be owned near that component or feature.

## 6. Do not replace one giant file with many meaningless files

Do not split CSS mechanically.

Avoid creating many tiny files with weak ownership or confusing names.

The split should reflect structure and responsibility, not arbitrary line count.

## 7. Keep naming and file purpose obvious

Style files should have clear purpose.

Prefer names that reflect ownership, such as:

- `global.css`
- `app-shell.css`
- `chat-layout.css`
- `ChatComposer.css`
- `message-list.css`
- `mobile-layout.css`
- `desktop-layout.css`

Avoid vague names like:

- `common.css`
- `misc.css`
- `temp.css`
- `extra.css`

unless they are tightly scoped and truly justified.

---

# Preferred CSS structure

Use the smallest useful structure for the project.

A good shape often looks like:

- `src/styles/global.css` → true global base
- `src/styles/tokens.css` → variables/tokens if needed
- `src/styles/app-shell.css` → root layout/app shell if shared
- feature-local style files near their feature
- component-local style files near large styled components
- dedicated desktop/mobile layout style files when those variants are meaningfully different

Do not force all style files into one central folder if ownership becomes less clear.

Prefer colocated styling when it improves discoverability.

---

# Strong decomposition triggers

Refactor and split styling when one or more of these are true:

- `global.css` is hard to scan in one pass
- unrelated sections compete for attention
- feature styles are mixed together
- desktop/mobile overrides are tangled
- one file contains both base styles and detailed component styling
- a small UI change requires searching through many unrelated rules
- styles for one feature are scattered across unrelated sections
- new styling keeps being appended to `global.css`

If a reasonable engineer would hesitate before editing the stylesheet, the CSS structure needs decomposition.

---

# Desktop/mobile style rules

If mobile and desktop styling differ:

- keep shared styles in the common owning file
- isolate target-specific styling when it materially improves readability
- do not duplicate large shared style blocks
- do not create one giant override section for the entire app unless it is very small and obvious

Good examples:

- shared component styles in one file, with a small mobile-specific companion file
- shared layout base plus separate `desktop-layout.css` and `mobile-layout.css`
- feature-level shared styles plus target-specific files only where the divergence is meaningful

The exact split should follow the actual structure of the UI.

---

# Repo-safe rules

## Do not keep appending to global.css

`global.css` must not become a permanent dumping ground for every new style.

Before adding new styles, ask:

- is this truly global?
- is this feature-local?
- is this component-local?
- is this desktop/mobile-specific?
- would colocating this style improve readability?

In non-trivial cases, prefer extraction over appending.

## Do not move everything into global shared styling

Global styling should stay small and intentional.

Do not move local styling into global just because it is easier in the moment.

## Do not over-abstract CSS

Do not invent excessive style layers or CSS architecture complexity with no clear benefit.

Use the simplest structure that gives clear ownership.

## Do not destroy discoverability

After refactoring, a reader should be able to find both the component and its styles quickly.

Do not trade one giant file for a style maze.

---

# Workflow

## 1. Inspect current styling structure

Before editing, inspect:

- `global.css`
- any existing style files
- how styles are imported
- which styles are truly global
- which styles are feature-specific
- which styles are component-specific
- where desktop/mobile divergence exists
- whether the current style ownership is clear or mixed

## 2. Classify current CSS by responsibility

Identify sections such as:

- reset/base
- tokens/variables
- app shell/layout
- feature styles
- component styles
- desktop-specific styling
- mobile-specific styling
- one-off overrides

## 3. Choose the minimum useful split

Do not split mechanically.

A good result often looks like:

- smaller global base stylesheet
- extracted shared layout/app-shell styles if needed
- colocated feature/component styles
- explicit desktop/mobile style separation where it improves clarity

## 4. Preserve behavior

Do not change intended visual behavior unless fixing a confirmed bug.

The goal is primarily to improve:

- maintainability
- ownership clarity
- discoverability
- responsiveness hygiene

## 5. Validate after the split

After refactoring styles:

- run lint if relevant
- run tests if relevant
- run build when relevant
- validate desktop separately
- validate mobile separately

## 6. Report clearly

Explain:

- what was removed from global.css
- what stayed global and why
- what was moved to feature/component ownership
- what was split by target
- what still remains global and why

---

# What should usually stay in global.css

Good candidates:

- reset/base
- design tokens
- root theme variables
- body/html defaults
- base font smoothing / box sizing rules
- minimal app-wide primitives if already part of the repo structure

# What should usually leave global.css

Good candidates for extraction:

- page-specific styling
- feature-specific styling
- chat screen styling
- message list styling
- composer styling
- modal-specific styling
- layout branches for one screen
- mobile-only overrides for one component
- desktop-only rules for one feature

---

# Validation

After style refactoring, validate at least:

- no obvious render regressions
- no missing styling imports
- no broken layout on desktop
- no broken layout on mobile
- no unintended overflow if affected
- no target-specific branch lost in refactor

Run:

`npm run lint`

`npm run test:run`

Also run when relevant:

`npm run build`

If visible UI changed, validate desktop and mobile separately.

---

# What not to do

Do not:

- keep a 3000+ line `global.css` as the default architecture
- move everything into one shared stylesheet
- split CSS into many random files
- create meaningless style file names
- duplicate large shared style blocks across desktop and mobile files
- hide feature ownership behind vague global selectors
- preserve bad structure just because the styles currently work

---

# Completion criteria

A styling refactor is complete when:

- `global.css` is materially smaller and more intentional
- global styles are truly global
- feature/component style ownership is clearer
- desktop/mobile-specific styling is easier to reason about
- intended visual behavior is preserved
- validations were run

---

# Output format

For any task using this skill, provide:

## CSS architecture summary
- what made the previous styling structure hard to maintain

## Structural changes
- what stayed in global.css
- what was extracted
- what files were introduced or reorganized

## Ownership decisions
- what stayed global and why
- what stayed feature-local and why
- what was split into desktop/mobile-specific styling

## Validation
- tests run
- lint/build run
- desktop validation
- mobile validation

## Remaining risks
- any large style areas still needing cleanup
- any places where style ownership is still mixed
