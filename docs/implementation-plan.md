# Frosty Dice — Redesign Implementation Plan

The repository foundation, mobile board, and local-storage layer already exist.
Playtesting has replaced the earlier turn and score model. The steps below are
the current plan; [game-rules.md](./game-rules.md) remains the mechanics source
of truth. Do not implement a later step while working on an earlier one.

## Step 1 — Rules, core state, scoring, and tests

**Status: Complete for the core-only scope.** The unit suite ran once outside a
browser in JavaScriptCore: 105/105 passed (46 board/state, 9 number-input,
15 frozen-prime, 15 scoring, 7 goal, and 13 storage tests). No browser automation,
screenshots, or viewport tests were performed. No commit or push was made.

Scope:

- Document the four-physical-dice turn and source-neutral number entry.
- Remove roll counts and source-specific turn/action state from the core.
- Represent occupied cells as value/status records.
- Retain four-direction OR placement through non-frozen occupied neighbors.
- Freeze only the new prime after a legal placement beside an occupied prime.
- Preserve frozen occupancy while excluding it from usable neighbors and points.
- Preserve Streets but require all four cells to be normal and never frozen.
- Calculate score as the plain normal-cell sum plus Street bonuses.
- Detect the goal only at a non-frozen occupied D7.
- Version the new local snapshot format and reject incompatible older records
  without guessing placement order or deleting the original save.
- Retain applicable placement regressions and replace obsolete turn/action tests.
- Run the pure unit suite once after implementation.

At this core-only checkpoint, canonical state was only the board. Cell statuses are authoritative;
score, Streets, targets, and goal status are derived. Core updates must remain
independent of presentation code and use no dependencies or build system.

At the end of Step 1 the interface files were unchanged and still imported old
APIs. The subsequent compatibility repair below resolves that startup failure.
Browser automation, screenshots, and viewport tests were excluded from Step 1.

## Compatibility repair — Existing board initialization

Replace removed imports and legacy state-field assumptions in app.js with the
new generic APIs. Read cell records through getCell, retain preview state only
in the UI, and keep the existing layout/stylesheet. Hide unsupported actions
and counters, and retain versioned-storage fallback and confirmed reset.

Add non-browser startup regressions using a document/storage test double.
The game rules and core test cases remain unchanged by this repair.

**Status: Complete.** All 113 tests passed in one JavaScriptCore run, including
eight startup/interaction regressions. Module imports were checked against the
actual exports. No browser automation, commit, or push was performed.

## Freeze/thaw rule revision

Use explicit normal/frozen/thawed statuses and enforce at most one current
freeze. Check placement before applying effects; a new prime freeze thaws the
old current cell anywhere on the board. Thawed cells regain usability but never
points or Street eligibility. A thawed D7 reaches the local goal.

Version 3 saves retain statuses. Version-2 records with at most one frozen cell
migrate in memory; multiple old freezes and malformed/older incompatible saves
fall back safely without deleting the original record or guessing chronology.

Use existing text-marker styling for FROZEN and Thawed. No image assets, general
UI redesign, browser automation, screenshots, or viewport tests belong to this
revision. Run the full suite once, including document-test-double regressions.

**Status: Complete.** All 131 tests passed in one JavaScriptCore run, including
47 placement/state, 9 number-input, 21 freeze/thaw, 17 scoring, 8 goal,
18 storage, and 11 coordinator tests. Module imports also passed validation.
No browser automation, screenshots, viewport tests, assets, commit, or push.

## Targeted freeze/thaw integration coverage and ice-cube feedback

Trace A1=23 → B1=31 → A2=23 through the actual registered app handlers for both
chosen-pair and manual entry. Check every saved snapshot, rendered status, and
restored board. Continue to C1=46 through thawed B1, with scores 23 before that
continuation and 69 afterwards. The existing shared game transition already
produces normal A1, thawed B1, and frozen A2; no engine rule change is needed.

Currently frozen cells use the supplied ice-cube asset beneath their value,
with explicit 48px fallback dimensions and contained image styling. Thawed
cells have no ice cube. Request the updated stylesheet with a versioned relative
URL. Keep the existing input flow and general layout.

Reject mixed legacy boolean/current status records without guessing permanent
damage or overwriting the original saved data. Valid current-version saves and
unambiguous version-2 migration remain supported.

**Status: Complete.** The full suite ran once in JavaScriptCore: **136/136
passed**, including 14 coordinator tests and 20 storage tests. No browser
automation, screenshots, viewport tests, commit, or push was performed. The
image was supplied by the user; no asset generation or image editing was used.

## Step 2 — Cell-first interaction and integration

The approved interaction is a cell-first digital game sheet. Select any empty
cell, enter a two-digit dice number, and submit it to the existing shared rule
operation. Do not calculate or display legal targets, suggest numbers, or
validate a placement during selection or typing. Occupied cells cannot receive
ordinary placements; Undo below provides one-step input correction.

On success, apply the existing state transition, save, update the derived
displays, and close/clear entry. On rejection, preserve the board and draft and
explain the failure briefly without implying cumulative neighbor requirements.
Cancel/outside taps/Escape discard only the draft. Keep confirmed reset.

Remove old roll/source/counter/Schnapszahl/removal UI and its exclusive CSS/JS.
Keep the compact score, Street/goal feedback, touch sizes, board layout, and
working ice-cube treatment. Broad visual polish is outside this task. The game,
scoring, and storage modules and all engine tests remain unchanged.

Replace obsolete coordinator tests with cell selection, submission, correction,
cancellation, occupied-cell safety, shared freeze/thaw, score, goal, persistence,
and reset regressions. Run the suite once without browser automation,
screenshots, viewport tests, commit, or push.

**Status: Complete for this interaction scope.** The full suite ran once in
JavaScriptCore: **159/159 passed**, comprising 122 unchanged core tests and
37 coordinator tests. The game, scoring, and storage modules are unchanged.
HTML references, relative paths, and module imports were checked without a
browser. Broad visual polish remains deferred. No browser automation,
screenshots, viewport tests, commit, or push was performed.

## One-step Undo — Whole-board correction

Remove direct occupied-cell correction, its action interface, API, state,
exclusive styling, and tests. Occupied normal/frozen/thawed cells are readonly.

Extend canonical state to `{ board, undo }`. Capture a deep-cloned
`{ board }` immediately before placement, publishing it only when the move
succeeds. The next successful move replaces it; failed attempts and canceled
drafts preserve it. Restore the snapshot exactly and consume it with no Redo
or older history. Do not reverse effects or reconstruct a previous board.

Keep existing placement, dice, freeze/thaw, scoring, Street, and goal logic.
Recalculate derived displays after restore. Clear any unsubmitted entry and
stale selection on Undo. Confirmed reset clears current state and Undo.

Add a compact, accessible ↶ button immediately left of Score. Keep its place
when unavailable and disable/subdue it. Use a 48px touch target and immediate
action with no confirmation. No other occupied-cell or opponent action is added.

