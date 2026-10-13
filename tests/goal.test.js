import { createEmptyBoard, getCell, getLegalTargetCells, hasReachedGoal, placeNumber } from "../js/game.js";
import { calculateScore } from "../js/scoring.js";
import { boardFixture, freezeBoardSnapshot } from "./fixtures.js";
import { assert, assertDeepEqual, assertEqual, assertThrows } from "./assert.js";

function goalReadyBoard(primeNeighbor = false) {
  let board = createEmptyBoard();
  for (let row = 1; row <= 7; row += 1) board = placeNumber(board, `A${row}`, 12);
  board = placeNumber(board, "B7", 24);
  return placeNumber(board, "C7", primeNeighbor ? 41 : 46);
}

export function runGoalTests() {
  const results = [];
  function test(name, action) {
    try { action(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, message: error.message }); }
  }

  test("Empty D7 does not reach the goal", () => {
    assert(!hasReachedGoal(createEmptyBoard()));
    assert(!hasReachedGoal(goalReadyBoard()));
  });

  test("An occupied normal D7 reaches the goal without checking A1 connectivity", () => {
    assert(hasReachedGoal(boardFixture(["D7", 53])));
    assert(!hasReachedGoal(boardFixture(["D7", 53, "frozen"])));
    assert(hasReachedGoal(boardFixture(["D7", 53, "thawed"])));
  });

  test("Legally placing a non-frozen prime in D7 reaches the goal", () => {
    const board = goalReadyBoard();
    assert(getLegalTargetCells(board, 53).includes("D7"));
    const placed = placeNumber(board, "D7", 53);
    assertDeepEqual(getCell(placed, "D7"), { value: 53, status: "normal" });
    assert(hasReachedGoal(placed));
    assert(!hasReachedGoal(board));
  });

  test("Legally placing a frozen prime in D7 does not reach the goal", () => {
    const placed = placeNumber(goalReadyBoard(true), "D7", 53);
    assertDeepEqual(getCell(placed, "D7"), { value: 53, status: "frozen" });
    assert(!hasReachedGoal(placed));
  });

  test("Frozen neighbors cannot enable illegal D7 placement or goal detection", () => {
    const board = boardFixture(["C7", 53, "frozen"]);
    assert(!getLegalTargetCells(board, 61).includes("D7"));
    assertThrows(() => placeNumber(board, "D7", 61), "usable occupied");
    assert(!hasReachedGoal(board));
  });

  test("A later adjacent prime freezes itself and leaves a normal D7 goal intact", () => {
    let board = placeNumber(goalReadyBoard(), "D7", 53);
    board = placeNumber(board, "C6", 46);
    board = placeNumber(board, "D6", 53);
    assertDeepEqual(getCell(board, "D6"), { value: 53, status: "frozen" });
    assertDeepEqual(getCell(board, "D7"), { value: 53, status: "normal" });
    assert(hasReachedGoal(board));
  });

  test("Goal detection reads immutable snapshots and validates input", () => {
    const board = freezeBoardSnapshot(placeNumber(goalReadyBoard(), "D7", 53));
    const before = JSON.stringify(board);
    assert(hasReachedGoal(board));
    assertEqual(JSON.stringify(board), before);
    assertThrows(() => hasReachedGoal([]), "seven rows");
  });

  test("A later freeze elsewhere thaws D7 and reaches the goal without restoring its points", () => {
    const frozenGoal = placeNumber(goalReadyBoard(true), "D7", 53);
    assert(!hasReachedGoal(frozenGoal));
    const thawedGoal = placeNumber(placeNumber(frozenGoal, "B1", 13), "C1", 23);
    assertDeepEqual(getCell(thawedGoal, "D7"), { value: 53, status: "thawed" });
    assertDeepEqual(getCell(thawedGoal, "C1"), { value: 23, status: "frozen" });
    assert(hasReachedGoal(thawedGoal));
    assertEqual(calculateScore(thawedGoal), 162);
    assert(getLegalTargetCells(thawedGoal, 53).includes("D6"));
    assertThrows(() => placeNumber(thawedGoal, "D7", 53), "cannot be overwritten");
    assert(!hasReachedGoal(frozenGoal));
  });

  return results;
}
