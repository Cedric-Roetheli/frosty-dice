import { canPlaceNumber, canUndo, cloneGameState, createGameState, freezeGameCell, getCell, hasReachedGoal, isValidGameState, placeGameNumber, undoLastMove } from "../js/game.js";
import { calculateScore, getScoreBreakdown } from "../js/scoring.js";
import { boardFixture, freezeBoardSnapshot } from "./fixtures.js";
import { assert, assertDeepEqual, assertEqual, assertThrows } from "./assert.js";

export function runUndoTests() {
  const results = [];
  function test(name, action) {
    try { action(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, message: error.message }); }
  }
  function moves(...entries) {
    return entries.reduce((state, [coordinate, value]) => placeGameNumber(state, coordinate, value), createGameState());
  }

  test("A fresh game has no Undo and an unavailable Undo leaves the state untouched", () => {
    const state = createGameState();
    assertEqual(state.undo, null);
    assert(!canUndo(state));
    assertEqual(undoLastMove(state), state);
  });

  test("A successful placement captures only the complete pre-placement board", () => {
    const state = moves(["A1", 16]);
    assert(canUndo(state));
    assertDeepEqual(state.undo, { board: boardFixture() });
    assertDeepEqual(Object.keys(state.undo), ["board"]);
    assertDeepEqual(state.board, boardFixture(["A1", 16]));
  });

  test("Undo of a normal last placement restores the exact board and previous score", () => {
    const before = moves(["A1", 16]);
    const after = placeGameNumber(before, "B1", 24);
    const restored = undoLastMove(after);
    assertDeepEqual(restored.board, before.board);
    assertEqual(calculateScore(after.board), 40);
    assertEqual(calculateScore(restored.board), 16);
    assertEqual(restored.undo, null);
  });

  test("Undo of a legacy A1=66 restores the empty board and removes its doubled 132 points", () => {
    const after = { board: boardFixture(["A1", 66]), undo: { board: boardFixture() } };
    assertEqual(calculateScore(after.board), 132);
    const restored = undoLastMove(after);
    assertDeepEqual(restored, createGameState());
    assertEqual(calculateScore(restored.board), 0);
  });

  test("Undo of a legal B1=66 removes its doubled points and restores the valid 65 start", () => {
    const before = placeGameNumber(createGameState(), "A1", 65);
    const after = placeGameNumber(before, "B1", 66);
    assertEqual(calculateScore(after.board), 197);
    const restored = undoLastMove(after);
    assertDeepEqual(restored, { board: before.board, undo: null });
    assertEqual(calculateScore(restored.board), 65);
  });

  test("Undo restores a boundary Street and its repdigit score after Attack Ice", () => {
    const before = { board: boardFixture(["A2", 55], ["B2", 56], ["C2", 61]), undo: null };
    assertEqual(calculateScore(before.board), 227);
    const complete = placeGameNumber(before, "D2", 62);
    assertEqual(calculateScore(complete.board), 578);
    assertDeepEqual(getScoreBreakdown(complete.board).streetRows, [2]);
    const restored = undoLastMove(complete);
    assertDeepEqual(restored.board, before.board);
    assertEqual(calculateScore(restored.board), 227);
    const iced = freezeGameCell(complete, "A2");
    assertEqual(calculateScore(iced.board), 289);
    assertDeepEqual(getScoreBreakdown(iced.board).streetRows, []);
    assertDeepEqual(undoLastMove(iced).board, complete.board);
    assertEqual(calculateScore(undoLastMove(iced).board), 578);
  });

  test("Undo A1=23, B1=31, A2=23 restores B1 frozen and removes newly frozen A2", () => {
    const before = moves(["A1", 23], ["B1", 31]);
    const after = placeGameNumber(before, "A2", 23);
    assertDeepEqual(getCell(after.board, "B1"), { value: 31, status: "thawed" });
    assertDeepEqual(getCell(after.board, "A2"), { value: 23, status: "frozen" });
    const restored = undoLastMove(after);
    assertDeepEqual(restored.board, before.board);
    assertDeepEqual(getCell(restored.board, "B1"), { value: 31, status: "frozen" });
    assertEqual(getCell(restored.board, "A2"), null);
    assert(!canPlaceNumber(restored.board, "C1", 46));
    assertEqual(calculateScore(restored.board), 23);
  });

  test("Undo preserves all damage that already existed before the last freeze moved", () => {
    const before = moves(["A1", 23], ["B1", 31], ["A2", 23]);
    const restored = undoLastMove(placeGameNumber(before, "C1", 41));
    assertDeepEqual(restored.board, before.board);
    assertDeepEqual(getCell(restored.board, "B1"), { value: 31, status: "thawed" });
    assertDeepEqual(getCell(restored.board, "A2"), { value: 23, status: "frozen" });
    assertEqual(getCell(restored.board, "C1"), null);
    assertEqual(calculateScore(restored.board), 23);
  });

  test("Undo removes a Street completed by the last placement and restores its prior numerator", () => {
    const before = moves(["A1", 11], ["B1", 12], ["C1", 13]);
    const complete = placeGameNumber(before, "D1", 14);
    assertEqual(calculateScore(complete.board), 122);
    assertDeepEqual(getScoreBreakdown(complete.board).streetRows, [1]);
    const restored = undoLastMove(complete);
    assertDeepEqual(restored.board, before.board);
    assertEqual(calculateScore(restored.board), 47);
    assertDeepEqual(getScoreBreakdown(restored.board).streetRows, []);
  });

  test("Undo of a D7 placement removes its goal and restores the previous board and score", () => {
    let before = createGameState();
    for (let row = 1; row <= 7; row += 1) before = placeGameNumber(before, "A" + row, 12);
    before = placeGameNumber(placeGameNumber(before, "B7", 24), "C7", 46);
    const reached = placeGameNumber(before, "D7", 55);
    assert(hasReachedGoal(reached.board));
    assertEqual(calculateScore(reached.board), 264);
    const restored = undoLastMove(reached);
    assert(!hasReachedGoal(restored.board));
    assertDeepEqual(restored.board, before.board);
    assertEqual(calculateScore(restored.board), 154);
  });

  test("Undo also restores a frozen D7 when the last move had thawed it into a goal", () => {
    let before = createGameState();
    for (let row = 1; row <= 7; row += 1) before = placeGameNumber(before, "A" + row, 12);
    for (const [coordinate, value] of [["B7", 24], ["C7", 41], ["D7", 53], ["B1", 13]]) {
      before = placeGameNumber(before, coordinate, value);
    }
    const reached = placeGameNumber(before, "C1", 23);
    assert(hasReachedGoal(reached.board));
    const restored = undoLastMove(reached);
    assertDeepEqual(restored.board, before.board);
    assertDeepEqual(getCell(restored.board, "D7"), { value: 53, status: "frozen" });
    assert(!hasReachedGoal(restored.board));
    assertEqual(calculateScore(restored.board), calculateScore(before.board));
  });

  test("Undo is consumed and never restores the older Undo that preceded the move", () => {
    const before = moves(["A1", 16], ["B1", 24]);
    assert(canUndo(before));
    const restored = undoLastMove(placeGameNumber(before, "C1", 46));
    assertDeepEqual(restored.board, before.board);
    assertEqual(restored.undo, null);
    assert(!canUndo(restored));
    assertEqual(undoLastMove(restored), restored);
  });

  test("The next successful placement after Undo creates a new single snapshot", () => {
    const restored = undoLastMove(moves(["A1", 16], ["B1", 24]));
    const next = placeGameNumber(restored, "B1", 26);
    assert(canUndo(next));
    assertDeepEqual(next.undo, { board: restored.board });
    assertDeepEqual(Object.keys(next.undo), ["board"]);
    assertDeepEqual(undoLastMove(next).board, restored.board);
  });

  test("Invalid, occupied, skipped, or incompatible placement attempts preserve the existing Undo", () => {
    const state = moves(["A1", 16]);
    const before = JSON.stringify(state);
    for (const [coordinate, value] of [["B1", 16], ["A2", 24], ["D7", 55], ["A1", 24], ["B1", 17]]) {
      assertThrows(() => placeGameNumber(state, coordinate, value));
      assertEqual(JSON.stringify(state), before);
      assert(canUndo(state));
    }
  });

  test("Snapshot records and rows do not share references with either current or previous states", () => {
    const before = moves(["A1", 23], ["B1", 31]);
    const expected = JSON.stringify(before.board);
    const after = placeGameNumber(before, "A2", 23);
    assert(after.undo.board !== before.board);
    assert(after.undo.board[0] !== before.board[0]);
    assert(after.undo.board[0][0] !== before.board[0][0]);
    assert(after.undo.board[0][1] !== after.board[0][1]);
    before.board[0][0].value = 24;
    assertEqual(JSON.stringify(after.undo.board), expected);
    assertEqual(JSON.stringify(undoLastMove(after).board), expected);
  });

  test("Placement and Undo work with immutable current boards and immutable snapshots", () => {
    const before = moves(["A1", 23], ["B1", 31]);
    freezeBoardSnapshot(before.board);
    freezeBoardSnapshot(before.undo.board);
    Object.freeze(before.undo);
    Object.freeze(before);
    const after = placeGameNumber(before, "A2", 23);
    freezeBoardSnapshot(after.board);
    freezeBoardSnapshot(after.undo.board);
    const restored = undoLastMove(after);
    assertDeepEqual(restored.board, before.board);
    assertEqual(getCell(after.board, "B1").status, "thawed");
    assertEqual(getCell(before.board, "B1").status, "frozen");
  });

  test("Cloning canonical state deep-copies both boards without storing derived values or drafts", () => {
    const state = moves(["A1", 23], ["B1", 31]);
    const cloned = cloneGameState({ ...state, score: 999, selectedCell: "A2", goal: true });
    assertDeepEqual(cloned, state);
    assert(cloned.board[0][0] !== state.board[0][0]);
    assert(cloned.undo.board[0][0] !== state.undo.board[0][0]);
    assertDeepEqual(Object.keys(cloned), ["board", "undo"]);
  });

  test("Recursive, unrelated, or illegally related Undo snapshots are rejected", () => {
    const before = boardFixture(["A1", 16]);
    const after = boardFixture(["A1", 16], ["B1", 24]);
    for (const undo of [{ board: before, undo: null }, { board: after }, { board: [] }, false]) {
      const state = { board: after, undo };
      assert(!isValidGameState(state));
      assert(!canUndo(state));
      assertThrows(() => undoLastMove(state), "valid game board");
    }
    assert(!isValidGameState({ board: boardFixture(["A1", 16], ["B1", 16]), undo: { board: before } }));
    assert(!isValidGameState({ board: boardFixture(["A1", 23], ["B1", 31]), undo: { board: boardFixture(["A1", 23]) } }));
  });

  return results;
}