Version 5 persists both boards and consumes Undo by storing null. Preserve valid
version-3/4 boards without inventing snapshots, retain safe version-2 migration,
and reject malformed/recursive/mismatched snapshots safely. Keep relative paths
and static deployment compatibility.

Add pure snapshot/Undo, full coordinator, and persistence regressions, including
the 23/31/23 freeze example, Street/goal rollback, reload, repeat taps, invalid
attempts, cancellation, and reset. Preserve existing game-engine coverage.
Run the suite once; no browser automation, screenshots, viewport tests, commit,
or push.

**Status: Complete.** The full suite ran once in JavaScriptCore: **195/195
passed**, including 15 pure Undo, 50 coordinator, and 28 storage tests. Existing
game-engine coverage remains; obsolete direct-correction tests were removed.
The 23/31/23 integration exercises input, save, render, reload, and Undo, restoring
B1 frozen and A2 empty. Source checks also passed for imports, labels, static
paths, and the Undo button's position. No browser automation, screenshots,
viewport tests, commit, or push was performed.

## Attack Ice — Independent temporary overlay

Add manual Freeze/Unfreeze contextual actions to eligible occupied cells. A
normal or thawed cell may receive the one Attack Ice overlay; a Prime-frozen
cell may not. Freezing another eligible cell atomically moves the overlay.
Keep occupied values readonly, empty-cell input unchanged, and Challenge
resolution entirely at the physical table, as specified in game-rules.md.

Store an independent optional `attackIce: true` cell flag, preserving every
underlying Prime status. Attack Ice keeps base points, blocks placement support,
temporarily disqualifies Streets, and suppresses D7 goal detection. Removal
restores the underlying behavior with no new permanent damage. Use icecube2.png
with the existing contained ice rendering; Prime Ice retains icecube.png.

Each successful Freeze, Unfreeze, or Move captures the same full pre-action
board used by one-step Undo. Version 6 persists both boards with overlays.
Preserve version-5 Undo and earlier supported board migrations; safely reject
mixed or invalid states without rewriting a saved record during load.

Cover the core effects, Prime coexistence, atomic actions, exact Undo, storage
migration, and actual registered UI-handler paths with dependency-free tests.
Run the full suite once, without browser automation, screenshots, viewport
tests, commit, or push. Manual phone/design evaluation remains deferred.

**Status: Complete for this scope.** The full suite ran once in JavaScriptCore:
**253/253 passed** (47 game, 9 number-input, 21 Prime Ice, 17 scoring, 8 goal,
36 storage, 67 coordinator, 15 Undo, and 33 Attack Ice tests). Existing cases
remain, with assertions updated for occupied-cell actions and the new save
version. Static imports, shell IDs, asset paths, and whitespace checks passed.
No browser automation, screenshots, viewport tests, commit, or push was performed.
The supplied icecube2.png is used unchanged.

## Experimental illustrated background and full-cell ice

Use the two supplied portrait PNGs as fixed decorative CSS layers with a
shared aspect-preserving base size, separate scales, and a tunable painted
horizon. Keep the meadow plants and sky transition together without layout
changes. Add only the approved light backing behind header/score text.

Both active ice assets use the same cover/scale rule, clipped to existing cell
bounds with numbers above the artwork. Keep thawed visuals, UI geometry, game
logic, persistence, and artwork files unchanged. Update the stylesheet cache
version so the visual pass is loaded. Broader UI work remains deferred.

Run the existing suite once without browser automation, screenshots, viewport
tests, or visual regression tests. Composition and ice cropping will be
evaluated manually on phones. Do not commit or push.

**Status: Implemented for this experimental pass.** The unchanged automated
suite ran once in JavaScriptCore: **253/253 passed**. CSS asset paths and diff
whitespace checks passed. PNGs, JavaScript, tests, and the previous README URL
cleanup are unchanged. No browser automation, screenshots, viewport tests,
commit, or push was performed. Manual visual evaluation remains pending.

## Targeted visual iteration 2 — Lower horizon, sky header, stretched ice

Move the existing horizon control from 72% to 95% of stable viewport height.
Remove the header backing and use white title/Score/Undo styling, keeping
typography, geometry, and the 48px Undo target. Retain subtle disabled feedback.
Replace the shared oversized cover/transform with 100% width/height and a
central `--ice-image-fit: fill` setting. Keep cell clipping and numbers above
the artwork; do not change other UI, assets, rules, or JavaScript behavior.

**Status: Implemented for manual iPhone evaluation.** Update the stylesheet
cache version. Static scope/path and diff checks only; the suite was not run
because application logic is unchanged. No browser automation, screenshots,
visual tests, commit, or push. The next composition evaluation is manual.

## Targeted visual iteration 3 — Safari canvas and meadow continuation

Add `theme-color: #03020e`, matching the sampled upper sky, and use it for the
root/body canvas fallback without changing the viewport metadata or sky image.
Give the page and decorative layers a `100dvh` minimum with a `100vh` fallback.
Keep composition and its 95% horizon based on stable viewport height.

Keep the sky fixed and let the meadow's decorative layer span the full body
height, extending the PNG naturally down the page. Below the painting, continue
its underlay with matching green `#24691e`. Preserve safe-area padding, board,
header, ice, and all interaction geometry. Make only the exposed New Game /
Reset text and focus outline white; retain confirmation styling and behavior.

**Status: Implemented for manual iPhone Safari evaluation.** Updated the CSS
cache version and performed static scope/path/metadata and whitespace checks.
No full suite was run for these HTML/CSS-only changes. No browser automation,
screenshots, visual tests, commit, or push. Assets and application logic are unchanged.

## Focused board glass polish — Presentation only

Remove the visible board heading and row-number gutter. Render four aligned
P/L/A/Y headers using an app-only display mapping to A/B/C/D. Preserve internal
A1–D7 cell IDs, accessible identifiers, state, and all existing game rules.
Keep Street feedback, moving its ×2 marker into the last cell's corner without
changing cell height or adding a column.

Give the outer sheet restrained translucent white, a thin translucent border,
and slight Safari-compatible backdrop blur. Keep individual cells more opaque,
with readable numbers and existing selection/start/goal distinctions. Expose
opacity and blur values centrally. Preserve cell heights, typography, ice
geometry/stacking, background composition, and interactions outside the board.

Update presentation assertions and add a handler-level display-to-coordinate
regression. Retain every core test and internal-coordinate case. Run the full
suite once without browser automation, screenshots, or visual regression tests.
Do not commit or push. Manual phone evaluation remains deferred.

**Status: Implemented for this focused presentation scope.** The full suite
ran once in JavaScriptCore: **254/254 passed**, including 68 coordinator tests
and the unchanged core cases. Static checks confirmed that gameplay handlers,
game/scoring/storage modules, ice styling, artwork, and all background values
and rules are unchanged. Markup IDs, accessible names, paths, module imports,
and whitespace checks passed. No browser automation, screenshots, visual
regression tests, commit, or push. Manual glass/contrast evaluation is pending.

## Step 3 — Manual evaluation and release

**Not started.** After UI integration, evaluate the physical game and interface
on representative phones, verify saving/restoration/reset and GitHub Pages
paths, and resolve only the rules that require a design decision. Publish only
when explicitly requested.

