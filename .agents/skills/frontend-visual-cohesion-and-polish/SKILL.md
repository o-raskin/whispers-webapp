---
name: frontend-visual-cohesion-and-polish
description: Refactor and improve frontend styling so the UI feels visually consistent, cohesive, and attractive without changing product behavior. Use this skill when styles look fragmented, inconsistent, or visually weak, and the interface needs a more unified design language across desktop and mobile.
---

# Purpose

Use this skill to improve the visual consistency, cohesion, and perceived quality of the frontend UI.

The goal is not to redesign the product from scratch.
The goal is to make the existing interface feel more unified, intentional, and attractive.

Use this skill when the UI looks visually fragmented, uneven, or improvised even if it is technically functional.

This skill is especially important when Codex would otherwise make local style changes that solve one area but make the overall interface feel less consistent.

---

# Primary objective

Make the UI feel like one coherent product.

Improve visual consistency across:

- spacing
- sizing
- typography hierarchy
- radius
- shadows
- borders
- color usage
- surfaces
- control states
- layout rhythm
- visual emphasis
- interaction affordances

The result should feel:

- clean
- consistent
- readable
- modern
- intentional
- attractive to users

Do not optimize for novelty.
Optimize for cohesion and quality.

## Boundary with CSS architecture and layout skills

This skill improves visual language and perceived quality, not stylesheet ownership.

If the main problem is `global.css` sprawl or unclear style ownership, prefer `frontend-css-architecture`.
If the main problem is brittle sizing or layout mechanics, prefer `responsive-fluid-layout`.

---

# Use this skill when

Use this skill when:

- the UI looks inconsistent across screens or components
- buttons, inputs, panels, cards, lists, and modals do not feel like the same product
- spacing feels random
- colors are inconsistent or weak
- typography hierarchy is unclear
- surfaces, borders, and shadows are inconsistent
- hover, focus, active, disabled, and selected states feel mismatched
- desktop/mobile variants feel visually disconnected
- local style changes need to be aligned with the rest of the app

This skill is especially important after multiple incremental UI changes by code-focused agents.

---

# Core principles

## 1. Favor consistency over isolated beauty

Do not make one component beautiful at the cost of making the rest of the interface feel inconsistent.

A slightly simpler but consistent UI is better than a visually impressive but fragmented one.

## 2. Use one visual language

The interface should feel like it follows one system.

Keep these aligned across the app:

- spacing rhythm
- typography scale
- corner radius
- surface treatment
- border treatment
- shadow treatment
- emphasis levels
- interaction states

## 3. Improve without redesigning everything

Do not perform a full visual redesign unless explicitly asked.

Prefer refactoring toward a stronger version of the existing style language.

## 4. Respect product behavior

Do not change flows, semantics, or product meaning just to make the UI look cleaner.

Visual polish should preserve intended behavior unless a confirmed UI bug is fixed.

## 5. Keep desktop and mobile visually related

Desktop and mobile may differ in layout, but they should still feel like the same product.

Do not let the two targets drift into different visual systems.

---

# What to improve

## Typography

Improve:

- heading/body/supporting text hierarchy
- consistency of font sizing
- weight usage
- line-height rhythm
- readability of dense areas
- prominence of important labels and actions

Avoid:

- too many unrelated font sizes
- weak hierarchy
- text that competes unnecessarily
- decorative emphasis without semantic meaning

## Spacing

Improve:

- internal component spacing
- spacing between sections
- alignment rhythm
- consistency of gaps and padding
- readable density

Avoid random spacing choices.
Use a small, coherent spacing system.

## Surfaces

Make cards, panels, modals, lists, and input areas feel part of one family.

Align:

- background treatment
- border visibility
- radius
- shadow depth
- contrast between layers

## Controls

Buttons, inputs, tabs, chips, list items, toggles, and interactive rows should feel related.

Align:

- height rhythm
- radius
- typography
- padding
- focus states
- hover states
- active states
- disabled states

## Color and emphasis

Use color intentionally.

Improve:

- consistency of accent usage
- contrast between primary and secondary elements
- readability of muted text
- semantic states such as error, success, selected, disabled
- visual clarity without over-saturation

Do not use color noise as decoration.

## Feedback and states

Loading, empty, selected, focused, hovered, active, unread, typing, and disabled states should feel visually coherent.

State styling should be:

- discoverable
- readable
- consistent
- appropriate to importance

---

# Design-quality rules

## 1. Reduce randomness

