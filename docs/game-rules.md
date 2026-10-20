# Frosty Dice — Game Rules

> This document is the source of truth for the redesigned game. Physical turns
> happen at the table; the website records one player's board.

## 1. Board

Each player has a 4 × 7 board with columns A–D and rows 1–7.

- Start: A1
- Goal: D7

An empty cell contains no number. An occupied cell has a two-digit dice number
and has a normal, currently Prime-frozen, or previously Prime-frozen/thawed
status. There is at most one currently Prime-frozen cell on a player's board.
Attack Ice is a separate temporary overlay: at most one occupied cell may have
it, independently of the board's Prime Ice.

## 2. Physical turns and number formation

The active player rolls **four physical six-sided dice**, chooses two of them,
and may form a two-digit number from that chosen pair.

The **two unused dice are available to ALL other players**. Each other player
may form a number from that pair and enter it on their own board if legal.
Using the unused dice does not depend on the active player failing to place.

For two different dice values, either order is possible: 1 and 6 produce 16 or
61. Equal dice produce one distinct number: 3 and 3 produce 33. Each digit must
be from 1 through 6.

The app does not roll dice, track turns or rolls, record opponents, or distinguish
the origin of an entered number. Every entered number uses the same placement
and scoring rules. Repeated-digit numbers have no separate special action.

## 3. First placement

On a completely empty board, the first number must be placed at A1.

Once any cell is occupied, use the adjacency rules below, including for an
empty A1. Frozen and thawed cells still count as occupied when checking whether
the board is completely empty.

## 4. Legal placement

The target must be empty. On a nonempty board, at least one **usable, occupied,
immediately orthogonal neighbor** must support the new number. Normal and
thawed cells are usable unless covered by Attack Ice; currently Prime-frozen
and Attack-Iced cells are not usable.

- **Left:** the new value is strictly greater than the left value.
- **Right:** the new value is strictly smaller than the right value.
- **Upper:** the new value is exactly equal to the value above.
- **Lower:** the new value is exactly equal to the value below.

These conditions use **OR logic**. One valid relationship suffices; an
incompatible relationship with another occupied neighbor does not invalidate it.
Horizontal differences can be any positive amount, not only +1.

Examples:

- [16] [empty]: 24 may be placed to the right of a normal 16.
- [empty] [24]: 16 may be placed to the left of a normal 24.
- A normal 22 supports a new 22 immediately above or below it.
- With normal A2=16 and B1=24, B2=26 is legal through A2 despite the mismatch above.

Branching is allowed. Diagonal cells, farther-away cells, and frozen cells
cannot support placement. Attack-Iced cells also cannot support placement.
There is no isolated placement except the initial A1.
No connectivity check back to A1 is required; current usable neighbors determine
legality.

## 5. Prime freeze and thaw

The prime numbers that can occur as two-digit dice numbers are:

**11, 13, 23, 31, 41, 43, 53, 61**

First validate the placement using the current board and section 4, before any
cell thaws. An illegal attempt changes nothing: it neither freezes a new cell
nor thaws the existing frozen cell.

After a prime is legally placed, check its occupied orthogonal neighbors. If
at least one already contains a prime, **only the newly placed cell freezes
immediately**. If another cell is currently frozen anywhere on the board, that
previously frozen cell **thaws**. The freeze moves to the newly placed cell;
there can never be more than one currently frozen cell. Touching several primes
still triggers only this one freeze/thaw transition.

Prime contact is based on numeric value, including normal, currently frozen,
and thawed occupied primes. A frozen prime cannot support the placement itself,
so another usable neighbor must make it legal. The prime contact does not have
to be the relationship that made the placement legal. Existing normal primes
never freeze retroactively.

Currently frozen cells:

- Remain occupied and cannot be overwritten by a normal placement.
- Contribute 0 points.
- Cannot serve as usable neighbors for later placements.
- Retain their value and current frozen status in board state.