Global end-of-game timing remains undecided and is not enforced by Step 1.

## V3 — Secret Bid Challenge

Replace the physical die-off with secret point bidding as defined in
game-rules.md. Add a compact header Challenge control and an accessible modal
with the unchanged bid.png artwork, an integrated numeric bid, Confirm, and
Close. Confirm spends exactly once and keeps the locked bid open for reveal;
players compare screens and resolve existing Attack Ice consequences manually.

Persist only board state, point spending, and one complete pre-action Undo in
version 7. Preserve supported legacy games, including version-6 Attack Ice and
Undo. Unfinished/revealed bids and open dialogs are temporary. Invalid and
cancelled bids preserve existing state and Undo; confirmed bids, including 0,
replace the snapshot. Keep placement, Prime Ice, manual Attack Ice, Streets,
goal, inline entry, and the approved landscape unchanged.

No repdigit bonus, debt, player tracking, winner comparison, automatic Freeze,
networking, dice rolling, cooldown, or Challenge limit is included. Add pure and
coordinator tests, then run the suite once without browser automation or
screenshots. Manual iPhone evaluation remains with the user.

## V3 refinement 2 — Bid presentation and scoring

Enlarge the centred banknote bid while retaining room for four digits, and
outline the existing header Challenge button in white with restrained rounded
corners. Preserve all approved game/landscape layout and Challenge behavior.

Double only the base contribution of normal repdigits. Detect Streets using
the ordered possible dice numbers (11–16, 21–26, ... 61–66), preserving horizontal
direction and existing ice exclusions. Keep the raw row sum as the Street
bonus so the repdigit bonus is not applied twice. Score remains derived and
feeds the same bid validation, Undo, and persistence; add no new state or save
format. Update focused scoring and integration regressions and run the full
suite once without browser automation or screenshots. Manual iPhone evaluation
remains with the user.

**Status: Implemented for manual iPhone evaluation.** The full suite ran once
in JavaScriptCore: **316/316 passed**, including the pending first-pass
Challenge tests, 42 scoring tests, 88 coordinator tests, and regressions for
Prime/Attack Ice, spending, Undo, and persistence. Artwork, approved layout,
gameplay handlers, and the saved-state format were preserved. No browser
automation, screenshots, commit, or push was performed.

## V3 — Combined cell multipliers

Reuse the existing Street corner marker for normal scoring repdigits and every
scoring Street cell. Show one 2x for either multiplier, or one 4x when both
apply; zero-scoring Prime-frozen/thawed cells have no indicator. Attack Ice
retains the underlying repdigit 2x while suppressing the row's Street effects.

Correct the former raw-row Street bonus so it doubles normal scoring
contributions, including repdigits: 22 contributes 44 alone and 88 in a Street.
Share one pure multiplier between scoring and rendering, without adding stored
state. Preserve Street detection, all ice mechanics, input, Challenge, Undo,
storage format, approved CSS, and page layout. Add focused pure and coordinator
regressions, then run the suite once without browser automation or screenshots.

**Status: Implemented.** The full suite ran once in JavaScriptCore:
**326/326 passed**, including 47 scoring and 93 coordinator tests. Tests verify
the single 2x/4x indicator, 22 scoring exactly 88 in a Street, ice exclusions,
and multiplier recomputation after reload/Undo. CSS and artwork are unchanged.
No browser automation, screenshots, commit, or push was performed. Check marker
readability and ice transitions manually on iPhone.

## Optional PWA — Installable offline game sheet

Add a root-domain standalone manifest, standard 192/512px icons and an Apple
180px touch icon from the unchanged source, Apple metadata, and quiet independent
registration. Keep the normal website usable immediately without installation.

Precache the real versioned HTML/CSS/modules and every required illustration.
Use a coherent versioned cache with root/index fallback. Check the worker on
online launches; a newly cached release waits for old windows to close before
activation and cleanup. Document the mandatory cache-version bump for runtime
file changes. Keep game state solely in the unchanged localStorage version 7.
Record iOS storage separation and the need to warm each installed context online.

Add focused non-browser Cache/Fetch/registration tests and run the full suite
once. Preserve all existing game tests, rules, UI, CNAME, and deployment structure.
No browser automation, screenshots, commit, or push. Manual device validation
and deployment remain with the user.

**Status: Implemented for manual device testing.** The full suite ran once in
JavaScriptCore: **339/339 passed**, retaining all 326 existing game tests and
adding 13 PWA checks. Static checks verified all 21 precache URLs against actual
references, exact icon resizes, and 23 successful local HTTP responses including
worker/module/manifest MIME types. Existing game modules, tests, CSS, artwork,
rules, storage version 7, and CNAME are unchanged. No browser automation,
screenshots, commit, or push was performed.

## PWA real-device follow-up — Conditional images and standalone meadow

The local precache already includes all 21 runtime URLs, including both ice
assets, bid artwork, backgrounds, controls, Rules/contact illustrations, and
icons. Harden exact-URL cache lookup against CDN `Vary` header differences
between generic precache fetches and later image requests. Keep the atomic
install and waiting/activation strategy; bump the cache from v1 to v2 and
request the standalone stylesheet with a matching new query-string version.

Standalone mode alone uses an 85% stable-viewport horizon, compensating for the
taller viewport without browser bars. Normal Safari retains its approved 95%.
Preserve artwork scaling, sky, board, and meadow-relative control anchors.

**Status: Implemented for manual iPhone recheck.** The full automated suite
ran once in JavaScriptCore: **340/340 passed**, including 14 PWA tests and all
326 existing game tests. A new regression covers first-time offline image
requests with different `Vary` headers. Static checks verified all 21 runtime
URLs against the precache and 23 successful HTTP responses/MIME types.
No browser automation, screenshots, commit, or push was performed.

## Bilingual Rules — Illustrated language selector

Keep the English Rules heading and existing signpost navigation. Add the
unchanged DE/EN illustration with semantic transparent buttons and precise
yellow interior overlays beneath its original outlines. Switch between the
unchanged English/German rules assets in place, preserving each natural aspect
ratio and all handwritten content. Keep existing landscape/game UI unchanged.

Store only the independent `en`/`de` preference under
`frosty-dice.rules-language`, defaulting safely to English. Keep Reset, Undo,
Challenge, canonical saves, and version 7 unchanged. Use an independent rules
controller, native keyboard activation, pressed state, and visible focus.

Precache the new controller, German illustration, selector, and two generated
fill PNGs. Bump the cache from `frosty-dice-pwa-v3` to `frosty-dice-pwa-v4` while
preserving atomic install, waiting, cleanup, and offline navigation. Add focused
controller/reset/storage and offline regressions; run the full suite once.
Manual visual testing remains on iPhone, without browser automation or screenshots.

