---
name: responsive-fluid-layout
description: Build responsive React frontend layouts using fluid and relative sizing instead of fixed pixel-based layout values. Use this skill when creating or refactoring UI so it scales correctly across desktop and mobile resolutions and avoids brittle fixed-size rendering.
---

# Purpose

Use this skill to keep frontend layout responsive, scalable, and resolution-independent.

The goal is to avoid brittle UI that only looks correct at one screen size.

Prefer layout and spacing that adapts across supported desktop and mobile targets.

This skill is especially important when Codex would otherwise hardcode widths, heights, gaps, padding, font sizes, or positioning in fixed pixels.

---

# Primary objective

Do not use fixed pixel values as the default solution for layout.

Prefer fluid and relative sizing so the UI:

- adapts to different viewport sizes
- scales more naturally across desktop and mobile
- avoids overflow and clipping
- remains readable on narrow and wide screens
- is easier to maintain than pixel-tuned layouts

The objective is not to eliminate `px` completely.
The objective is to avoid pixel-dependent layout design.

## Boundary with other styling skills

Use this skill for layout mechanics and fluid sizing.

Do not use it to reorganize CSS ownership or to do purely visual polish. Prefer `frontend-css-architecture` for style ownership and `frontend-visual-cohesion-and-polish` for visual consistency work.

---

# Use this skill when

Use this skill when creating or refactoring:

- page layout
- screen layout
- responsive containers
- sidebars
- chat layout
- forms
- cards
- panels
- lists
- headers and footers
- modals and drawers
- spacing systems
- typography sizing
- width/height constraints
- desktop/mobile layout branches

This skill is especially important for shared layout primitives and reusable UI containers.

---

# Core rules

## 1. Do not use fixed pixel values as the default layout tool

Avoid hardcoding layout with values like:

- width
- height
- min-width
- min-height
- max-width
- gap
- padding
- margin
- top/left/right/bottom offsets

when those values are used only to visually force the layout into place.

Do not solve responsive layout problems by stacking more pixel constants.

## 2. Prefer relative and fluid units

Prefer:

- `%`
- `rem`
- `em`
- `vw`
- `vh`
- `dvw`
- `dvh`
- `clamp()`
- `min()`
- `max()`
- flex-based sizing
- grid-based sizing
- intrinsic sizing
- content-based sizing

Use layout systems first, not pixel nudging.

## 3. Prefer flex and grid over manual pixel positioning

Use:

- flexbox
- CSS grid
- wrapping
- alignment
- fluid basis values
- responsive template columns
- minmax-based grid layouts

Do not position major layout sections by hand with pixel offsets when a layout system should own the structure.

## 4. Prefer rem-based spacing and typography

For spacing and typography, prefer scalable units such as:

- `rem`
- `em`
- `clamp()`

This improves consistency and makes scaling more robust across devices and user settings.

## 5. Make width constraints fluid

Prefer patterns like:

- `width: 100%`
- `max-width: ...`
- `minmax(...)`
- `flex: 1`
- `clamp(...)`

instead of fixed-width containers that break at intermediate sizes.

## 6. Let content influence layout when appropriate

Prefer intrinsic sizing where reasonable.

Avoid fixed heights for text-heavy or dynamic-content components unless the interaction truly requires it.

Content that can grow should usually have room to grow.

## 7. Keep desktop/mobile behavior explicit

If desktop and mobile differ:

- use responsive layout rules
- use readable breakpoints
- keep shared behavior centralized
- avoid maintaining two pixel-tuned layout systems

Do not make desktop/mobile support depend on fragile hardcoded values.

---

# What is usually good

Prefer patterns like:

- fluid container widths
- `max-width` with `width: 100%`
- `clamp()` for typography or spacing where scaling matters
- flex layouts with wrapping
- grid layouts with `minmax()`
- responsive gaps in `rem`
- scrollable regions sized by layout context rather than fixed heights
- relative spacing tied to typography scale

Good responsive layout should survive:

- smaller phones
- larger phones
- tablets if applicable
- normal desktop widths
- wider desktop screens

---

# What to avoid

Avoid these anti-patterns unless there is a strong reason:

- `width: 347px`
- `height: 612px`
- `left: 18px` for structural layout
- large chains of pixel-tuned margins/padding to force alignment
- fixed-height message lists or cards that break when content grows
- layout that depends on one specific viewport width
- using many small pixel adjustments instead of fixing the layout system

If the layout only works because many pixel constants were hand-tuned, the structure is probably wrong.

---

# Valid exceptions

`px` is allowed where it is the correct tool.

Typical valid cases:

- 1px borders or hairlines
- icon size when tied to a precise asset or glyph system
- shadows, blur radii, outline thickness
- very small visual details
- stroke widths
- occasionally max-width caps or breakpoint values when the design system already defines them
- canvas or media dimensions when technically required
- cases where browser/platform behavior is genuinely pixel-based

Do not rewrite every `px` blindly.
Only replace pixel usage that harms responsiveness or scalability.

---

# Responsive decision rules

Before keeping a pixel value, ask:

- Is this controlling core layout or only a visual detail?
- Will this still work on narrower and wider screens?
- Is there a fluid or intrinsic alternative?
- Is this value forcing the layout instead of describing it?
- Is flex/grid/clamp/minmax a better solution?
- Would a relative unit make this more robust?

If the value controls layout and does not need to be exact, prefer a non-pixel solution.

---

# Workflow

## 1. Inspect current layout usage

Before editing, inspect:

- layout structure
- current spacing system
- responsive branches
- whether the file uses flex/grid effectively
- where fixed pixel values are currently used
- which pixel values are structural vs cosmetic

## 2. Classify each fixed value

For each important fixed value, decide whether it is:

- structural layout
- spacing
- typography
- responsive sizing
- cosmetic detail
- asset-bound precision

Replace structural pixel values first.

## 3. Replace brittle layout values with fluid structure

Prefer improving the layout system over translating `px` one-to-one into another unit.

Examples:

- replace fixed widths with `width: 100%` plus sensible `max-width`
- replace fixed columns with grid/flex patterns
- replace fixed font sizes with `rem` or `clamp()`
- replace rigid spacing with scalable spacing tokens

## 4. Validate desktop and mobile separately

After responsive refactoring, validate both supported UI targets:

- desktop
- mobile

Check that the layout remains readable, usable, and stable across both.

## 5. Report what changed

Explain:

- which fixed pixel layout values were replaced
- which pixel values were intentionally kept
- what responsive strategy replaced them
- any remaining layout risks

---

# Repo-safe rules

## Do not create fake responsiveness

Do not simply replace `px` with `rem` mechanically if the structure is still brittle.

The goal is responsive behavior, not unit conversion theater.

## Do not overcomplicate simple UI

Use the simplest fluid layout that works.

Do not add `clamp()`, `min()`, `max()`, grid, and flex all at once unless the layout truly needs them.

## Do not destroy design consistency

Relative sizing should still follow a consistent spacing and typography system.

Do not introduce random fluid values everywhere.

## Do not keep fragile pixel-tuned branches

If a component has separate desktop/mobile layouts, each branch should still be structurally responsive.

---

# Testing and validation

When using this skill:

- prefer validating visible behavior
- check for overflow
- check for clipping
- check for hidden controls
- check text wrapping
- check usable spacing
- check layout stability for both desktop and mobile

Run:

`npm run lint`

`npm run test:run`

Also run when relevant:

`npm run build`

If the change affects visible UI, validate desktop and mobile separately.

---

# Completion criteria

A task using this skill is complete when:

- brittle pixel-based layout dependencies were reduced
- responsive structure is improved
- fixed pixel values were kept only where justified
- desktop layout remains correct
- mobile layout remains correct
- validations were run
- the final report clearly explains what was changed and why

---

# Output format

For any task using this skill, provide:

## Responsive layout summary
- what area was too pixel-dependent
- what made it brittle

## Structural changes
- what fixed layout values were replaced
- what responsive patterns were introduced

## Pixel values intentionally kept
- which `px` values remain
- why they were kept

## Validation
- tests run
- lint/build run
- desktop validation
- mobile validation

## Remaining risks
- any areas still sensitive to viewport size
- any follow-up responsive cleanup worth doing
