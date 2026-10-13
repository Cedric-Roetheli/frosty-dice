# Frosty Dice — Game Rules

> This document is the source of truth for the redesigned game. Physical turns
> happen at the table; the website records one player's board.

## 1. Board

Each player has a 4 × 7 board with columns A–D and rows 1–7.

- Start: A1
- Goal: D7

An empty cell contains no number. An occupied cell has a two-digit dice number
and is normal, currently frozen, or previously frozen/thawed. There is at most
one currently frozen cell on a player's board.

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
thawed cells are usable; currently frozen cells are not.

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
cannot support placement. There is no isolated placement except the initial A1.
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

## 6. Streets

A Street is a complete horizontal A–D row of **four normal, never-frozen cells**
whose values are consecutive increasing integers.

11, 12, 13, 14 is a Street: its row sum of 50 contributes 100 points.
11, 13, 14, 15 is not a Street.

A currently frozen or thawed cell cannot complete or score a Street, even if its
stored value would otherwise fit the sequence. Incomplete rows and vertical
sequences are not Streets.
Each qualifying row receives its entire row sum a second time.

## 7. Score

**Score = sum of all normal, never-frozen occupied values + Street bonuses.**

There is no roll count or division by rolls. The same score applies regardless
of where the numbers came from. Currently frozen and thawed cells each contribute
0 and prevent their row from qualifying as a Street. A cell that has ever frozen
never regains its points.

All normal occupied cells count, without checking connectivity back to A1.
An empty board scores 0. Multiple Streets each receive their full bonus.

The player with the highest final score wins.

## 8. Goal

The player's goal is reached when D7 is legally filled **and is not frozen**.
An already present normal or thawed D7 counts as reached. A currently frozen D7
remains occupied but does not trigger goal detection. If a later freeze elsewhere
thaws D7, it becomes usable again and **does reach the goal**, even though it
permanently scores 0. No additional A1 connectivity check is required.

Only the new cell can freeze, so a later neighboring prime does not freeze an
existing normal D7 or undo its goal status.

This detects only the local player's goal. Global end-of-game timing remains
undecided.

## 9. Undo last successful move

Undo is a one-step input correction, not a physical turn or an action with a
cost. Occupied cells cannot be changed directly.

Immediately before a successful placement, capture a deep copy of the complete
board, including every value and normal/frozen/thawed status. Only a successful
placement replaces the one available snapshot. Invalid attempts, selection,
typing, and cancellation do not change it.

Undo restores that entire board exactly and consumes the snapshot. Do not
reverse individual freeze/thaw effects or infer a previous board from the
current numbers. Score, Streets, and local goal are recalculated from the
restored board. A cell thawed by the undone move returns to its earlier frozen
state, and a newly placed frozen cell disappears if it was previously empty.

There is no earlier Undo after consumption, no Redo, and no multi-step history.
A new successful placement creates one new snapshot. Persist it locally with
the current board so Undo survives reopening the page. Confirmed New Game /
Reset clears both boards. Undo itself is immediate and requires no confirmation;
it also discards any unsubmitted number-entry draft.

## 10. Open rule question

When a player reaches a normal or thawed D7, whether that player or the whole table stops
immediately, finishes the round, or continues has not yet been decided.

## 11. Scope

There is no digital dice roller, multiplayer synchronization, opponent state,
account system, or replacement special action for repeated-digit numbers.