**Status: Implemented for manual iPhone evaluation.** The full suite ran once
in JavaScriptCore: **353/353 passed**, including 11 Rules tests, 16 PWA tests,
and all 326 existing game tests. Checks cover preference restoration, invalid
or blocked storage, keyboard-originated clicks, exclusive active fills, and the
real confirmed-reset path preserving the preference. Static checks verified
26/26 runtime precache URLs, 28 successful HTTP responses/MIME types, unchanged
source illustrations, and accurate transparent letter cutouts. Gameplay
modules, version-7 storage, existing CSS outside the selector, standalone meadow
correction, and worker lifecycle/fetch strategy are unchanged. No browser
automation, screenshots, commit, or push was performed.

## Cosmetic refinement — Points, illustrated title, and footer cowboy

Change only the visible header label from Score to Points. Use a lossless
transparent 1674 × 1187 crop of the supplied title artwork in the existing h1,
with responsive 4.5rem–6rem width and descriptive alt text. Preserve source
artwork, existing header controls, number styling, and all game logic.

Add the full surfing-cowboy illustration to the left of the unchanged contact
artwork in a responsive 1:2 footer grid, with natural image heights and no
cropping, surfaces, overlap, or landscape changes. Precache the title derivative
and cowboy, updating the CSS URL and cache from v4 to v5. Preserve worker update
and activation behavior. Run the existing suite once; visual review remains
manual on iPhone, without browser automation or screenshots.

**Status: Implemented for manual iPhone evaluation.** The unchanged automated
suite ran once in JavaScriptCore: **353/353 passed**. Static checks verified
28/28 runtime precache URLs, 30 successful HTTP responses/MIME types, the
lossless transparent title crop, and unchanged supplied artwork. Game and
Rules controllers, all tests, storage, board/landscape CSS, existing header
controls, and the service-worker lifecycle/fetch strategy are unchanged.
No browser automation, screenshots, commit, or push was performed.

## Additional Rules — Readable bilingual popup

Keep the original Rules illustrations and the working light-blue language
toggle. Measure the yellow box separately for each image and position an
invisible semantic button over that box alone, with a small magnifier below
its edge. Do not change the Rules section position or surrounding artwork.

Use the selected language and the user-supplied paragraphs verbatim in a native
glass modal with white 18px text, safe-area spacing, internal scrolling, and a
close button. Handle backdrop taps and Escape, preserve native focus isolation,
and restore opener focus and page scroll after locking background scrolling.
Keep game state, language preferences, Challenge, and all mechanics unchanged.

Embed text in the existing cached controller; update the CSS/controller URL
versions and cache from v6 to v7. Preserve precache coverage, offline navigation,
registration, waiting, and activation cleanup. Add focused non-browser popup,
language, focus/scroll, close-path, and game-save regressions, then run the full
automated suite once. Manual visual evaluation remains on iPhone; do not use
browser automation or screenshots, commit, or push.

**Status: Implemented for manual iPhone evaluation.** The full suite ran once
in JavaScriptCore: **364/364 passed**, including 22 Rules tests, 16 PWA tests,
and all 326 existing game tests. Eleven new cases cover exact EN/DE content,
box-only activation, native keyboard activation, close/Escape/cancel/backdrop,
scroll/focus restoration, repeated opening, failed opening, and unchanged
canonical game saves. Existing preference and reset coverage is retained.
Static checks verified 28 runtime precache URLs, 30 HTTP responses/MIME types,
unchanged artwork/light-blue fills, and unchanged gameplay/Challenge modules,
prior CSS, and worker update strategy. No browser automation, screenshots,
commit, or push was performed.

## D7 finish flag — Empty-cell illustration

Replace only empty D7's End text with the unchanged `assets/d7_flag.png`,
centered in an 88% cell image box using contain sizing and no pointer events.
Derive its presence from the existing board/entry render path: hide during
inline editing or occupancy; restore after cancellation, rejected input, Undo,
and confirmed Reset. Keep A1 and all occupied-cell rendering/logic unchanged.

Precache the flag and update the CSS/app URLs and cache from v7 to v8, without
changing worker lifecycle or game-state storage. Update focused rendering and
interaction regressions and run the existing suite once. No browser automation,
screenshots, commit, or push; manual flag-size evaluation remains on iPhone.

**Status: Implemented for manual iPhone evaluation.** The full automated suite
ran once in JavaScriptCore: **362/367 passed initially**. Five old tests assumed
every board image was ice; their assertions now count ice images specifically,
with a focused **5/5 recheck passed**. The other 362 cases passed unchanged,
so all 367 cases are verified across the two runs. Three new D7 cases cover
cancellation/rejection, occupied ice/multiplier states, and confirmed Reset;
existing startup, legal placement, and Undo cases now verify the flag as well.
Static checks verified all 29 runtime precache URLs and 31 HTTP responses/MIME
types. Original artwork, core rules/scoring/storage, existing CSS, entry and
Undo/Reset handlers, and the worker update strategy remain unchanged.
No browser automation, screenshots, commit, or push was performed.

## V3 — Frosty Fresh Goods receipt and Challenge records

Replace only the permanent header Points value with an accessible white $
button. Present the unchanged receipt.png in a native modal, with dynamic
BOARD VALUE, Challenge expenses, and YOUR BALANCE (SALDO) in its measured blank centre.
Use local American Typewriter/Courier fallbacks, a 450ms restrained downward
entrance, and an instant reduced-motion alternative. Keep the history list
independently scrollable without stretching the artwork or covering its footer.

Reuse the authoritative scoring breakdown and bid balance. Change visible
currency terminology to Frosty Dollars without changing any scoring mechanic.
Each confirmed bid records one chronological expense without another deduction.
Do not record or display outcomes: the local app has no reliable winner
association. Do not infer results from reveal, inactivity, or manual ice actions.

Version 8 adds optional itemized Challenge history to current state and the
existing single Undo snapshot. Older saves retain board, aggregate spending,
balance, and valid Undo without fabricated transactions. New bid Undo removes
its record and deduction together; placement and ice Undo preserve history.
Reset clears records and numbering while preserving Rules language.

Precache the receipt image/controller, align changed module URLs, and bump the
cache from v19 to v20 without changing worker installation/activation strategy.
Add focused coordinator, scoring integration, transaction, migration, Undo,
accessibility, reduced-motion, and offline regressions. Run the full automated
suite once; manual illustration fit, keyboard/focus, animation, scrolling, and
installed offline evaluation remain on iPhone. No browser automation,
screenshots, commit, or push.

**Status: Implemented for manual iPhone evaluation.** The full automated suite
ran once in JavaScriptCore: **427/429 passed initially**, including all 24 new
receipt tests and all 21 PWA tests. Two test fixtures were corrected for the
requested comma-grouped currency format and an overridden Escape-event spy;
the focused **2/2 recheck passed**, verifying all 429 cases across the runs.
No production code changed after that suite run. Static checks confirm the
original receipt/Rules artwork, scoring module, existing gameplay protections,
landscape layout, Challenge animations, and worker update strategy are preserved.
No browser automation, screenshots, commit, or push was performed.

## Receipt refinement — Simple expenses and explicit ice layers

