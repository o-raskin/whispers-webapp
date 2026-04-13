---
name: react-vite-ts-project-audit-and-refactor
description: Audit the current state of a React + Vite + TypeScript project, identify production risks, and perform safe, incremental senior-level refactoring without changing intended behavior unless explicitly requested.
---

# Purpose

This skill defines how to inspect the current health of a React + Vite + TypeScript codebase and refactor it in a production-like way.

The default objective is:

- improve correctness
- improve maintainability
- improve clarity
- reduce risk
- preserve external behavior

Do not do cosmetic rewrites with high churn and low value.

---

# Core principles

Refactor like a senior engineer in a mature product organization:

- respect the current architecture before changing it
- prefer small, reversible steps
- preserve behavior unless the task explicitly includes feature changes
- make the codebase easier to reason about
- validate every non-trivial change
- leave the system safer than you found it

Do not introduce fashionable abstractions without concrete payoff.

---

# Operating sequence

Always follow this sequence.

## 1. Inspect the project state

Start by reviewing:

- `package.json`
- `README*`
- `vite.config.*`
- `tsconfig*.json`
- `eslint.config.*`
- test configs
- build scripts
- environment variable usage
- `src/` structure
- routing structure
- shared utilities
- API client layer
- state management layer
- component composition patterns
- error handling patterns
- loading state patterns
- existing test coverage patterns

Also identify:

- whether strict type-checking is enabled
- whether linting exists and is enforced
- whether build/test/type-check scripts are present
- whether there is dead code, duplicated logic, or over-coupling
- whether the code follows a consistent project structure

## 2. Build a current-state assessment

Classify findings into these buckets:

### A. Correctness risks
Examples:
- unsafe null handling
- stale closures
- effect dependency issues
- race conditions in async logic
- inconsistent API error handling
- incorrect memoization assumptions
- state derived unsafely from props
- broken cleanup logic
- silent type escapes using `any`

### B. Maintainability issues
Examples:
- oversized components
- mixed container/presentational concerns
- duplicated fetch logic
- duplicated form logic
- weak naming
- circular dependencies
- utility dumping ground
- hidden side effects
- deeply nested conditional rendering

### C. Production risks
Examples:
- missing error boundaries
- unhandled promise paths
- environment config drift
- fragile feature flags
- missing loading/error/empty states
- weak validation around external data
- overuse of client-side assumptions about backend shape

### D. Developer-experience issues
Examples:
- missing scripts
- weak lint/type/test integration
- inconsistent folder layout
- unclear import boundaries
- missing shared test utilities
- confusing aliases
- unclear domain naming

## 3. Decide the refactor scope

Refactors should usually be one of:

- local cleanup
- extraction of reusable logic
- component decomposition
- API layer normalization
- state flow simplification
- type hardening
- error-handling standardization
- testability improvement
- performance-sensitive cleanup

Prefer one focused refactor stream at a time.

Do not mix architecture redesign, styling rewrite, state management migration, and folder reorganization in one broad uncontrolled change.

## 4. Refactor incrementally

For each refactor:

1. identify the exact problem
2. explain the intended improvement
3. preserve public behavior
4. make the smallest high-value change
5. validate with tests, lint, type-check, and build
6. document residual risks if the cleanup is partial

---

# What good refactoring looks like

## Preferred outcomes

- smaller components with clearer responsibilities
- better naming
- fewer implicit contracts
- better type boundaries
- clearer async flows
- consolidated repeated logic
- simpler branching
- more explicit error and loading handling
- easier testability
- cleaner public interfaces

## Anti-patterns to remove carefully

- giant “god” components
- helper functions with hidden side effects
- broad prop drilling when composition would be clearer
- repeated fetch/parsing logic
- repeated loading/error UI boilerplate without structure
- `any`, unsafe casts, and non-null assertions used as a shortcut
- boolean prop explosion
- large hooks doing unrelated jobs
- overly coupled UI and data-fetching concerns
- duplicated transformation logic across components

---

# Refactoring standards

## TypeScript

Prefer stronger types over comments.

When improving types:

- reduce `any`
- reduce unsafe `as` casting
- model nullable states explicitly
- make impossible states harder to represent
- move repeated ad hoc object shapes into named types when it improves clarity
- use discriminated unions when async/state branches benefit from them

Do not create type abstractions that are more complex than the domain.

## React

Keep components focused.

Prefer extraction when a component is doing multiple distinct jobs:
- data loading
- state orchestration
- rendering
- form handling
- transformation logic
- browser/event integration

Prefer custom hooks only when they encapsulate meaningful reusable behavior.
Do not create hooks just to move code around.

Be careful with:
- `useEffect`
- dependency arrays
- stale closures
- unnecessary `useMemo` / `useCallback`
- derived state stored redundantly
- uncontrolled re-renders caused by unstable props

Remove memoization that adds complexity without measurable benefit.

## State and async flows

Refactor async logic toward:

- explicit request states
- centralized API error mapping where useful
- cancellation/ignore-stale-result behavior where needed
- predictable retries if present
- stable loading/error/empty/success branches

Avoid scattered async side effects across many components when a single boundary would be clearer.

## API layer

When the codebase mixes raw fetch/client logic into UI code, prefer:

- central API client or service module
- response parsing at the boundary
- typed DTO/domain mapping where useful
- consistent error handling
- consistent auth/header handling

Do not leak transport-specific details deeply into the component tree.

## Files and modules

Prefer modules with a single clear responsibility.

Good reasons to split files:
- too many unrelated exports
- mixed public/private concerns
- unreadable length
- domain boundaries are blurred

Do not split aggressively into tiny files if it harms discoverability.

---

# Performance policy

Do not perform speculative micro-optimizations.

Only refactor for performance when there is evidence or a clear high-risk pattern, such as:

- expensive repeated computation during render
- avoidable rerenders in large trees
- unstable list keys
- unnecessary broad context updates
- inefficient filtering/mapping on hot paths
- excessive effect churn

When making performance-related refactors:

- preserve readability
- avoid cargo-cult memoization
- explain the tradeoff

---

# Safety rules

## Behavior preservation

Unless explicitly asked for product changes:

- preserve UI behavior
- preserve API contracts
- preserve route behavior
- preserve event semantics
- preserve analytics hooks if they are part of production behavior

If behavior must change to fix a defect, state it clearly.

## Validation

After non-trivial refactoring, run as many as available:

- `tsc --noEmit`
- `eslint .`
- relevant tests
- full test suite if impact is broad
- production build

If e2e tests exist and the refactor affects user journeys, run relevant e2e coverage too.

## Change size

Prefer small PR-shaped changes.

If the requested cleanup is large, break it conceptually into phases:
1. safety/typing/tests
2. structural cleanup
3. optional follow-up improvements

Even if working in one session, keep the edits logically staged.

---

# Required audit output

When asked to assess the project, provide findings in this format:

## Project state summary
A concise summary of the current health of the codebase.

## High-priority risks
Only the issues most likely to cause bugs, regressions, or maintenance pain.

## Refactor opportunities
Specific, high-value improvements ranked by impact and risk.

## Recommended next steps
A pragmatic sequence, not an idealized rewrite plan.

Do not overwhelm with low-value nitpicks.

---

# Required refactor output

When asked to refactor, provide:

1. what was changed
2. why it was changed
3. what behavior was intentionally preserved
4. what validations were run
5. whether lint/type-check/tests/build passed
6. any remaining technical debt or follow-up suggestions

Be explicit about anything not verified.

---

# Senior-level decision rules

Before finalizing a refactor, ask:

- Did this reduce cognitive load?
- Did this reduce coupling?
- Did this improve correctness or maintainability in a concrete way?
- Did this keep the code aligned with existing project conventions?
- Is the abstraction justified by repeated use or domain meaning?
- Is the change small enough to review confidently?

If not, simplify.

---

# What not to do

Do not:

- rewrite large areas for style preference only
- switch libraries without explicit approval
- replace working patterns with trend-driven architecture
- introduce indirection just to look “clean”
- hide uncertainty
- claim a refactor is safe without validation
- delete tests to make refactoring easier
- weaken types or lint rules to suppress real issues

The standard is production-ready, reviewable, low-risk engineering.