If two components perform similar roles, they should not have unrelated styling decisions.

Reduce inconsistency in:

- border radius
- padding
- shadow intensity
- border strength
- text weight
- control height
- state styling

## 2. Build a clear emphasis hierarchy

The UI should clearly communicate:

- primary action
- secondary action
- passive content
- metadata
- supporting information
- selected vs unselected
- active vs inactive

Do not let everything compete equally for attention.

## 3. Prefer subtle polish over flashy styling

Use restrained improvements such as:

- better spacing
- better contrast
- cleaner surfaces
- more consistent radii
- better hover/focus states
- more deliberate grouping

Avoid gratuitous visual effects unless the existing product style already relies on them.

## 4. Keep density intentional

Chat interfaces often have dense information.
Make density feel intentional, not cramped.

Compact is acceptable.
Visually chaotic is not.

## 5. Keep styling maintainable

Do not improve appearance by adding one-off overrides everywhere.

Refactor styles toward more reusable and more consistent visual rules.

---

# Repo-safe rules

## Do not redesign blindly

First inspect the current visual language.
Strengthen and unify it before inventing a new one.

## Do not over-style one area

A polished component that clashes with the rest of the app is not a good result.

## Do not create style debt while polishing

Do not add many one-off magic values, overrides, or exceptions just to make one screen look better.

## Do not separate visual quality from code quality

Visual polish should still respect:

- clear ownership
- maintainable style structure
- desktop/mobile support
- existing component boundaries

## Do not ignore accessibility basics

While polishing the UI, preserve or improve:

- readability
- contrast
- focus visibility
- tap/click affordance
- state clarity

---

# Workflow

## 1. Inspect the current visual language

Before changing styles, inspect:

- typography scale
- spacing rhythm
- button and input treatment
- card/panel/list styling
- modal/drawer styling
- border and shadow usage
- accent color usage
- selected/hover/focus/disabled states
- desktop/mobile visual consistency

## 2. Identify inconsistencies

Look for:

- mismatched radii
- inconsistent spacing
- conflicting surface styles
- weak typography hierarchy
- inconsistent control states
- fragmented color usage
- sections that feel visually disconnected from the app

## 3. Choose the minimum useful polish scope

Do not redesign everything at once.

Apply the smallest cohesive improvement that materially increases visual quality and consistency.

## 4. Refactor styles toward one visual language

Unify:

- spacing tokens or rhythm
- typography hierarchy
- control dimensions and states
- surfaces and borders
- emphasis and contrast

## 5. Validate on both targets

After visual refactoring, validate:

- desktop
- mobile

Check not only correctness, but also whether both targets still feel visually related.

## 6. Report clearly

Explain:

- what visual inconsistencies were fixed
- what style language was strengthened
- what was intentionally left unchanged
- any areas still visually weak or inconsistent

---

# Strong triggers for use

Use this skill when one or more of these are true:

- UI feels assembled rather than designed
- controls look like they belong to different systems
- spacing lacks rhythm
- typography does not create clear hierarchy
- cards/panels/modals feel inconsistent
- selected/hover/focus states vary too much
- desktop and mobile feel visually disconnected
- local refactors are making the design less coherent over time

---

# Validation

When using this skill:

- preserve intended UI behavior
- run lint and tests when relevant
- run build when relevant
- validate desktop separately
- validate mobile separately
- check readability, consistency, and state clarity in both targets

Run:

`npm run lint`

`npm run test:run`

Also run when relevant:

`npm run build`

---

# What not to do

Do not:

- redesign the entire product without being asked
- introduce flashy styling that clashes with the app
- polish one area while making the rest feel older
- add many one-off values or overrides
- reduce contrast or clarity for the sake of minimalism
- make desktop and mobile feel like different products
- sacrifice maintainability for surface-level beauty

---

# Completion criteria

A task using this skill is complete when:

- the UI feels more cohesive and intentional
- key components share a more consistent visual language
- typography, spacing, surfaces, and states are more aligned
- desktop and mobile still feel like the same product
- intended behavior is preserved
- validations were run

---

# Output format

For any task using this skill, provide:

## Visual cohesion summary
- what felt inconsistent or visually weak before

## Styling improvements
- what was unified across the UI
- what components or areas were polished

## Design decisions
- what visual language choices were strengthened
- what was intentionally left unchanged

## Validation
- tests run
- lint/build run
- desktop validation
- mobile validation

## Remaining weak spots
- any areas still visually inconsistent
- follow-up polish opportunities