Keep the native receipt and its artwork, authoritative scoring, bid spending,
and Undo. Remove outcome tracking and symbols; persist only each expense's ID
and amount. Keep schema version 8: accept obsolete outcome fields in existing
current/Undo records, ignore them in accounting comparisons, and discard them
from canonical copies. Preserve every deduction and transaction association.

Show BOARD VALUE and regular-weight “1x Challenge #01” expense rows with CSS
dotted leaders, without a Challenge History heading. Keep independent list
scrolling. Place a larger YOUR BALANCE (SALDO) label above a prominent balance,
using the existing American Typewriter fallbacks. Outline the unchanged 48px $
target with a thin white circle and transparent fill.

Ice investigation verified matching original PNGs, correct renderer paths and
elements, successful local HTTP image responses, and both assets in the existing
precache. The receipt changes did not remove those elements or alter their old
styles. The report was from Safari over local HTTP, where service workers do not
control the page. The exact device rendering cause could not be confirmed under
the no-browser-automation constraint; after the direct-image test was unavailable,
the user asked to proceed assuming the artwork loads. Harden the shared rendering
path with an inset, explicitly stacked non-replaced layer around each image.
Preserve full-cell fill, clipping, readable labels, cell dimensions, and mechanics.
Manual iPhone confirmation remains necessary.

Align runtime URLs at receipt-2 and bump the cache from v20 to v21; retain
offline ice/receipt assets and the established worker update strategy. Add
focused rendering, layout, canonical history compatibility, and offline checks,
then run the full automated suite once without browser automation or screenshots.
Do not commit or push.

**Status: Implemented for manual iPhone recheck.** The complete automated suite
ran once in JavaScriptCore: **435/435 passed**, including 30 receipt tests and
21 PWA tests. Six added cases cover old outcome-bearing version-8 saves,
expense formatting, circular header styling, both ice rendering paths through
receipt/reload/Undo or thaw, and explicit CSS image geometry/paint order.
The source PNGs, scoring, existing rule protections, Challenge animations,
language controller, and worker lifecycle remain unchanged. Ice visibility on
the actual iPhone is not established by these non-browser tests.

## Optional Digital Dice Machine — Independent illustrated component

Add the supplied cabinet, separate lever/bracket, and six illustrated dice as
an optional, permanently visible component in normal flow below gameplay and
above Rules. Preserve existing board and landscape anchors, meadow variants,
standalone PWA adjustments, Rules controls, receipt, and all source artwork.
Keep a stable responsive wrapper that includes the lever's swing and one
vertical dice column; constrain and redistribute four/three/two visible dice
within the measured cabinet interior.

Use an independent vanilla module with pure dice-state and layout helpers,
stable die IDs, unbiased Web Crypto generation (documented Math.random fallback),
neutral unselectable placeholders, and no automatic initial roll. Support
semantic-button tap, keyboard, and downward pointer pulls without double rolls.
Precompute outcomes, lock interaction during the 1.6-second sequential animation,
reuse face images, and clean up guarded timers. Respect reduced motion.
Allow two ordered selections and individual deselection, including equal values;
leave the enlarged remaining pair visible for other players. Reuse the existing
DE/EN preference and toggle without persisting temporary dice state.

Do not connect the machine to board placement/validation, scoring, Challenge,
receipt/history, Undo, storage, turns, or opponents. Clarify only the optional
physical/digital choice in game-rules.md; no underlying mechanics change.
Preload six faces, precache the controller and all nine original PNGs, and bump
`frosty-dice-pwa-v22` to `frosty-dice-pwa-v23` without changing worker activation
or update strategy. Add focused state, RNG, gesture, timing, selection, layout,
language, game-isolation, and offline tests. Run the full automated suite once;
device artwork fit and interaction evaluation remain manual on iPhone.
No browser automation, screenshots, commit, or push.

**Status: Implemented for manual iPhone evaluation.** The full automated suite
ran once in JavaScriptCore: **471/471 passed**, including 27 new digital dice
tests and 23 PWA tests. Coverage includes initial placeholders, uniform mapping
and fallback, precomputed results, gesture/keyboard safety, sequential stops,
timer cleanup, reduced motion, duplicate IDs, ordered selection/deselection,
constrained layouts, language changes, saved-game isolation, and offline assets.
Static checks confirm all original PNGs and existing JavaScript modules are
unchanged, all 50 precache paths exist, and worker lifecycle logic is preserved.
No browser automation, screenshots, commit, or push was performed.

## Digital Dice disclosure — Optional, remembered visibility

Wrap the existing mounted machine in a collapsible panel without rebuilding or
changing its geometry, dice logic, roll timers, or selection. Add one semantic
DE/EN toggle with a chevron and `aria-expanded`/`aria-controls`. Default to
collapsed; persist only visibility in `frosty-dice.digital-dice-expanded`,
separate from game state and language. Invalid or unavailable storage safely
falls back to collapsed while session toggling remains available.

Animate wrapper height and opacity for 300ms, with no scaling and an instant
reduced-motion alternative. A collapsed machine occupies no height; Rules moves
up naturally without moving landscape controls. Keep hidden controls inert and
out of accessibility navigation, with focus returned to the toggle as needed.
Rolls continue and settle normally while hidden; reopening preserves the dice,
selection order, and reusable DOM elements. Language changes affect labels only.

Update HTML/CSS/controller versions and bump the PWA cache from v23 to v24,
preserving its asset list and lifecycle strategy. Add focused defaults,
restoration, toggling, storage failure, state/timer preservation, language,
native keyboard semantics, and reduced-motion regressions. Do not modify game
rules or saved-game format. No browser automation, screenshots, commit, or push.

**Status: Implemented for manual evaluation.** The full automated suite ran once
in JavaScriptCore: **481/481 passed**, including 37 digital dice tests (10 new
disclosure cases) and 23 PWA tests. Coverage includes collapsed defaults,
remembered visibility, malformed/unavailable storage, preserved selections and
DOM nodes, rolling while hidden, language changes, native button semantics,
focus return, and reduced-motion styling. Static comparison confirms unchanged
game modules, game rules, all PNGs, machine geometry, landscape positioning,
saved-game format, and worker lifecycle. No browser automation, screenshots,
commit, or push was performed.

## Digital Dice artwork refinement — Illustrated sign and raccoon

Use the redesigned 2048 × 2048 dice_machine.png unchanged. Fit all painted
artwork, including the sign, raccoon, bag, and right-side decoration, inside an
1800 × 1900 responsive composition capped at the existing 32rem. Exclude only
transparent padding via CSS positioning. Realign the existing lever and bracket
to the frame while preserving the pivot and animation; maintain its touch area
independently of artwork scaling.

Remove initial EN/DE instruction text: the illustration supplies the intentional
English-only CHOOSE TWO sign. Leave the upper interior empty until selection.
Retain individually interactive, ordered CHOSEN/GEWÄHLT values, clearing the
label after the last deselection or another roll. Use a measured 600 × 1000 dice
region below that display with the existing four/three/two resizing algorithm.
Preserve rolling, IDs, duplicate selection, reduced motion, collapsed defaults,
visibility preference, and independence from all gameplay and saved state.

