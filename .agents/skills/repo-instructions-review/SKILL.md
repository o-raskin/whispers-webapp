---
name: repo-instructions-review
description: Review and improve AGENTS.md so it stays small, practical, high-signal, and aligned with the repository’s real workflows. Use this skill when AGENTS.md may be stale, missing durable repo-wide rules, duplicating skill-level instructions, or failing to prevent repeated Codex mistakes across threads.
---

# Purpose

Use this skill to keep `AGENTS.md` accurate, compact, and effective.

`AGENTS.md` should contain durable repository guidance that Codex should follow every time in this repo.
It should not become a long dumping ground for every workflow, note, or preference.

This skill exists to review and improve repository instructions so future Codex threads start with better defaults and make fewer repeated mistakes.

---

# Primary objective

Keep `AGENTS.md` small, practical, and high-signal.

A good `AGENTS.md` should clearly encode:

- repository identity and important areas
- how to run, lint, test, and validate
- durable engineering constraints
- repo-wide expectations for correctness and completion
- important do-not rules
- when specialized workflows should use repository skills

The objective is not to document everything.
The objective is to preserve the instructions that should apply before every task in this repository.

---

# When to use

Use this skill when one or more of these are true:

- `AGENTS.md` may be stale after project changes
- Codex keeps making the same mistake in this repo
- repo-wide validation expectations changed
- supported targets or major constraints changed
- `AGENTS.md` is growing noisy or repetitive
- instructions that belong in skills have been copied into `AGENTS.md`
- important durable rules are still being repeated manually in prompts
- the repository now has new skills and `AGENTS.md` should guide their use

This skill is especially useful after several iterations of real Codex usage in the repo.

---

# When not to use

Do not use this skill for:

- normal product code changes that do not affect repo-wide agent guidance
- README maintenance
- implementation-specific architecture notes that belong in design docs
- one-off debugging notes
- temporary task instructions
- narrow workflow instructions that belong in a dedicated skill

If the guidance should not apply to most future tasks in this repo, it usually does not belong in `AGENTS.md`.

---

# Quality standards

## 1. Keep AGENTS.md small

`AGENTS.md` should stay concise.

Prefer a shorter file with durable, high-value instructions over a long file that mixes repo rules with task-specific guidance.

## 2. Keep AGENTS.md practical

Every rule in `AGENTS.md` should help Codex behave better across future tasks.

Do not keep vague principles with no effect on execution.

## 3. Put repo-wide rules in AGENTS.md

Keep in `AGENTS.md` the instructions that should apply broadly, such as:

- important directories
- core run/build/test commands
- repo-wide coding and validation rules
- completion expectations
- durable constraints
- which kinds of tasks should use which skills

## 4. Put reusable workflows in skills

If a workflow is specialized, repeated, or too detailed for the main instructions file, it should become or remain a skill.

Do not let `AGENTS.md` duplicate full skill contents.

## 5. Update AGENTS.md from real friction

When Codex makes the same mistake twice, or when you keep repeating the same repo rule manually, capture that guidance in `AGENTS.md` if it is truly repo-wide.

## 6. Keep hierarchy clear

`AGENTS.md` should define:

- broad repo behavior
- validation expectations
- durable constraints
- pointers to skills

It should not become a substitute for README, design docs, or full workflow manuals.

---

# What belongs in AGENTS.md

Good candidates:

- project identity
- supported targets
- key repo areas
- core validation commands
- broad testing rules
- UI validation expectations
- structural code rules that apply repeatedly
- styling rules that apply repeatedly
- documentation rules for README or other repo docs
- skill usage guidance
- completion expectations
- final response expectations

---

# What does not belong in AGENTS.md

Avoid putting these in `AGENTS.md` unless they are extremely short and truly repo-wide:

- long workflow procedures
- full testing playbooks
- full refactor methodology
- detailed CSS architecture guidance
- detailed responsive design guidance
- detailed README-editing instructions
- temporary migration notes
- feature-specific implementation details
- internal debugging logs
- duplicated skill content

