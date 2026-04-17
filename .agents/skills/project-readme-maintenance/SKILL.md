---
name: project-readme-maintenance
description: Review and update README.md after meaningful project changes so it stays accurate, concise, onboarding-friendly, and useful for day-to-day development. Use this skill when setup, architecture-relevant behavior, developer workflows, validation commands, environment variables, supported targets, or important constraints have changed and the public project documentation may now be stale.
---

# Purpose

Use this skill to keep `README.md` accurate, high-signal, and pleasant to read.

The README should help a new engineer quickly understand:

- what the project is
- how to run it
- how to validate it
- what important environment or platform assumptions exist
- what changed in a way that now matters for development or maintenance

This skill is for **documentation maintenance after meaningful project changes**.

It is not for decorative rewriting.
It is not for dumping internal notes into public docs.
It is not for turning the README into a large architecture spec.

---

# Primary objective

Keep `README.md` aligned with the current project reality.

Prefer a README that is:

- correct
- concise
- easy to scan
- useful to a new engineer
- useful to a returning engineer
- stable under future project changes
- clear about what matters most

A good README should reduce onboarding friction and prevent documentation drift.

---

# When to use

Use this skill when changes may have affected any of the following:

- local development setup
- install or startup steps
- build behavior
- validation commands
- environment variables
- proxy behavior
- HTTPS or certificates
- supported UI targets or runtime modes
- project structure that matters at a high level
- major feature capabilities that are important to understand
- assumptions needed for local testing
- important developer workflows
- new constraints or caveats that engineers must know

Use this skill after meaningful refactors or infrastructure-related changes when the README may no longer match the codebase.

---

# When not to use

Do not use this skill for:

- minor internal refactors that do not change developer understanding
- implementation details that belong in code comments
- repo rules that belong in `AGENTS.md`
- large architecture discussions that belong in dedicated design docs
- speculative future plans
- noisy changelog-style updates
- one-off debugging notes

If a fact is not useful to most engineers reading the README, it usually does not belong there.

---

# What a good README should do

A good README should answer these questions quickly:

1. What is this project?
2. How do I run it locally?
3. What external dependency or backend assumptions matter?
4. What environment variables or local setup details matter?
5. How do I validate changes?
6. What important constraints or supported targets should I know?
7. What details are important enough to mention without overwhelming the reader?

The README should feel useful within the first minute of reading.

---

# Quality standards

## 1. Accuracy first

Do not leave stale commands, stale env vars, stale workflow notes, or stale behavioral assumptions in the README.

If something changed in reality, the README must reflect it.

## 2. Keep it high-signal

Prefer a smaller, sharper README over a long, noisy one.

Only keep information that helps a developer:

- understand the project
- run the project
- validate the project
- avoid common setup mistakes
- understand important operational assumptions

## 3. Optimize for scanability

Structure the README so a reader can quickly find:

- project summary
- setup
- running locally
- validation
- configuration
- important caveats

Use short sections, clear headings, and direct wording.

## 4. Keep tone professional and calm

Use clear, neutral, professional language.

Avoid:

- hype
- excessive prose
- vague claims
- internal jargon without explanation
- informal “temporary” wording unless it is genuinely necessary

## 5. Explain what matters, not everything

Do not try to mirror the whole codebase in the README.

Only document what has lasting value for most contributors.

## 6. Make the first-run path obvious

A new engineer should quickly understand:

- dependencies to install
- commands to run
- env/config assumptions
- common local development caveats

If the project has a special local requirement, make it easy to find.

---

# README content priorities

Prefer this information hierarchy when relevant:

## 1. Project identity

Explain what the project is in one or two concise lines.

## 2. Local development

Document how to install dependencies and start the app.

## 3. Important runtime assumptions

Document local backend, proxy, HTTPS, certificate, or other meaningful runtime assumptions.

## 4. Environment/configuration

Document only the env vars and configuration details that matter in normal development.

## 5. Validation

Document the main validation commands engineers are expected to run.

## 6. Important constraints or supported modes

Document only the constraints that materially affect development or testing.

## 7. High-level structure only when useful

Include high-level structure notes only if they help engineers orient themselves.
Do not turn the README into a full architecture map.

---

# Update rules

## 1. Review before editing

Before updating `README.md`, inspect:

- current README content
- changed files
- scripts in `package.json`
- current local run/build/test commands
- env vars or config behavior
- any new runtime assumptions introduced by the changes
- whether the README already contains the right section for the new information

Do not add text before confirming the project reality.

## 2. Update only where drift exists

Make targeted updates.

Do not rewrite the entire README if only one section changed.

## 3. Prefer improving structure when needed

If the README is becoming hard to scan, improve section structure while updating it.

Do not preserve a bad structure just to minimize diff size.

## 4. Preserve clarity over wording churn

Do not rewrite stable sections only for style preference.

Change wording when it improves:

- correctness
- clarity
- scanability
- usefulness

## 5. Keep examples realistic

Commands, env vars, paths, and examples must match the actual project.

Do not invent example values that conflict with the repository.

---

# What belongs in README vs elsewhere

## Put in README

Use README for:

- project summary
- install/run steps
- local dev workflow
- important proxy/network assumptions
- important env vars
- validation commands
- high-level constraints that most engineers should know

## Do not put in README

Do not use README for:

- agent-specific repo instructions
- detailed implementation logic
- exhaustive architecture details
- temporary debugging notes
- speculative future ideas
- internal process guidance that is not needed to run or maintain the project

## Put in AGENTS.md instead

Prefer `AGENTS.md` for:

- repo-wide agent behavior rules
- persistent validation requirements for agents
- architectural cautions for code changes
- workflow guidance that should shape future agent runs

---

# Strong update triggers

Update `README.md` when one or more of these are true:

- a developer would run the wrong command using the current README
- a developer would miss an important setup step
- a local environment assumption has changed
- a proxy or backend integration assumption has changed
- validation expectations have changed
- a new supported target or mode matters for development
- the current README no longer reflects the real local workflow
- a meaningful developer-facing caveat now exists and is undocumented

If a new engineer could be misled by the current README, update it.

---

# Style rules

## Keep sections concise

Prefer short sections with clear headings and direct instructions.

## Use code blocks only when useful

Use code blocks for:

- commands
- env examples
- short config examples

Do not overuse them.

## Prefer direct wording

Prefer:

- “Run the app locally”
- “Override the backend origin when needed”
- “Validate changes from the repo root”

Avoid vague or inflated phrasing.

## Keep terminology consistent

Use the same names consistently for:

- scripts
- environment variables
- supported targets
- runtime concepts
- folders or subsystems when mentioned

---

# Repo-safe rules

## Do not over-document

A README should not try to replace code, tests, or design docs.

## Do not duplicate unstable details

Avoid copying details that change frequently unless they are essential.

## Do not add internal-only noise

If a note is useful only during one temporary debugging session, do not add it to README.

## Do not leave misleading brevity

Do not make the README so short that key setup assumptions disappear.

Balance brevity with usefulness.

## Do not add agent-only guidance

README is for engineers and contributors.
Keep agent workflow guidance in `AGENTS.md` or skills, not README.

---

# Workflow

## 1. Inspect project reality

Check:

- `README.md`
- `package.json`
- relevant config files
- changed scripts
- changed env/config behavior
- changed local development assumptions
- changed validation expectations

## 2. Identify documentation drift

Determine exactly what is outdated, missing, misleading, or badly structured.

## 3. Make the smallest useful update

Update only what is needed to keep the README accurate and useful.

Improve structure if necessary, but do not rewrite stable sections without a reason.

## 4. Keep the README readable

After editing, check that the README still feels:

- concise
- professional
- easy to scan
- informative without being noisy

## 5. Report clearly

Explain:

- why the README needed an update
- what sections were changed
- what important project facts were added or corrected
- any documentation gaps that still remain

---

# What not to do

Do not:

- rewrite the README for style alone
- add internal-only process notes
- add speculative future guidance
- turn the README into a changelog
- document every folder and every file
- duplicate `AGENTS.md`
- add stale examples or unverified commands
- leave outdated setup instructions in place

---

# Completion criteria

A README update is complete when:

- the documentation matches the current project reality
- local setup and validation instructions are correct
- important developer-facing assumptions are documented
- the README remains concise and easy to scan
- the update improves clarity without adding noise

---

# Output format

For any task using this skill, provide:

## README review summary
- what was outdated, missing, or misleading

## Documentation updates
- which sections were changed
- what was added, corrected, removed, or clarified

## Why these changes matter
- how the updated README better reflects real project usage

## Remaining gaps
- anything that may still deserve documentation later