Bump the cache from v24 to v25 and align CSS/controller URLs without changing
the precache asset list or worker lifecycle. Add focused empty/selected display,
complete artwork bounds, interior geometry, lever alignment, and touch-area
regressions; run relevant digital dice and PWA tests without browser automation
or screenshots. Do not commit or push.

**Status: Implemented for manual evaluation.** Relevant automated tests ran once
in JavaScriptCore: **65/65 passed** (42 digital dice and 23 PWA), including five
new cases for blank initial text, interactive selected values, complete painted
artwork bounds, measured interior geometry, and lever swing/bracket alignment.
Existing roll, selection, duplicate-ID, collapse, persistence, language,
reduced-motion, game-isolation, and offline tests also pass. The user-supplied
replacement PNG and all other artwork remain byte-for-byte unchanged; game
modules and worker lifecycle are unchanged. No browser automation, screenshots,
commit, or push was performed. Device artwork fit remains a manual check.

## Digital Dice layout refinement — Viewport poles and full-height dice

Use the PNG's measured alpha bounds to place the mobile pole ends at the viewport
edge. The upper pole ends at x=2032 with 16px transparent padding; the lower pole
ends at x=2019. Align the latter so both reach the edge, allowing only the upper
pole's extra tip to extend offscreen. Cancel existing page insets for the local
panel, retain the machine's previous content width/height, and translate the
entire composition together. Clip locally, avoid `100vw` scrollbar overflow,
and preserve the centered desktop layout above 36rem. Do not move the machine
vertically, its lever relative to the cabinet, or any landscape element.

Reclaim the light interior at y=330..1710: use 600 × 1380 for four dice, increasing
their source size from approximately 217 to 300 (38%). Use exactly that layout
for placeholders, rolling, and every sequential stop. Only after selection,
measure the actual chosen-value text/buttons plus a 0.25rem gap and reserve that
height. Pass the reservation into pure layout math, with 250ms internal region
and die transitions and an instant reduced-motion alternative. Recalculate on
resize/language changes; deselection and another roll release the space.

Preserve all dice outcomes, timing, IDs, selection semantics, collapse preference,
board/game data, and artwork. Update CSS/controller URLs and the PWA cache from
v25 to v26 without changing its asset list or lifecycle. Add focused mobile,
desktop, scrollbar/inset geometry, all four/three/two dice states, resize,
collapse, and animation regressions; run relevant tests without browser
automation, screenshots, commit, or push.

**Status: Implemented for manual evaluation.** Relevant tests ran once in
JavaScriptCore: **72/72 passed** (49 digital dice and 23 PWA). Seven added cases
cover mobile/desktop edge geometry, safe-area insets and scrollbar compensation,
larger neutral/rolling/stopped dice, measured text reservations for three/two
dice, full-height restoration, resize/language handling, and reduced-motion
transitions. Existing collapse, state preservation, dice outcomes, selection,
game-isolation, and offline tests also pass. Geometry is modeled at narrow
mobile and desktop sizes; no actual browser/viewport rendering or screenshots
were used. Artwork, game modules, and worker lifecycle remain unchanged.
No commit or push was performed. Manual iPhone visual confirmation remains.

## Receipt artwork variants — Independent choice on each opening

Choose uniformly among receipt.png and receipt2/3/4.png on each closed-to-open
transition, allowing consecutive repeats. Keep one receipt image and the existing
shared content, scrolling, stickers, separator lines, close/focus behavior, and
450ms/reduced-motion entrance. Do not draw during renders or repeated open calls,
tie the choice to any game/UI value, or persist the choice.

All source PNGs are 1440 × 3200 with identical overall alpha bounds. Inspection
confirms aligned paper edges, heading, separators, blank content area, barcode,
and bottom edge; footer wording varies within its existing space. The existing
receipt CSS can stay unchanged. Preload all four images and switch the source
before showing the modal. Keep original files untouched.

Add the three new PNGs to the precache, bump v26 to v27, and align the receipt
module/importer URLs at receipt-4 while retaining the worker lifecycle. Add focused
uniform-selection, per-opening/repeat, shared-data, game/Undo persistence, preload,
and offline regressions. Run relevant receipt, app coordination, and PWA tests.
Do not change game rules, storage format, or unrelated UI; do not commit or push.

**Status: Implemented for manual evaluation.** Relevant automated tests ran once
in JavaScriptCore: **180/180 passed** (42 receipt, 114 app coordination, 24 PWA).
Five new receipt cases cover uniform quarter-interval selection, fresh openings
and permitted repeats, stable open/render behavior, unchanged shared data and
game/Undo state, and preloading one shared image. A new PWA case verifies all
four backgrounds offline. Existing receipt scrolling, stickers, formatting,
closing/focus, scoring/history/Undo, and entrance/reduced-motion checks pass.
All illustrations, receipt CSS, gameplay modules, storage format, and worker
lifecycle remain unchanged. No browser automation, screenshots, commit, or push.

## Interactive How to Play — Twelve-step bilingual demonstration

Add a separate native tutorial controller, declarative scene module, and scoped
stylesheet in the existing Rules section. HOW TO PLAY / SPIELANLEITUNG and FULL
RULES / ALLE REGELN are independent semantic disclosures, collapsed initially.
Reopening retains the tutorial step; Full Rules keeps both unchanged illustrated
Rules and the Additional Rules modal mounted and functional. Reuse the existing
language selector/preference, including Digital Dice's existing language behavior.

Exactly twelve steps follow one validated example: A1=12, B1=24, C1=46, C2=46,
B2=35. Immutable snapshots and fresh clones make backward navigation deterministic.
The last placement is valid through C2 despite the incompatible number above.
Use existing pure game/scoring helpers, never another engine. Validate the later
continuation under both alternative Challenge actions through usable D7. The
final $1,114 board minus Player A's $30 bid gives a $1,084 receipt balance.

Use one canonical 400×700 board per example player. Full views open/close the
sequence; upper excerpts show two rows plus 45% of row 3, physically clipped by
overflow-hidden viewports. Related placement steps keep cell size stable. Paired
Challenge excerpts are vertically arranged beside aligned, width-capped example
banknotes. Camera transforms/window sizes transition for 400ms. Finite animations
demonstrate placement, deterministic dice, concealed bids, reveal, and one ice action.
Generation guards and timer cancellation prevent stale callbacks; reduced motion
shows settled scenes immediately. Never advance tutorial steps automatically.

Correct Challenge documentation and readable Additional Rules: initiate before
the normal dice turn, which still follows; higher bid wins, ties have no winner
and require another bid; both spend their confirmed bids; either winner chooses
exactly ONE of Freeze an eligible opponent cell OR Unfreeze their own Attack Ice.
Use unequal $30/$50 bids with Player B winning. Tied-round deductions/refunds remain
unspecified. The real Challenge code already records only local bids and manual
ice actions, with no role-specific rights or automatic winner/tie determination;
no gameplay-code correction is needed. Keep the original Rules artwork unchanged.