These should live in dedicated skills or docs.

---

# Review goals

When reviewing `AGENTS.md`, optimize for:

- correctness
- brevity
- practical usefulness
- repo-wide applicability
- low duplication
- clear routing into skills
- strong completion expectations
- fewer repeated Codex mistakes across threads

---

# Workflow

## 1. Inspect current repository guidance

Review:

- current `AGENTS.md`
- current repository skills
- relevant repository docs such as `README.md`
- current scripts and validation commands
- recent repo constraints that materially affect how Codex should work

## 2. Identify drift and gaps

Look for:

- stale commands
- stale repo assumptions
- missing durable rules
- repeated mistakes not yet captured
- instructions that belong in skills instead of `AGENTS.md`
- duplicate or bloated sections
- missing completion rules
- missing skill routing guidance

## 3. Classify each candidate instruction

For each possible addition or change, decide whether it belongs in:

- `AGENTS.md` as repo-wide durable guidance
- a skill as a reusable specialized workflow
- `README.md` as developer-facing documentation
- another doc entirely

Only keep the instruction in `AGENTS.md` if it should shape most future Codex work in the repo.

## 4. Make the smallest useful update

Do not rewrite `AGENTS.md` for style alone.

Make the smallest update that materially improves:

- clarity
- accuracy
- execution quality
- skill routing
- completion expectations

## 5. Preserve readability

After editing, ensure `AGENTS.md` remains:

- concise
- easy to scan
- easy to trust
- free of unnecessary detail
- clearly separated into repo-wide sections

## 6. Report clearly

Explain:

- what in `AGENTS.md` was stale, missing, duplicated, or noisy
- what was changed
- what was intentionally removed or kept out
- what should remain in skills instead of AGENTS
- any remaining guidance gaps

---

# Strong update triggers

Update `AGENTS.md` when one or more of these are true:

- Codex repeatedly misses the same repo rule
- completion expectations are unclear
- UI validation expectations changed
- supported targets changed
- new repository skills now need routing guidance
- repo-wide structural or styling expectations changed
- `AGENTS.md` is clearly duplicating skill-level instructions
- repo-level instructions are no longer aligned with actual workflow

If future threads would behave worse because `AGENTS.md` stayed unchanged, update it.

---

# Repo-safe rules

## Do not bloat AGENTS.md

If a section becomes long and specialized, move it into a skill and keep only a short routing rule in `AGENTS.md`.

## Do not duplicate README.md

Keep developer-facing setup and onboarding detail in `README.md`.
Keep agent behavior and repo-wide execution rules in `AGENTS.md`.

## Do not document one-off prompts

`AGENTS.md` should not become a collection of manually repeated prompts.

## Do not preserve vague rules

Replace broad or weak advice with sharper instructions only when they affect real execution.

## Do not lose trust

Do not leave stale commands or misleading repo guidance in `AGENTS.md`.

---

# Writing rules

When editing `AGENTS.md`:

- prefer short sections
- prefer direct wording
- prefer imperative guidance
- prefer concrete repo rules
- avoid decorative prose
- avoid repeating what skills already cover in detail
- keep section names obvious
- keep the file easy to scan quickly before a task

---

# Completion criteria

A review is complete when:

- `AGENTS.md` matches the current repository reality
- durable repo-wide rules are present
- unnecessary detail has been removed or kept out
- skill routing is clearer
- the file is concise and high-signal
- future Codex threads are less likely to repeat known mistakes

---

# Output format

For any task using this skill, provide:

## AGENTS review summary
- what was stale, missing, duplicated, or noisy

## Changes made
- which sections were updated, added, reduced, or removed

## Guidance decisions
- what stayed in `AGENTS.md`
- what should remain in skills instead
- what was intentionally not added

## Why this improves future agent runs
- how the update should make Codex more reliable in future threads

## Remaining gaps
- any durable repo-wide guidance still worth adding later