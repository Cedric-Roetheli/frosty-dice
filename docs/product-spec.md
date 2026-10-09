# Frosty Dice — V1 Product Specification

## 1. Product vision

Frosty Dice V1 is a **mobile-first web companion for people playing together at the same physical table**.

It replaces each player's paper game sheet.

It does not replace:

- the physical dice;
- face-to-face communication;
- the social interaction between players.

Every player opens Frosty Dice independently on their own phone and manages only their own board.

## 2. V1 scope

### In scope

The website should:

- Display the player's 4 × 7 Frosty Dice board
- Record every roll made by that player
- Convert two dice values into the possible two-digit numbers
- Determine legal placements
- Help the player choose a legal placement
- Detect failed rolls
- Track the number of the player's own rolls
- Allow numbers from opponents' failed rolls to be entered without increasing the own-roll divisor
- Detect Schnapszahlen
- Support entry of a legally usable stolen number
- Allow a player to remove a number from their own board when an opponent steals/destroys it
- Detect streets
- Calculate the player's score
- Detect progress toward D7 according to the confirmed rules
- Save the current game locally on the device
- Restore the game after refresh/reopening
- Allow the player to deliberately start a new game/reset
- Work well on modern phone browsers
- Be deployable on GitHub Pages

### Explicitly out of scope for V1

Do not build:

- User accounts
- Login
- Backend/server
- Database
- Online multiplayer
- Game rooms or lobby codes
- Device-to-device synchronization
- Opponent boards
- Opponent roll tracking
- Chat
- Matchmaking
- Cloud saves
- Push notifications
- Native iOS or Android apps
- App Store or Play Store distribution
- A digital dice roller unless explicitly requested later

## 3. Device model

Each device knows only about its own player.

For example, in a four-player game:

- Player A's phone stores only Player A's state.
- Player B's phone stores only Player B's state.
- Player C's phone stores only Player C's state.
- Player D's phone stores only Player D's state.

Communication between devices is performed by the humans at the table.

Example:

1. Player A has a failed roll.
2. Player A says the available numbers aloud.
3. Player B can use one.
4. Player B selects the “take failed roll” action on their own phone and enters the number.

No network synchronization is required.

## 4. Primary player flows

### 4.1 Start a game

The player opens the website.

They can:

- Continue an existing locally saved game, if one exists; or
- Start a new game.

Starting a new game clears the previous local game after confirmation.

### 4.2 Own roll

This is the main action.

Flow:

1. Player physically rolls two dice.
2. Player enters both dice values on their phone.
3. The website generates the possible two-digit values.
4. The website determines all legal placement options.
5. Legal choices are clearly shown.
6. The player selects the desired number/field combination.
7. The board updates.
8. The own-roll count updates exactly once for that physical roll.
9. Score and special states update.

If no generated number can legally be placed, the website identifies the roll as a failed roll.

A failed own roll still counts as an own roll for the divisor.

### 4.3 Take an opponent's failed roll

The player chooses a secondary action such as “Take failed roll”.

Flow:

1. Player enters the number announced by the opponent.
2. The website checks legal placement options.
3. The player chooses a legal field.
4. The number is added to the board.
5. The player's own-roll count does not increase.

The website does not need to record which opponent produced the number.

### 4.4 Schnapszahl

When an own roll creates a Schnapszahl and that Schnapszahl is legally placed:

1. The website recognizes the Schnapszahl.
2. The website informs the player that the special action is available.
3. The player verbally chooses a number on an opponent's physical/device board.
4. The opponent removes that number on their own device.
5. If the active player can legally use the stolen number, they may enter it through a secondary “stolen number” flow.
6. If it cannot be legally placed, nothing is entered on the active player's board; the opponent's number remains destroyed.

The stolen number does not add an own roll to the divisor.

### 4.5 A number is stolen from me

The player needs a controlled way to remove an occupied cell from their own board because an opponent used a Schnapszahl against them.

The UI should make accidental deletion difficult.

Suggested interaction:

1. Select an occupied cell.
2. Choose “Number stolen / remove”.
3. Confirm the destructive action.
4. Update the board, then recalculate derived information once the corresponding
   rules and implementation milestones are complete.

The consequences for disconnected branches are still an open game-rule question and must follow `game-rules.md` once decided.

Milestone 5 clears only the confirmed cell and preserves all other values and
the own-roll count. It does not implement connectivity consequences, scoring,
streets, or goal behavior.

## 5. Main screen

The main game screen should prioritize the board.

Suggested hierarchy:

1. Compact game status / score
2. 4 × 7 board
3. Primary “own roll” input
4. Secondary actions
5. Small access point for rules/help and reset

The screen should feel like a game sheet, not like an administration dashboard.

### Board

The board should:

- Clearly label columns A–D and rows 1–7
- Make A1 and D7 identifiable
- Display entered two-digit values clearly
- Make tappable/legal target cells obvious during placement
- Distinguish selected state from ordinary occupied cells
- Highlight completed streets without making values harder to read
- Work comfortably on a narrow phone screen

## 6. Dice input UX

The player should not have to type arbitrary two-digit values for an own roll.

Prefer a fast input designed around dice values 1–6.

Possible implementations include:

- Two compact 1–6 selectors
- Two rows of dice-value buttons

The exact visual design can be iterated, but entering a physical roll should require very few taps.

After input, show the resulting number option(s) and legal placements.

## 7. Feedback and validation

The website should explain why an action cannot be completed.

Examples:

- “26 cannot be placed on your current board.”
- “Vertical placements must match the number above.”
- “Horizontal placements must be greater than the number to the left.”
- “No legal placement — failed roll.”

Avoid silent failure.

## 8. Scoring display

The current score should be visible during play unless playtesting later suggests hiding it improves the game.

The UI should make clear:

- Current score
- Number of own counted rolls
- Street bonuses, when present

Do not require the player to calculate the score manually.

All numbers currently present count toward the numerator, including disconnected
cells and numbers received or stolen from opponents. Complete horizontal Street
rows contribute twice their row sum. Only own counted rolls form the divisor;
when that count is zero, display a score of 0. Placements, removals, and confirmed
own rolls immediately update the derived display.

## 9. Local persistence

The current game should automatically persist on the player's device using `localStorage`.

Refreshing or closing the browser should not normally lose the game.

No data should leave the device in V1.

## 10. Mobile-first requirements

Design for phone use first.

Important characteristics:

- Large touch targets
- Clear two-digit numbers
- Minimal typing
- No essential hover interactions
- No horizontal page scrolling
- Strong readability in portrait orientation
- Fast interactions while sitting at a table
- Reasonable support for both iPhone Safari and Android Chrome

Desktop support is useful but secondary.

## 11. Deployment

The project should remain compatible with GitHub Pages.

The first public/test release can be hosted directly from the GitHub repository.

Use relative asset paths and avoid assumptions that require a custom server.

## 12. Future possibilities — not V1 commitments

Possible later enhancements include:

- Installable PWA behavior
- Offline caching
- Better animations and sound
- Game history/statistics
- Online rooms
- Synchronized boards
- Automatic opponent interactions
- Native app packaging

These are ideas only. They should not influence V1 architecture unless there is a simple, concrete reason.