Prime Ice is intentionally omitted from all tutorial explanations and examples.
The complete Rules retain it. The tutorial never accesses real game/Undo state,
game saves, actual dice, the live receipt, or real Challenge transactions. Its final
action only scrolls/focuses the real board. Original game/UI modules and assets stay
unchanged. Precache the new tutorial modules/CSS and version the Rules module;
bump the worker from v27 to v28 without changing its update lifecycle.

Add focused navigation, snapshots, legal sequences, clipping/camera geometry,
Challenge alternatives/concealment, language, accessibility/disclosures, cancellation,
reduced-motion, isolation, and offline tests. Run focused tests and the existing
full suite without browser automation or screenshots. Manual iPhone evaluation
remains with the user. Do not commit or push.

**Status: Implemented for manual evaluation.** Native JavaScriptCore focused
tests pass **123/123** (25 tutorial, 24 Rules, 49 Digital Dice, 25 PWA), and the
complete automated suite passes **527/527**. The tests exercise the actual
tutorial controller alongside existing Rules, live app, dice, receipt, storage,
and worker doubles. Camera geometry is checked mathematically at representative
mobile/desktop widths; no browser automation, screenshots, or visual testing was
performed. Real gameplay modules, main styling, original artwork, and persistence
format remain unchanged. No commit or push was performed.

## Full Rules — Dedicated reference page

Move the complete illustrated rules and Additional Rules modal from the main
page to `/rules.html`. The main `#rules` section keeps only the unchanged
12-step tutorial and language selector; its existing meadow signpost still
navigates there. Remove the Full Rules disclosure, image wrapper, and modal from
index.html. Add a small, underlined FULL RULES / ALLE REGELN footer link in its
own grid row, preserving both original footer illustrations and their geometry.

The new static page uses the existing plain dark-blue canvas, fonts, 36rem
illustration maximum, responsive proportions, safe-area insets, selector artwork,
Additional Rules hit region, and accessible native modal. Show the illustration
immediately under a Full Rules / Alle Regeln h1. BACK TO GAME / ZURÜCK ZUM SPIEL
navigates normally to index.html, restoring progress through existing storage.
Do not load game, dice, tutorial, Challenge, or receipt components on this page.

Reuse one Rules controller and `frosty-dice.rules-language` on both pages.
Initialize illustrated functionality only where its elements exist. Publish
language changes to the existing tutorial/dice through a small DOM event, and
read initial language from the selected language control rather than the removed
Rules image. Refresh preferences on page-show/storage events, including Safari
Back restoration, while preserving current tutorial progress, animations, dice,
and game state. The bid reveal label reads the same selected control. Tutorial
scenes, camera, animation timings, explanations, and surprise mechanic stay intact.

Precache rules.html and the small new scoped stylesheet, align changed module
URLs at rules-page-1, and bump cache v29 to v30. Extend existing cached navigation
to keep Rules and game pages distinct offline, including query variants; preserve
installation, waiting activation, cache cleanup, and all existing artwork.

Add focused tests for main-page structure, standalone Rules initialization,
localization/normal navigation/Back-cache preference restoration, Additional Rules
accessibility, live game/Undo isolation, unchanged tutorial/dice behavior, responsive
CSS geometry, and offline navigation/resources. Run relevant automated tests without
browser automation or screenshots. Manual iPhone visual verification remains with
the user. Do not change game rules or persistence, and do not commit or push.

**Status: Implemented for manual evaluation.** Relevant native JavaScriptCore
tests pass **250/250**: 28 Rules, 26 tutorial, 49 Digital Dice, 114 app coordination,
6 meadow, and 27 PWA. Coverage includes restored German initialization without
the old image, cross-page preference changes and Safari Back-cache restoration,
live modal translation, saved board/Undo preservation, and distinct offline
documents. No browser automation or screenshots were used. Original artwork,
game rules, core gameplay/scoring/storage, tutorial scenes/styles/animation
timings, and the existing main stylesheet remain unchanged. No commit or push.

## Additional receipt artwork — Six uniform variants

Extend the existing receipt background collection with the unchanged receipt6.png
(Frosty Gardens) and receipt7.png (Frosty Charity Run). All six source files are
1440 × 3200 with matching alpha bounds; the two new designs retain the same
RECEIPT heading/separators, dynamic accounting area, barcode, and paper edges.
Reuse the existing layout without design-specific adjustments.

Keep the original uniform random choice on each closed-to-open transition, now
with a 1/6 probability per design and consecutive repeats permitted. Extend the
same image preloading and precache lists. All designs retain Challenge #01/#02
labels, shared values/history/scrolling/stickers/separator lines, animations, and
close behavior. Do not persist a design or alter game state, scoring, or artwork.

Bump cache v30 to v31 and align the receipt module and its importers at receipt-5;
other component changes are limited to those import/version references. Update
focused six-design selection, per-opening/repeat, accounting/history invariance,
preload, and offline tests. Do not run browser automation, commit, or push.

**Status: Implemented.** Relevant JavaScriptCore tests pass **69/69** (42 receipt,
27 PWA). The existing component, layout, animations, scoring, game state, and all
source PNGs remain unchanged; only the background collection/loading/cache lists
and matching module URL versions were extended. No commit or push.

## Optional 2P mode — Two opponents on one device

Add a compact 2P / 3P+ switch near the unchanged title, defaulting to classic and
remembering a separate mode preference. Keep the classic coordinator responsible
for the existing 4×7 game and expose only active-mode gating, progress, and a
read-only state snapshot for coordination/tests. Initialize both from a small
mode entry module; route shared Undo/Reset only to the active controller. Preserve
classic save version 8 and all existing mechanics and presentation.

Add independent pure 5×3 state, column scoring, and triangle calculations plus a
small 2P UI/storage module. Share dimension-independent orthogonal relationships,
cell cloning and the Prime Ice transition with classic; keep classic board constants,
A1/66 restrictions, error messages, Attack Ice, Streets, and scoring unchanged.
Reuse the existing repdigit multiplier without Street calculations in 2P.

Confirmed orientation: top Player 1 rotated 180°, bottom Player 2 upright. Start
in any local row-3 cell, physically nearest the owner. Use one centralized column
mapping (Player 1 reverses 0–4, Player 2 is identity) for five physical column duels.
Render ten permanently owned SVG triangles with score, owner-facing orientation,
positive-leader/tie illumination, and non-color lit markers. Reuse original ice art.

Persist independent boards and one exact pre-placement Undo under a versioned
2P key. Keep both mode saves when switching: it is allowed by the brief and avoids
fragile multi-key deletion transactions. Confirm switches with meaningful progress;
never write/clear during startup, and keep the active mode unchanged if preference
saving fails. Confirmed Reset clears only the active mode. Validate and safely
reject incompatible, corrupt, or impossible Undo snapshots.

Keep the shared digital dice component unchanged, retain the classic twelve-step
tutorial and Full Rules, and only make the tutorial's final focus follow the active
board. Translate new UI with the existing Rules event. Use owner-oriented inline
inputs, preserve pending tap targets on blur, and keep columns/triangles aligned
on narrow screens. No turns, passes, dice assignments, winner dialogs, board locks,
Challenge/receipt/Attack Ice/Street system in 2P, or new artwork/dependencies.