Thawed cells:

- Remain occupied and cannot be overwritten by a normal placement.
- Become usable orthogonal neighbors again, with the usual placement relations.
- Are permanently damaged and continue to contribute 0 points.
- Never become normal scoring cells again during that game.

Example:

- A1=23 is normal.
- A legal B1=31 touches A1 and freezes; A1 stays normal.
- A2=23 is legal using A1 and touches its prime value, so A2 freezes.
- B1 thaws, retains 31, and can support later placements, but scores 0 forever.

A prime with no occupied orthogonal prime neighbor stays normal and does not
thaw the current frozen cell. A non-prime never triggers freezing or thawing.
Diagonal prime contact does not cause freezing.

There is no stealing or number-removal action. Starting a confirmed new game
clears the board, including frozen and thawed cells.

## 6. Physical Challenges and Attack Ice

Instead of taking a normal turn, the active player may challenge any other
player. Both players secretly bid points on their own devices. A bid must be an
integer from **0 through that player's current available Score**, inclusive;
blank, negative, fractional, and unaffordable bids are invalid. Both players
spend their confirmed bids, regardless of the outcome. The challenger must bid
**strictly higher** to win; a tie favors the defender.

Before confirmation, closing the bid cancels without spending. Confirmation
spends the points once and locks the displayed bid for physical reveal. Closing
after confirmation does not refund it. Reopening starts a new bid.

- If the **challenger wins**, they may remove Attack Ice from their own board,
  if present, **AND** place Attack Ice on an eligible occupied cell of the
  losing player's board.
- If the **challenged player wins**, they choose **ONE**: remove Attack Ice
  from their own board, if present, **OR** place Attack Ice on an eligible
  occupied cell of the challenger's board.

Players compare their confirmed bids physically and the winner resolves the
Attack Ice consequences above using the existing manual Freeze/Unfreeze
controls. The app records only this player's point spending; it does not ask
for roles, compare bids, determine winners, apply Attack Ice automatically, or
track opponents, turns, permissions, or synchronization. There is no debt,
negative score, bid cooldown, or bid limit other than the available Score.

Attack Ice may cover a normal or Prime-thawed occupied cell, but never a
currently Prime-frozen cell or an empty cell. The number and underlying Prime
status remain unchanged. An Attack-Iced cell is occupied and cannot be
overwritten, cannot support placement, cannot complete a Street, and does not
currently reach the D7 goal. Its base points are unchanged: a normal cell still
scores its normal contribution, including repdigit doubling; a thawed cell
still scores 0.

Each board may have at most **one Attack Ice**. Freeze on another eligible cell
removes the old overlay and applies the new one as one atomic action. Unfreeze
removes only Attack Ice. Removal leaves no permanent damage: a normal cell
regains usability and Street eligibility; a thawed cell regains usability but
remains permanently scoreless and ineligible for Streets. Prime Ice and all
existing Prime freeze/thaw transitions remain unchanged. Attack-Iced primes
still count as occupied prime contact when a new prime is legally placed.

## 7. Streets

A Street is a complete horizontal A–D row of **four normal, never-Prime-frozen
cells without Attack Ice** containing four consecutive possible Frosty Dice
numbers in increasing order. Possible numbers have both digits from 1–6,
ordered as 11–16, 21–26, 31–36, 41–46, 51–56, 61–66. Thus **56 → 61** is
consecutive; impossible values 57–60 are skipped.

11, 12, 13, 14; 24, 25, 26, 31; and 55, 56, 61, 62 are Streets.
11, 13, 14, 15 and 55, 56, 62, 63 are not Streets because they skip a possible
number. Reverse and vertical sequences are not Streets.

