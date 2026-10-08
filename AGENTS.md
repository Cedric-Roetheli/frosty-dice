# Frosty Dice — Codex Instructions

## Project purpose

Frosty Dice is a mobile-first browser companion for a physical multiplayer dice game.

Each player sits at the same table, uses physical dice, and opens the website independently on their own phone. The website replaces that player's paper game sheet and handles rule validation, scoring, and local persistence.

## Source of truth

Before making significant changes, read:

1. `docs/game-rules.md`
2. `docs/product-spec.md`
3. `docs/implementation-plan.md`

Priority when documents appear to conflict:

1. Explicit instructions from the user for the current task
2. `docs/game-rules.md` for game mechanics
3. `docs/product-spec.md` for V1 product behavior and scope
4. `docs/implementation-plan.md` for sequencing and implementation status
5. This file for general engineering guidance

Do not invent, reinterpret, or silently modify game rules. If a rule required for implementation is ambiguous or missing, stop and surface the ambiguity rather than choosing a rule without approval.

## V1 technical constraints

Frosty Dice V1 should be:

- A static web application
- Mobile-first and comfortable to use on phones
- Built with HTML, CSS, and vanilla JavaScript
- Deployable on GitHub Pages
- Fully usable without a backend
- Fully usable without accounts
- Fully usable without a database
- Free of multiplayer networking or device synchronization
- Based on physical dice; do not add a digital dice roller unless explicitly requested
- Persistent on the local device using `localStorage`

Do not introduce frameworks, build systems, databases, cloud services, authentication, or third-party dependencies unless explicitly approved.

## Core architecture

Keep game rules independent from presentation code.

Suggested initial structure:

```text
frosty-dice/
├── index.html
├── AGENTS.md
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── game.js
│   ├── scoring.js
│   └── storage.js
├── assets/
└── docs/
    ├── game-rules.md
    ├── product-spec.md
    └── implementation-plan.md
```

Responsibilities:

- `index.html`: semantic application shell
- `css/style.css`: mobile-first presentation
- `js/app.js`: UI state, event handling, rendering, and coordination
- `js/game.js`: board model, dice combinations, legal placement rules, connectivity, special-rule detection
- `js/scoring.js`: score and street calculations
- `js/storage.js`: local persistence and restoration
- `docs/`: specifications and implementation plan

The structure may evolve when there is a concrete reason, but keep the codebase simple.

## Engineering principles

- Prefer clear, small functions over clever abstractions.
- Keep rule logic deterministic and testable without the DOM.
- Avoid duplicating game rules in multiple modules.
- Use meaningful names that correspond to terminology in `game-rules.md`.
- Validate user input.
- Never rely on hover for essential interactions.
- Design touch targets for phone use.
- Support narrow mobile screens without horizontal page scrolling.
- Preserve accessibility: semantic controls, labels, keyboard focus, sufficient contrast, and clear status messages.
- Do not implement speculative features outside the current milestone.
- Do not silently change existing behavior while implementing an unrelated feature.
- Keep GitHub Pages compatibility in mind: use relative paths and no server-only routing.

## Game state

Represent enough state to reconstruct the player's current game locally. At minimum this is expected to include:

- Board contents
- Number of the player's own counted rolls
- Any additional state required by confirmed game rules
- A schema/version identifier if persistence evolves

Derived information such as legal moves, streets, and score should generally be calculated from authoritative state rather than stored redundantly.

## Persistence

Use `localStorage` so accidental refreshes or browser closures do not destroy the current game.

A player must be able to deliberately start/reset a game. Destructive reset actions should require clear confirmation.

Do not send game data anywhere in V1.

## Workflow with Codex

For each task:

1. Read the relevant specification files.
2. Identify the smallest implementation scope required.
3. State any rule ambiguity before coding.
4. Implement only that scope.
5. Check that existing confirmed behavior still works.
6. Keep documentation aligned if an approved product or rule decision changes.
7. Summarize what changed and what should be tested manually.

When a game rule changes, update `docs/game-rules.md` as part of the same change.

When product scope changes without changing game mechanics, update `docs/product-spec.md`.

When milestones are completed or reordered, update `docs/implementation-plan.md`.

## Git guidance

Prefer small, coherent commits that correspond to one feature or fix.

Examples:

- `feat: render mobile game board`
- `feat: validate horizontal and vertical placements`
- `feat: add own-roll input flow`
- `feat: calculate street bonus`
- `fix: restore saved game after reload`
- `docs: clarify stolen-number behavior`

Do not commit generated junk, editor-specific files, secrets, or unnecessary dependencies.

## V1 philosophy

The website is a companion to a social tabletop game, not a replacement for the table.

Keep physical and verbal interactions physical and verbal unless digitizing them clearly improves rule enforcement, scoring, or usability.

Simplicity is a feature.
