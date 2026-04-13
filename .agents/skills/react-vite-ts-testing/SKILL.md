---
name: react-vite-ts-testing
description: Write, update, and validate production-grade tests for a React + Vite + TypeScript application using Vitest, React Testing Library, and Playwright. Use this skill when adding features, fixing bugs, increasing coverage, or stabilizing flaky tests.
---

# Purpose

This skill defines how to write and validate tests in a production-like React + Vite + TypeScript codebase.

The goal is not to maximize the raw number of tests. The goal is to create a reliable safety net that catches regressions, validates user-visible behavior, and remains maintainable for a senior engineering team.

---

# Default testing strategy

Use this test pyramid by default:

1. **Unit tests** for pure functions, helpers, formatters, selectors, reducers, mappers, validation logic.
2. **Integration/component tests** for React components, hooks, form flows, async UI states, routing behavior, and module interaction.
3. **End-to-end tests** only for critical user journeys and production-critical regressions.

Prefer the cheapest test that gives enough confidence.

Do not push browser-level concerns into unit tests.
Do not use e2e tests to compensate for weak component architecture.

---

# Stack assumptions

Assume the project uses:

- `vitest` for unit/integration tests
- `@testing-library/react`
- `@testing-library/user-event`
- `playwright` for e2e
- `typescript`
- `eslint`

If the repository uses different tools, first detect and respect the existing stack. Do not introduce a second competing test stack unless explicitly asked.

---

# Operating mode

When asked to write or fix tests, always follow this sequence:

## 1. Inspect first

Before writing tests, inspect:

- `package.json`
- `vite.config.*`
- `vitest.config.*` if present
- `playwright.config.*` if present
- `tsconfig*.json`
- `eslint.config.*`
- existing test directories and naming conventions
- CI config if available

Infer:

- current test runner and assertion style
- test file naming
- mocking style
- coverage rules
- environment setup
- whether the repo already has test utilities, factories, fixtures, or custom render helpers

Never invent a parallel testing style if the repo already has one.

## 2. Identify the correct test scope

Classify the requested change into one or more of these:

- pure logic
- component rendering
- async UI interaction
- API integration boundary
- route/navigation behavior
- browser journey
- regression reproduction

Choose the narrowest effective level.

## 3. Write tests before or alongside the change

For bug fixes:

- reproduce the bug with a failing test first whenever practical
- then implement the fix
- then confirm the test passes

For new features:

- write tests for the observable behavior and acceptance criteria
- avoid asserting implementation details unless there is no better option

## 4. Validate locally

Run the smallest relevant validation first, then expand:

- targeted test file
- nearest related suite
- full unit/integration suite if needed
- type-check
- lint
- production build
- e2e only when the change affects critical flows or browser behavior

---

# Test writing standards

## General

Tests must be:

- deterministic
- readable
- behavior-oriented
- minimal but sufficient
- independent
- easy to debug

Every test should communicate:

- setup
- action
- expected outcome

Use explicit names that describe business behavior, not implementation mechanics.

Good:
- `shows validation error when email is invalid`
- `submits form after all required fields are completed`

Bad:
- `calls setState`
- `works correctly`
- `test modal`

## Structure

Prefer:

- arrange / act / assert
- small local helpers
- shared fixtures only when they reduce duplication without hiding meaning

Avoid deep nesting and excessive indirection.

## Assertions

Assert user-visible behavior first:

- rendered text
- accessible roles/labels
- enabled/disabled state
- loading and error states
- navigation
- callback side effects at public boundaries

Avoid over-asserting internal state, private methods, exact DOM structure, CSS class trivia, or hook internals unless those are the real contract.

## Queries

Prefer accessible and user-facing queries in this order where possible:

1. `getByRole`
2. `getByLabelText`
3. `getByPlaceholderText`
4. `getByText`
5. `getByTestId` only as a last resort

If a component is hard to query semantically, first consider whether the component itself should be improved for accessibility.

## Async behavior

For async UI:

- use async user flows
- await state transitions
- assert loading, success, and failure states when relevant
- do not use arbitrary sleeps or fake delays unless absolutely necessary

Avoid timing-based flakiness.

## Hooks and effects

Be careful with effects, subscriptions, timers, retries, debouncing, and cleanup logic.

When testing code affected by React development behavior, ensure cleanup is correct and the assertions reflect stable contract behavior, not accidental implementation order.

---

# Mocking policy

Mock only true boundaries:

- network
- browser APIs not available in test env
- time
- random values
- storage
- external SDKs
- analytics
- heavyweight modules

Do **not** mock:

- core React behavior
- the unit under test itself
- internal modules just to make assertions easier, unless isolation is the explicit goal

Prefer narrow, explicit mocks over broad global mocking.

When mocking network/API interaction:

- keep fixtures realistic
- include error cases
- verify empty/loading/error/success paths when relevant

---

# Component and integration test rules

Use component/integration tests to verify:

- rendering by props/state
- user interaction
- form validation
- conditional UI branches
- retry and failure paths
- optimistic/pessimistic UI states
- disabled states and spinners
- callback behavior across module boundaries

When testing forms:

- test the way a user fills and submits the form
- do not call submit handlers directly
- include invalid and valid paths

When testing tables/lists:

- verify sorting/filtering/pagination behavior through public UI behavior
- avoid brittle snapshot-style DOM assertions

When testing modals/drawers/dropdowns:

- assert open/close behavior
- focus/keyboard behavior if important
- escape/outside click behavior if it is part of the contract

---

# End-to-end rules

Use Playwright only for critical user journeys such as:

- authentication
- checkout/payment equivalent
- onboarding
- search/filter flows that frequently regress
- routing/navigation flows
- major regression paths involving real browser behavior

E2E tests must:

- use robust locators
- avoid brittle CSS selectors
- avoid sleeps
- keep data setup controlled
- produce actionable failure output

Do not create large, slow “mega tests”.
Prefer short scenario-focused flows.

When appropriate, use page objects or shared helpers, but do not hide important steps behind overly abstract wrappers.

---

# Validation checklist

For any meaningful test-related task, validate in this order where possible:

1. `tsc --noEmit`
2. `eslint .`
3. targeted `vitest` run
4. broader `vitest` run if the change has spillover risk
5. production build
6. `playwright` run for affected journeys

If a command fails, diagnose the real cause before changing code.

Do not “fix tests” by weakening assertions or deleting coverage unless there is a clearly documented reason.

---

# Coverage philosophy

Coverage is a signal, not the goal.

Increase coverage in code that is:

- business critical
- complex
- bug-prone
- changed frequently
- hard to reason about

Do not add shallow tests only to satisfy a percentage threshold.

Prefer meaningful branch and behavior coverage over trivial line coverage.

---

# Snapshots

Avoid snapshots by default.

Use snapshots only when the output is:

- intentionally stable
- large and tedious to assert manually
- reviewed carefully

Never use broad snapshots as a substitute for real behavioral assertions.

---

# Flaky test policy

When a test is flaky:

1. identify whether the issue is:
   - async timing
   - hidden shared state
   - leaked mocks
   - leaked timers
   - environment dependency
   - race condition
   - unstable selector
2. fix the root cause
3. only quarantine or skip as a last resort
4. explain why if a test must remain skipped

Do not normalize flakiness.

---

# Output requirements

When completing a task with this skill, provide:

1. what tests were added/changed
2. what behavior they cover
3. what commands were run
4. whether type-check, lint, build, and tests passed
5. any remaining gaps or risks

If you could not run something, say so explicitly.

---

# Senior-level code review lens for tests

Before finalizing, check:

- Is the test proving behavior that matters?
- Is it too tied to implementation details?
- Is the failure message likely to be understandable?
- Is the setup smaller than the behavior being tested?
- Would another senior engineer trust this test in CI?
- Would this still be maintainable in 6 months?

If the answer is no, revise the test.