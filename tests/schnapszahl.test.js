import {
  confirmOwnRoll,
  createGameState,
  finishSchnapszahlAction,
  getCellValue,
  getExternalNumberTargets,
  getLegalTargetCells,
  isSchnapszahl,
  placeExternalNumber,
  placeOwnRollNumber,
  placeStolenNumber,
  prepareNextOwnRoll,
  removeOwnNumber,
} from "../js/game.js";
import { assert, assertDeepEqual, assertEqual, assertThrows } from "./assert.js";

function ownDouble(value = 11) {
  const die = value / 11;
  return placeOwnRollNumber(confirmOwnRoll(createGameState(), die, die), "A1", value);
}

function branchedGame() {
  let game = placeOwnRollNumber(confirmOwnRoll(createGameState(), 1, 6), "A1", 16);
  for (const [coordinate, value] of [["B1", 24], ["A2", 16], ["B2", 26]]) {
    game = placeExternalNumber(game, coordinate, value);
  }
  return game;
}

export function runSchnapszahlTests() {
  const results = [];
  function test(name, action) {
    try {
      action();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, message: error.message });
    }
  }

  test("All six Schnapszahlen are detected", () => {
    for (const value of [11, 22, 33, 44, 55, 66]) {
      assert(isSchnapszahl(value));
    }
  });

  test("Non-doubles and invalid values are not Schnapszahlen", () => {
    for (const value of [12, 16, 21, 26, 61, 0, 7, 77, 111, -11, 11.5, "11", null, NaN]) {
      assert(!isSchnapszahl(value));
    }
  });

  test("Confirming a double does not trigger the special action before placement", () => {
    const confirmed = confirmOwnRoll(createGameState(), 3, 3);
    assertEqual(confirmed.schnapszahlAction, null);
    assertEqual(confirmed.ownRollCount, 1);
  });

  test("Every legally placed own-roll Schnapszahl triggers one special action", () => {
    for (const value of [11, 22, 33, 44, 55, 66]) {
      const game = ownDouble(value);
      assertDeepEqual(game.schnapszahlAction, { value });
      assertEqual(getCellValue(game.board, "A1"), value);
      assertEqual(game.ownRollCount, 1);
    }
  });

  test("A non-double own placement does not trigger the special action", () => {
    const game = placeOwnRollNumber(confirmOwnRoll(createGameState(), 1, 6), "A1", 16);
    assertEqual(game.schnapszahlAction, null);
  });

  test("An unplaceable own Schnapszahl is a counted failure without a special action", () => {
    const board = placeExternalNumber(createGameState(), "A1", 66);
    const failed = confirmOwnRoll(board, 3, 3);
    assertEqual(failed.currentRoll.status, "failed");
    assertEqual(failed.schnapszahlAction, null);
    assertEqual(failed.ownRollCount, 1);
    assertThrows(() => placeOwnRollNumber(failed, "B1", 33), "finished roll");
  });

  test("An illegal own Schnapszahl placement attempt does not trigger the action", () => {
    const confirmed = confirmOwnRoll(createGameState(), 3, 3);
    assertThrows(() => placeOwnRollNumber(confirmed, "B1", 33), "first number");
    assertEqual(confirmed.schnapszahlAction, null);
    assertEqual(getCellValue(confirmed.board, "A1"), null);
    assertEqual(confirmed.ownRollCount, 1);
  });

  test("A Schnapszahl received through failed-roll takeover does not trigger the action", () => {
    for (const value of [11, 22, 33, 44, 55, 66]) {
      const game = placeExternalNumber(createGameState(), "A1", value);
      assertEqual(game.schnapszahlAction, null);
      assertEqual(game.ownRollCount, 0);
    }
  });

  test("Stolen-number targets reuse the core placement logic", () => {
    const game = ownDouble();
    assertDeepEqual(getExternalNumberTargets(game, 16), getLegalTargetCells(game.board, 16));
    assertDeepEqual(getExternalNumberTargets(game, 16), ["B1"]);
    assertDeepEqual(getExternalNumberTargets(game, 11), ["A2"]);
  });

  test("A legally placed stolen number updates the board without counting an own roll", () => {
    const original = ownDouble();
    const placed = placeStolenNumber(original, "B1", 16);
    assertEqual(getCellValue(placed.board, "B1"), 16);
    assertEqual(placed.ownRollCount, 1);
    assertEqual(placed.schnapszahlAction, null);
    assertEqual(getCellValue(original.board, "B1"), null);
    assertDeepEqual(original.schnapszahlAction, { value: 11 });
  });

  test("A stolen number must obey horizontal, vertical, and occupied-cell rules", () => {
    const game = ownDouble(22);
    assertThrows(() => placeStolenNumber(game, "B1", 16), "greater than 22");
    assertThrows(() => placeStolenNumber(game, "A2", 33), "match 22");
    assertThrows(() => placeStolenNumber(game, "A1", 33), "cannot be overwritten");
    assertEqual(game.ownRollCount, 1);
    assertDeepEqual(game.schnapszahlAction, { value: 22 });
    assertEqual(getCellValue(placeStolenNumber(game, "A2", 22).board, "A2"), 22);
  });

  test("A stolen Schnapszahl does not trigger another special action", () => {
    const game = placeStolenNumber(ownDouble(), "B1", 33);
    assertEqual(game.schnapszahlAction, null);
    assertEqual(game.ownRollCount, 1);
  });

  test("One Schnapszahl action cannot place more than one stolen number", () => {
    const game = placeStolenNumber(ownDouble(), "B1", 16);
    assertThrows(() => placeStolenNumber(game, "C1", 24), "own-roll Schnapszahl");
    assertEqual(getCellValue(game.board, "C1"), null);
    assertEqual(game.ownRollCount, 1);
  });

  test("Failed-roll takeover cannot authorize stolen-number placement", () => {
    const game = placeExternalNumber(createGameState(), "A1", 11);
    assertThrows(() => placeStolenNumber(game, "B1", 22), "own-roll Schnapszahl");
    assertEqual(game.ownRollCount, 0);
  });

  test("A non-double own roll cannot authorize stolen-number placement", () => {
    const game = placeOwnRollNumber(confirmOwnRoll(createGameState(), 1, 6), "A1", 16);
    assertThrows(() => placeStolenNumber(game, "B1", 22), "own-roll Schnapszahl");
  });

  test("An unusable stolen number adds nothing and can be dismissed as destroyed", () => {
    const game = ownDouble(66);
    const before = JSON.stringify(game.board);
    assertDeepEqual(getExternalNumberTargets(game, 11), []);
    assertThrows(() => placeStolenNumber(game, "B1", 11), "greater than 66");
    const finished = finishSchnapszahlAction(game);
    assertEqual(JSON.stringify(finished.board), before);
    assertEqual(finished.ownRollCount, 1);
    assertEqual(finished.schnapszahlAction, null);
  });

  test("Finishing an optional action changes neither the board nor own-roll count", () => {
    const game = ownDouble();
    const finished = finishSchnapszahlAction(game);
    assertDeepEqual(finished.board, game.board);
    assertEqual(finished.ownRollCount, 1);
    assertEqual(finished.schnapszahlAction, null);
    assertEqual(finishSchnapszahlAction(finished).ownRollCount, 1);
    assertEqual(prepareNextOwnRoll(finished).currentRoll, null);
  });

  test("An unfinished special action cannot be accidentally replaced by another flow", () => {
    const game = ownDouble();
    assertThrows(() => prepareNextOwnRoll(game), "Finish the Schnapszahl");
    assertThrows(() => placeExternalNumber(game, "B1", 16), "Finish the Schnapszahl");
    assertDeepEqual(game.schnapszahlAction, { value: 11 });
    assertEqual(game.ownRollCount, 1);
  });

  test("Removing an occupied cell clears exactly the selected cell", () => {
    const original = branchedGame();
    const removed = removeOwnNumber(original, "B1");
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        assertEqual(removed.board[row][column], row === 0 && column === 1 ? null : original.board[row][column]);
      }
    }
    assertEqual(getCellValue(original.board, "B1"), 24);
    assertEqual(removed.ownRollCount, 1);
  });

  test("Removing A1 leaves every downstream value untouched", () => {
    const original = branchedGame();
    const removed = removeOwnNumber(original, "A1");
    assertEqual(getCellValue(removed.board, "A1"), null);
    assertEqual(getCellValue(removed.board, "B1"), 24);
    assertEqual(getCellValue(removed.board, "A2"), 16);
    assertEqual(getCellValue(removed.board, "B2"), 26);
    assertEqual(removed.ownRollCount, 1);
  });

  test("Removing a supporting branch cell does not automatically remove its successor", () => {
    const removed = removeOwnNumber(branchedGame(), "A2");
    assertEqual(getCellValue(removed.board, "A2"), null);
    assertEqual(getCellValue(removed.board, "B2"), 26);
    assertEqual(removed.ownRollCount, 1);
  });

  test("Empty cells and repeated removal attempts cannot be removed", () => {
    const game = branchedGame();
    const before = JSON.stringify(game);
    assertThrows(() => removeOwnNumber(game, "A3"), "empty");
    assertEqual(JSON.stringify(game), before);
    const removed = removeOwnNumber(game, "B1");
    assertThrows(() => removeOwnNumber(removed, "B1"), "empty");
    assertEqual(removed.ownRollCount, 1);
  });

  test("Invalid removal coordinates cannot change state", () => {
    const game = branchedGame();
    for (const coordinate of ["A0", "A8", "E1", "a1", null]) {
      assertThrows(() => removeOwnNumber(game, coordinate), "A1 through D7");
    }
    assertEqual(game.ownRollCount, 1);
  });

  test("Removal cannot interrupt an unfinished own roll or special action", () => {
    const pending = confirmOwnRoll(createGameState(), 1, 6);
    assertThrows(() => removeOwnNumber(pending, "A1"), "Finish the current");
    const special = ownDouble();
    assertThrows(() => removeOwnNumber(special, "A1"), "Finish the current");
    assertEqual(getCellValue(special.board, "A1"), 11);
  });

  test("Stolen placement and single-cell removal do not mutate frozen input", () => {
    const original = ownDouble();
    original.board.forEach(Object.freeze);
    Object.freeze(original.board);
    Object.freeze(original.schnapszahlAction);
    Object.freeze(original);
    const stolen = placeStolenNumber(original, "B1", 16);
    stolen.board.forEach(Object.freeze);
    Object.freeze(stolen.board);
    Object.freeze(stolen);
    const removed = removeOwnNumber(stolen, "A1");
    assertEqual(getCellValue(original.board, "B1"), null);
    assertDeepEqual(original.schnapszahlAction, { value: 11 });
    assertEqual(getCellValue(stolen.board, "A1"), 11);
    assertEqual(getCellValue(removed.board, "A1"), null);
    assertEqual(getCellValue(removed.board, "B1"), 16);
    assertEqual(removed.ownRollCount, 1);
  });

  test("Finished actions do not retrigger from numbers already on the board", () => {
    const finished = finishSchnapszahlAction(ownDouble());
    const received = placeExternalNumber(finished, "B1", 33);
    assertEqual(received.schnapszahlAction, null);
    assertEqual(received.ownRollCount, 1);
  });

  test("A new own physical double can trigger a fresh special action", () => {
    const ready = prepareNextOwnRoll(finishSchnapszahlAction(ownDouble()));
    const confirmed = confirmOwnRoll(ready, 1, 1);
    const placed = placeOwnRollNumber(confirmed, "A2", 11);
    assertDeepEqual(placed.schnapszahlAction, { value: 11 });
    assertEqual(placed.ownRollCount, 2);
  });

  return results;
}
