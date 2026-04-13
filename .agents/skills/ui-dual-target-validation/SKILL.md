---
name: ui-dual-target-validation
description: Validate that both explicitly supported UI targets, desktop and mobile, still render and behave correctly after changes in this React + TypeScript + Vite realtime chat application.
---

# Purpose

This skill validates the two supported UI targets in this repository:

- desktop
- mobile

Treat desktop and mobile as separate supported render contracts.

Do not assume that validating one viewport implicitly validates the other.
Do not mark a task complete if only one target was checked.

---

# When to use

Use this skill when changes may affect:

- `src/app/App.tsx`
- feature UI components in `src/features/**/components`
- reusable shared UI pieces
- chat layout
- responsive behavior
- mobile-specific layout branches
- navigation
- dialogs, drawers, dropdowns
- forms and inputs
- message rendering
- presence / typing indicators
- websocket-driven UI updates
- styling that can affect layout or visibility

This skill is especially important when a task changes:

- conditional rendering
- CSS classes or styling logic
- breakpoints
- flex/grid layout
- scrolling behavior
- overflow behavior
- component composition in chat screens
- event handling that affects visible UI state

---

# Repository context

This repository is a React + TypeScript + Vite frontend for a realtime chat UI.

Important high-risk areas:

- `src/app/App.tsx`: main app orchestration, websocket lifecycle, chat state, presence, typing, mobile layout
- `src/features/**/components`: feature UI components
- `src/shared/adapters`: payload-to-UI mapping helpers that can affect visible rendering
- `src/shared/api`: backend and websocket helpers whose behavior may influence UI state

Prefer to validate the smallest affected surface first, then expand if risk is high.

---

# Validation principles

The goal is not only to see whether tests pass.
The goal is to confirm that both supported UI targets remain usable and visually coherent after a change.

For UI validation:

- validate desktop separately
- validate mobile separately
- focus on user-visible behavior
- check critical paths first
- report uncertainty explicitly
- do not pretend a target was validated if it was only partially checked

When automation is available, use it.
When only partial validation is possible, say exactly what was and was not checked.

---

# Canonical target profiles

Use stable canonical targets rather than every device from a browser device menu.

## Desktop targets

Validate at least one desktop target.
Prefer two when layout changes are broad.

Recommended desktop targets:

- `desktop-default`: around `1440x900`
- `desktop-wide`: around `1728x1117` or `1920x1080`

## Mobile targets

Validate at least one mobile target.
Prefer two when the change affects layout, composer, overlays, navigation, or scrolling.

Recommended mobile targets:

- `mobile-small`: iPhone SE class
- `mobile-modern`: iPhone 12 Pro / Pixel 7 class
- `mobile-large`: iPhone 14 Pro Max class

If the repository already defines concrete viewport names or Playwright projects, use those instead of inventing new ones.

---

# Workflow

## 1. Inspect before validating

Before running checks, inspect:

- `package.json`
- available scripts
- test setup
- whether there is Playwright, Cypress, or another browser test layer
- whether the repo has desktop/mobile-specific helpers or projects
- which files changed
- which routes, components, or flows are affected

Classify the change:

- layout-only
- rendering logic
- responsive branching
- interaction flow
- websocket-driven state update
- reusable component behavior
- route/screen behavior

Then decide how broad the validation must be.

## 2. Identify affected UI surface

Determine what users can actually see or do differently.

Examples:

- chat list changed
- message composer changed
- sidebar or drawer changed
- message item rendering changed
- typing indicator changed
- presence badge changed
- mobile-only header or bottom actions changed
- desktop split layout changed

Prefer validating the directly affected flows first.

## 3. Choose the smallest sufficient validation

Use the smallest validation that gives real confidence.

Possible levels:

- existing unit/integration tests for rendering logic
- targeted component tests
- app-level integration tests
- browser-level smoke checks
- full UI flow checks only if necessary

Do not jump to the broadest or slowest validation automatically.

## 4. Validate desktop

Check desktop separately.

At minimum verify:

- the affected screen renders
- primary controls are visible
- critical actions remain reachable
- there is no obvious layout breakage
- no key content is clipped or overlapping
- no unexpected runtime errors affect the flow

