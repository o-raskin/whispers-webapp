# Codex Subagent Playbooks

This file contains reusable delegation templates for larger tasks in this repository.

Use these playbooks only when the work can be split into independent review or validation streams and then consolidated cleanly.
Do not use subagents by default for small or straightforward changes.

---

## When to use subagents in this repo

Good cases:

- separate desktop and mobile UI validation
- broad frontend refactors with independent structural review
- large styling changes where CSS ownership and visual consistency can be reviewed separately
- large test updates where structure review and test-gap review can run in parallel
- repository guidance audits where `AGENTS.md`, `README.md`, skills, and playbooks can be reviewed separately

Avoid subagents when:

- the task is small
- the code is tightly coupled and requires constant shared context
- the work cannot be split cleanly
- the cost of coordination is higher than the likely quality gain

---

## Playbook 1: Large frontend refactor

Use when:
- a large frontend area needs refactoring
- multiple files or layers are involved
- structure, tests, and UI validation all matter

Suggested orchestration prompt:

```text
Audit and refactor this frontend area.

Delegate in parallel to:
1. a frontend structure reviewer subagent,
2. a desktop UI validator subagent,
3. a mobile UI validator subagent.

If the change is broad enough, also delegate to:
4. a test-gap reviewer subagent.

Then consolidate the findings, perform the refactor, update tests as needed, run validation, and report:
- structural problems found
- refactor decisions
- tests updated
- desktop validation result
- mobile validation result
- remaining risks
```

Recommended skill alignment:
- frontend structure reviewer:
  - use `frontend-file-decomposition` when one oversized file or screen is the main problem
  - use `llm-small-model-friendly-frontend` when ownership across a small nearby file set is the problem
  - use `react-vite-ts-project-audit-and-refactor` when the reviewer is auditing broader cross-layer risk or refactor scope
- desktop/mobile validators:
  - `ui-dual-target-validation`
- test-gap reviewer:
  - `react-vite-ts-testing`

---

## Playbook 2: Parallel desktop/mobile UI validation

Use when:
- the task is mainly UI-facing
- layout or interaction changed
- desktop and mobile both need explicit checking

Suggested orchestration prompt:

```text
Review this UI change and validate both supported targets separately.

Delegate in parallel to:
1. a desktop UI validator subagent,
2. a mobile UI validator subagent.

Then consolidate the results and report:
- what was checked on desktop
- what was checked on mobile
- failures or regressions found
- any remaining uncertainty
```

Recommended skill alignment:
- both validators:
  - `ui-dual-target-validation`

---

## Playbook 3: CSS and styling refactor

Use when:
- styling changes are broad
- global.css or shared CSS ownership is messy
- responsive behavior and visual cohesion both matter

Suggested orchestration prompt:

```text
Audit and refactor the styling for this frontend area.

Delegate in parallel to:
1. a CSS architecture reviewer subagent,
2. a visual cohesion reviewer subagent,
3. a desktop UI validator subagent if the change is UI-visible,
4. a mobile UI validator subagent if the change is UI-visible.

Then consolidate the findings, apply the styling refactor, validate desktop and mobile, and report:
- CSS ownership decisions
- what stayed global vs local
- responsive/layout fixes
- visual consistency improvements
- remaining styling risks
```

Recommended skill alignment:
- CSS architecture reviewer:
  - `frontend-css-architecture`
- visual cohesion reviewer:
  - `frontend-visual-cohesion-and-polish`
- layout validators:
  - `ui-dual-target-validation`
  - `responsive-fluid-layout`

---

## Playbook 4: Broad test refresh after refactor

Use when:
- a structural refactor already happened
- tests need review and repair across multiple levels

Suggested orchestration prompt:

```text
Review the affected tests after this refactor.

Delegate in parallel to:
1. a test-gap reviewer subagent,
2. a desktop UI validator subagent if the refactor affected visible behavior,
3. a mobile UI validator subagent if the refactor affected visible behavior.

Then update tests as needed, run validation, and report:
- which tests were added or updated
- what behavior is now covered
- what remains weakly covered
- desktop/mobile validation status
```

Recommended skill alignment:
- test-gap reviewer:
  - `react-vite-ts-testing`
- UI validators:
  - `ui-dual-target-validation`

---

## Playbook 5: Repository guidance audit

Use when:
- `AGENTS.md`, `README.md`, skills, or delegation docs may have drifted
- the repo needs tighter Codex guidance with minimal churn
- the work benefits from independent review streams before editing

Suggested orchestration prompt:

```text
Audit this repository's Codex-facing guidance and apply only the worthwhile improvements.

Delegate in parallel to:
1. a repo instructions reviewer subagent,
2. a README/docs reviewer subagent,
3. a skill-set reviewer subagent.

Then consolidate the findings, update the repository guidance directly, and report:
- what changed in AGENTS.md
- what changed in README.md or docs/codex
- what skill boundaries were tightened
- what was intentionally left unchanged
- what would be overengineering right now
```

Recommended skill alignment:
- repo instructions reviewer:
  - `repo-instructions-review`
- README/docs reviewer:
  - `project-readme-maintenance`
- skill-set reviewer:
  - review the relevant repository skills directly

---

## Suggested subagent roles

Use consistent role names in prompts when helpful:

- `frontend structure reviewer`
- `desktop UI validator`
- `mobile UI validator`
- `test-gap reviewer`
- `CSS architecture reviewer`
- `visual cohesion reviewer`
- `repo instructions reviewer`
- `README/docs reviewer`
- `skill-set reviewer`

These do not need their own repository files unless the team starts using them heavily and wants stable agent-specific prompts or model configs.

---

## Practical rules

- Use subagents only when the task can be split cleanly.
- Keep delegated scopes explicit.
- Prefer independent review and validation streams over tightly coupled editing streams.
- Consolidate results centrally before final code changes are considered complete.
- Do not claim desktop/mobile validation unless both were checked separately.
- Do not use subagents for trivial tasks.
