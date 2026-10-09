import {
  canPlaceNumber,
  confirmOwnRoll,
  createEmptyBoard,
  createGameState,
  getCellValue,
  getLegalTargetCells,
  hasReachedGoal,
  placeExternalNumber,
  placeNumber,
  placeOwnRollNumber,
  placeStolenNumber,
  removeOwnNumber,
} from "../js/game.js";
import { assert, assertEqual, assertThrows } from "./assert.js";

function goalReadyGame() {
  let game = createGameState();
  for (let row = 1; row <= 7; row += 1) {
    game = placeExternalNumber(game, `A${row}`, 16);
  }
  game = placeExternalNumber(game, "B7", 24);
  return placeExternalNumber(game, "C7", 35);
}

export function runGoalTests() {
  const results = [];
  function test(name, action) {
    try {
      action();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, message: error.message });
    }
  }

  test("Empty D7 means the goal is not reached", () => {
    assert(!hasReachedGoal(createEmptyBoard()));
    assert(!hasReachedGoal(goalReadyGame().board));
  });

  test("A number already present in D7 means goal reached without an A1 connection", () => {
    const board = createEmptyBoard();
    board[6][3] = 16;
    assert(hasReachedGoal(board));
    assertEqual(getCellValue(board, "A1"), null);
  });

  test("Normal guarded legal placement in D7 reaches the goal", () => {
    const game = goalReadyGame();
    assert(canPlaceNumber(game.board, "D7", 46));
    const placed = placeNumber(game.board, "D7", 46);
    assert(hasReachedGoal(placed));
    assert(!hasReachedGoal(game.board));
  });

  test("An own roll reaches the goal only after its actual legal D7 placement", () => {
    const confirmed = confirmOwnRoll(goalReadyGame(), 4, 6);
    assert(!hasReachedGoal(confirmed.board));
    const placed = placeOwnRollNumber(confirmed, "D7", 46);
    assert(hasReachedGoal(placed.board));
    assertEqual(placed.ownRollCount, 1);
  });

  test("An opponent's failed-roll number can reach D7 without adding an own roll", () => {
    const placed = placeExternalNumber(goalReadyGame(), "D7", 46);
    assert(hasReachedGoal(placed.board));
    assertEqual(placed.ownRollCount, 0);
  });

  test("A stolen number can reach D7 without adding another own roll", () => {
    const confirmed = confirmOwnRoll(goalReadyGame(), 3, 3);
    const special = placeOwnRollNumber(confirmed, "B1", 33);
    assert(!hasReachedGoal(special.board));
    const stolen = placeStolenNumber(special, "D7", 46);
    assert(hasReachedGoal(stolen.board));
    assertEqual(stolen.ownRollCount, 1);
    assertEqual(stolen.schnapszahlAction, null);
  });

  test("Removing A1 or D7's former predecessor does not undo an occupied goal", () => {
    let game = placeExternalNumber(goalReadyGame(), "D7", 46);
    game = removeOwnNumber(game, "A1");
    assert(hasReachedGoal(game.board));
    game = removeOwnNumber(game, "C7");
    assert(hasReachedGoal(game.board));
    assertEqual(getCellValue(game.board, "D7"), 46);
  });

  test("Removing D7 means the goal is no longer currently detected", () => {
    const reached = placeExternalNumber(goalReadyGame(), "D7", 46);
    const removed = removeOwnNumber(reached, "D7");
    assert(!hasReachedGoal(removed.board));
    assertEqual(getCellValue(removed.board, "D7"), null);
    assert(hasReachedGoal(reached.board));
  });

  test("An active predecessor disconnected from A1 can support reaching D7", () => {
    let game = removeOwnNumber(goalReadyGame(), "A1");
    assertEqual(getCellValue(game.board, "C7"), 35);
    assert(getLegalTargetCells(game.board, 46).includes("D7"));
    game = placeExternalNumber(game, "D7", 46);
    assert(hasReachedGoal(game.board));
    assertEqual(getCellValue(game.board, "A1"), null);
  });

  test("Remaining cells still support immediate horizontal and vertical placements", () => {
    let game = placeExternalNumber(createGameState(), "A1", 16);
    game = placeExternalNumber(game, "B1", 24);
    game = removeOwnNumber(game, "A1");
    assert(canPlaceNumber(game.board, "C1", 46));
    assert(canPlaceNumber(game.board, "B2", 24));
    assertEqual(getCellValue(placeExternalNumber(game, "C1", 46).board, "C1"), 46);
    assertEqual(getCellValue(placeExternalNumber(game, "B2", 24).board, "B2"), 24);
  });

  test("Legally replacing a removed D7 detects the goal again", () => {
    let game = placeExternalNumber(goalReadyGame(), "D7", 46);
    game = removeOwnNumber(game, "D7");
    assert(!hasReachedGoal(game.board));
    game = placeExternalNumber(game, "D7", 54);
    assert(hasReachedGoal(game.board));
  });

  test("Goal detection is a pure read of frozen board data", () => {
    const game = placeExternalNumber(goalReadyGame(), "D7", 46);
    const before = JSON.stringify(game.board);
    game.board.forEach(Object.freeze);
    Object.freeze(game.board);
    assert(hasReachedGoal(game.board));
    assert(hasReachedGoal(game.board));
    assertEqual(JSON.stringify(game.board), before);
    assertThrows(() => hasReachedGoal([]), "seven rows");
  });

  return results;
}