If the change touches chat layout, also verify as relevant:

- multi-column or sidebar behavior
- message list usability
- composer placement
- modal or drawer positioning
- table or panel width behavior
- sticky elements if they exist

## 5. Validate mobile

Check mobile separately.

At minimum verify:

- the affected screen renders
- critical controls are visible and tappable
- there is no unintended horizontal overflow
- navigation or drawer behavior still works
- primary interactions remain reachable
- no key content is hidden off-screen
- no unexpected runtime errors affect the flow

If the change touches chat layout, also verify as relevant:

- single-column layout
- message list scrolling
- composer placement and visibility
- drawer/menu/modal behavior
- long text wrapping
- safe spacing for bottom controls
- mobile-only branches from `App.tsx`

## 6. Expand only if risk requires it

Broaden validation when:

- `src/app/App.tsx` changed
- the change affects shared reusable components
- the change affects layout primitives
- the change affects adapters that influence visible data
- the change affects websocket-driven UI updates
- tests are weak or missing in the affected area
- one failure may cascade into multiple screens

In these cases, validate more than the smallest route/component.

## 7. Report clearly

At the end, report:

- what was checked on desktop
- what was checked on mobile
- what commands were run
- what passed
- what failed
- what was not validated
- any remaining regression risks

Do not hide uncertainty.

---

# Required checks

For UI-affecting changes, validate these conditions as applicable.

## General

- no obvious render breakage
- no unexpected runtime errors in the affected flow
- no missing critical controls
- no broken primary interactions
- loading, error, and empty states still make sense if affected

## Desktop-specific

- layout remains readable at desktop width
- panels, sidebars, and split views remain usable
- content is not clipped unexpectedly
- interactive elements remain reachable
- overlays position correctly

## Mobile-specific

- no unintended horizontal scrolling
- content remains readable in narrow width
- controls remain tappable
- overlays, drawers, and menus remain usable
- bottom or floating controls do not cover important content
- text wraps or truncates acceptably instead of breaking layout

## Chat-specific

When relevant, validate:

- message list renders correctly
- message order and grouping still appear correctly
- composer is visible and usable
- typing and presence indicators render as expected
- websocket-driven updates do not obviously break the visible flow
- mobile and desktop versions both remain coherent for the same chat behavior

---

# Validation commands

Run from the repo root.

For most changes, start with:

```bash
npm run lint
npm run test:run
```

Also run this when relevant:

```bash
npm run build
```

Use `npm run build` when config, build behavior, routing, shared UI behavior, or other production-critical paths may be affected.

If the repository has dedicated browser/UI validation commands, use them.
Prefer existing scripts and projects over inventing one-off commands.

---

# Decision rules

## When validation can stay narrow

Keep validation narrow when:

- the change is isolated
- it affects one local component
- desktop/mobile risk is low
- existing tests already cover most behavior
- there is no shared layout or orchestration impact

## When validation must widen

Widen validation when:

- `App.tsx` changed
- mobile layout logic changed
- shared reusable components changed
- responsive conditions changed
- overlays or navigation changed
- adapters changed visible render data
- websocket lifecycle or UI subscriptions changed
- the same component is used in multiple screens

---

# What not to do

Do not:

- validate only desktop and assume mobile is fine
- validate only mobile and assume desktop is fine
- rely only on implementation-detail unit tests for visible UI changes
- treat a passing lint/test run as full UI validation
- claim a target was validated when it was only reasoned about
- expand validation to unrelated areas without a real reason
- ignore uncertainty when no browser-level validation exists

---

# Completion criteria

A UI-affecting task is not complete until:

- desktop was validated separately
- mobile was validated separately
- relevant tests were run
- lint was run
- build was run when relevant
- the final report states what was verified and what remains uncertain

---

# Output format

For any task using this skill, provide a concise report in this structure:

## Validation scope
- affected files / routes / components
- why desktop/mobile validation was needed

## Desktop validation
- what was checked
- result

## Mobile validation
- what was checked
- result

## Commands run
- exact commands used

## Outcome
- passed / failed items
- unresolved risks
- anything not validated