Document authoritative mode rules separately in two-player-rules.md. Precache new
modules/styles, align changed importers at two-player-1, and bump cache v31 to v32.
Preserve all existing assets, static pages, and service-worker lifecycle. Add pure
and DOM-double tests, then run the existing full suite without weakening classic
coverage. Manual iPhone checks cover input rotation, tap accuracy, triangle reading,
mode confirmation, active Reset/Undo, persistence/offline, and classic regression.
Do not commit or push.

**Status: Implemented for manual evaluation.** The full native JavaScriptCore
suite passes **588/588** (including 27 2P model/storage cases, 25 mode/UI integration
cases, and all existing classic coverage). Regressions exercise owner-local input,
ice/thaw/Undo, mode confirmation/cancellation/storage failure, retained independent
saves, active Reset, live Digital Dice rolling/collapse/selection, bilingual copy,
three-digit triangle scores, completed-board continuation, and offline resources.
Source checks confirm unchanged original assets, classic constants/scoring/save
format, Digital Dice, receipts, original CSS, tutorial scenes, Rules, manifest,
and worker lifecycle. Layout geometry is checked mathematically at narrow widths;
no browser automation or screenshots were used. Manual iPhone evaluation remains.
No commit or push was performed.

## 2P UI refinement — Compact mode dropdown and continuous playing surface

Replace the segmented switch with one compact active-mode button and chevron.
Reuse the existing mode manager's switching, confirmation, cancellation, and save
behavior. A checked two-option menu supports native button activation, arrows,
Home/End, Escape, outside taps and focus dismissal. Return confirmation/cancellation
focus to the visible trigger, and keep the title and other header controls unchanged.

Move player feedback beside the outer labels, keeping both existing owner-facing
orientations. Place the upper board, unchanged five-segment triangle strip, and
lower board consecutively with 6px gaps. Preserve all cell/triangle dimensions,
physical mappings, scoring and input behavior. Move the unchanged bilingual 2P
instructions into the Rules section immediately above How to Play, in normal flow,
hidden in classic mode. Leave meadow controls and the tutorial itself untouched.

Bump cache v32 to v33 and update only the changed mode UI module, 2P controller,
and stylesheet URLs to two-player-ui-1. Add focused dropdown, confirmation,
localization, placement/visibility, alignment and mobile-width geometry regressions;
run these alongside classic UI and PWA tests. Do not commit or push.

**Status: Implemented for manual evaluation.** Relevant JavaScriptCore tests pass
**175/175** (33 mode/UI, 114 classic coordination, 28 PWA). Added cases cover menu
activation/selection, arrows/Home/End/Escape, outside pointer/assistive clicks and
focus, confirmation cancellation, restored mode labels, translated instruction
visibility/location, and consecutive aligned board/strip structure. Geometry is
checked mathematically for 320–430px mobile widths and desktop; actual iPhone
rendering remains a manual check. No browser automation, screenshots, commit,
or push. Gameplay, scoring, persistence, instructions, original artwork, existing
CSS/header dimensions, tutorial, Digital Dice, and Rules page remain unchanged.

## 2P input refinement — Owner-oriented six-button keypad

Replace the 2P-only native numeric inputs with one floating six-button keypad
and a two-slot draft display. It follows the selected player's board, rotated
for top Player 1 and upright for bottom Player 2, without changing board or
triangle layout. A second digit immediately uses the existing guarded placement,
save, and Undo path. Invalid moves clear the draft but leave the keypad open;
selection changes, outside taps, Escape, and mode switching discard it. Keep the
classic 3P+ input unchanged. Update the mode importer and cached CSS/controller
URLs, and bump the service-worker cache to v35. Add focused 2P interaction,
orientation, dismissal, and classic regression tests; do not commit or push.

**Status: Implemented for manual evaluation.** The focused JavaScriptCore suite
passes **182/182** (40 mode/2P UI, 114 classic coordinator, 28 PWA); the full
suite passes **603/603**. Manual iPhone checks remain for owner-facing placement,
touch accuracy, and overlay fit.

## 2P Frosty Frontline — Shared physical number direction

In 2P only, use the existing physical-column reversal to make both boards
increase from the upright screen's left to right. Player 1's logical horizontal
comparison reverses; Player 2's stays the same. Preserve OR adjacency, vertical
equality, first row-3 placement, and Prime Ice. Accept older 2P saves and their
one-step Undo under the former Player 1 direction, while applying the new rule
to every new placement. Starting rows gain four owner-facing comparison signs
without changing cell dimensions or touch targets.

Replace ten triangle markers with one 112px SVG Frosty Frontline. Five points
share the actual physical column centers; vertical positions use Player 1's
score fraction and zero-score ties remain centered. A cubic baseline with a
conditional wave passes through all five points; equal-height neighbors stay
straight. Its filled ribbon grows from 5.1px to 23.8px left to right and joins
a separate right-pointing triangular arrow;
15px colored points indicate column leaders or ties. Fixed,
owner-facing numbers retain both exact column totals. Derive all display values
from the existing 2P column scorer. Animate score changes for 280ms unless
reduced motion is requested. Preserve the classic 3P+ view, game rules, storage
formats, and all unrelated components.

Precache the new pure geometry module and version changed 2P module/CSS URLs at
`frontline-1`; bump the service-worker cache from v35 to v36. Add 2P placement,
saved Undo, geometry, rendering, animation, responsive-center, and offline tests.
Do not commit or push.

**Status: Implemented for manual evaluation.** The full JavaScriptCore suite
passes **619/619**. Manual iPhone review remains for the curve, signs, touch
targets, and score label readability.

The follow-up New Game flow removes the header dropdown and uses the Reset
snowman to open a bilingual dialog. Starting a game clears only the selected
mode's save after confirmation when either mode has progress; the other save
remains. The Frontline arrow now uses a separate open SVG path that fills a
triangle over the ribbon's short shaft; its outline leaves no internal seam.
The decorative swing is zero for equal-height neighboring points. Version the
changed Frontline modules and CSS at `frontline-arrow-3` and the PWA cache at
v40. Gameplay and scoring remain unchanged.

The next visual pass removes the dynamic arrow and variable-width ribbon. A
uniform 8px stroked curve ends at the first and fifth scoring dots. Two fixed,
player-colored right-pointing arrows sit beneath the owner-facing scores in
the same 112px SVG. The five dots, score placement, curvature, and animation
remain unchanged. Version the 2P visual modules and CSS at
`frontline-guides-1` and the PWA cache at v41.

Move the arrows to the outer edges of the same SVG, between each board and its
score labels. Reduce each shaft from 4.5px to 3.25px and proportionally reduce
the heads. Keep their horizontal span, the curve, dots, boards, and score labels
fixed. Version the 2P visual assets at `frontline-guides-2` and cache at v42.

## Workflow

Read the specifications, implement the current scope, keep rules deterministic,
and align documentation with approved changes. Do not invent an unresolved
mechanic. Follow the user's testing and commit/push restrictions for each task.