A currently Prime-frozen, thawed, or Attack-Iced cell cannot complete or score
a Street, even if its stored value would otherwise fit the sequence. Incomplete rows and vertical
sequences are not Streets.
Each qualifying row adds its raw number sum once as a Street bonus. Repdigit
doubling applies only to the base cell contribution, not again to this bonus.
For 11, 12, 13, 14, base points are 22 + 12 + 13 + 14 = 61 and the Street bonus
is 11 + 12 + 13 + 14 = 50, for 111 points before bid spending.
Removing or moving Attack Ice restores that row's Street eligibility if its
current values and underlying statuses otherwise qualify.

## 8. Score

**Available Score = normal cell contributions + Street bonuses − confirmed bids,
with a minimum displayed Score of 0.**

Normal repdigits (Schnapszahlen) **11, 22, 33, 44, 55, and 66 score double**
their number: for example, 22 contributes 44 and 66 contributes 132. Other
normal numbers contribute their number. This is scoring only: no placement
change, special action, state, marker, or animation is attached to a repdigit.

There is no roll count or division by rolls. The same score applies regardless
of where the numbers came from. Currently frozen and thawed cells each contribute
0 and prevent their row from qualifying as a Street. A cell that has ever
Prime-frozen never regains its points.
This includes repdigits: a currently Prime-frozen or thawed 11 scores 0, while
a normal 11 scores 22.
Attack Ice leaves base points unchanged and only suppresses a qualifying row's
Street bonus while present. It never creates permanent zero-point damage.
A normal repdigit under Attack Ice retains its doubled contribution; an
Attack-Iced thawed repdigit still scores 0.

All normal occupied cells count, without checking connectivity back to A1.
An empty board scores 0. Multiple Streets each receive their full bonus.

The player with the highest final score wins.

## 9. Goal

The player's goal is reached when D7 is legally filled **and is usable**.
An already present normal or thawed D7 without Attack Ice counts as reached.
A currently Prime-frozen D7 remains occupied but does not trigger goal detection. If a later freeze elsewhere
thaws D7, it becomes usable again and **does reach the goal**, even though it
permanently scores 0. No additional A1 connectivity check is required.
Attack Ice on D7 temporarily suppresses goal detection. Removing or moving it
restores the goal if D7's underlying status qualifies.

Only the new cell can freeze, so a later neighboring prime does not freeze an
existing normal D7 or undo its goal status.

This detects only the local player's goal. Global end-of-game timing remains
undecided.

## 10. Undo last successful move

Undo is a one-step input correction, not a physical turn or an action with a
cost. Occupied values cannot be edited directly.

Immediately before a successful placement, Attack Freeze, Attack Unfreeze,
Attack Ice Move, or confirmed bid (including 0), capture a deep copy of the
complete board and point spending, including every value, normal/frozen/thawed
status, and Attack Ice overlay. Only a successful
state-changing action replaces the one available snapshot. Invalid attempts,
actions with no change, selection, typing, and cancellation do not change it.

Undo restores that entire board and point spending exactly and consumes the snapshot. Do not
reverse individual freeze/thaw effects or infer a previous board from the
current numbers. Score, Streets, and local goal are recalculated from the
restored board. A cell thawed by the undone move returns to its earlier frozen
state, and a newly placed frozen cell disappears if it was previously empty.

There is no earlier Undo after consumption, no Redo, and no multi-step history.
A new successful placement, Attack Ice action, or confirmed bid creates one new snapshot.
Persist it locally with the current board and spending so Undo survives reopening
the page. Confirmed New Game / Reset clears the board, spending, and Undo.
Opening, editing, cancelling, or rejecting a bid never changes Undo. Close the
Challenge dialog before using Undo; it is unavailable inside the dialog.
Undo itself is immediate and requires no confirmation;
it also discards any unsubmitted number-entry draft or open cell action.

## 11. Open rule question

When a player reaches a usable D7, whether that player or the whole table stops
immediately, finishes the round, or continues has not yet been decided.

## 12. Scope

There is no digital dice roller, multiplayer synchronization, opponent state,
account system, or replacement special action for repeated-digit numbers.
