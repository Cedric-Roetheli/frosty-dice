import {
  applyAttackIce, canApplyAttackIce, canPlaceNumber, canUndo, cloneBoard, cloneGameState,
  createGameState, freezeGameCell, getCell, getLegalTargetCells, hasReachedGoal,
  isCellAttackIced, isCellOccupied, isCellUsable, isValidBoard, isValidBoardCell,
  isValidGameState, placeGameNumber, placeNumber, removeAttackIce, undoLastMove, unfreezeGameCell,
} from "../js/game.js";
import { calculateScore, getScoreBreakdown, isStreetRow } from "../js/scoring.js";
import { boardFixture, freezeBoardSnapshot, placedBoard } from "./fixtures.js";
import { assert, assertDeepEqual, assertEqual, assertThrows } from "./assert.js";

export function runAttackIceTests() {
  const results = [];
  function test(name, action) {
    try { action(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, message: error.message }); }
  }
  function primeState() {
    return [["A1", 23], ["B1", 31], ["A2", 23]].reduce(
      (state, [coordinate, value]) => placeGameNumber(state, coordinate, value), createGameState());
  }
  function streetBoard() {
    return placedBoard(["A1", 11], ["B1", 12], ["C1", 13], ["D1", 14]);
  }

  test("Attack Ice is an independent overlay on an unchanged normal value/status", () => {
    const original = boardFixture(["A1", 16]);
    const iced = applyAttackIce(original, "A1");
    assertDeepEqual(getCell(iced, "A1"), { value: 16, status: "normal", attackIce: true });
    assert(isCellAttackIced(iced, "A1"));
    assert(isCellOccupied(iced, "A1"));
    assert(!isCellUsable(iced, "A1"));
    assertDeepEqual(original, boardFixture(["A1", 16]));
    const restored = removeAttackIce(iced, "A1");
    assertDeepEqual(restored, original);
    assert(isCellUsable(restored, "A1"));
    assertEqual(calculateScore(iced), 16);
    assertEqual(calculateScore(restored), 16);
  });

  test("Attack Ice on a thawed cell preserves permanent damage and restores only usability", () => {
    const original = primeState().board;
    const iced = applyAttackIce(original, "B1");
    assertDeepEqual(getCell(iced, "B1"), { value: 31, status: "thawed", attackIce: true });
    assert(!isCellUsable(iced, "B1"));
    assert(!canPlaceNumber(iced, "C1", 46));
    assertEqual(calculateScore(iced), 23);
    const restored = removeAttackIce(iced, "B1");
    assertDeepEqual(restored, original);
    assert(isCellUsable(restored, "B1"));
    assert(canPlaceNumber(restored, "C1", 46));
    assertEqual(calculateScore(restored), 23);
    assertDeepEqual(getCell(restored, "A2"), { value: 23, status: "frozen" });
  });

  test("Currently Prime-frozen cells cannot receive Attack Ice or disturb an existing overlay/Undo", () => {
    const state = freezeGameCell(primeState(), "B1");
    const before = JSON.stringify(state);
    assert(!canApplyAttackIce(state.board, "A2"));
    assertThrows(() => freezeGameCell(state, "A2"), "normal or thawed occupied");
    assertEqual(JSON.stringify(state), before);
    assert(canUndo(state));
    assert(isCellAttackIced(state.board, "B1"));
  });

  test("Empty cells and invalid coordinates cannot receive Attack Ice", () => {
    const state = primeState();
    for (const coordinate of ["C1", "D7", "E1", "A0", null]) {
      assertThrows(() => freezeGameCell(state, coordinate));
    }
    assertDeepEqual(state, primeState());
  });

  test("A board can hold one Prime Ice and one Attack Ice, but never two Attack overlays", () => {
    const board = applyAttackIce(primeState().board, "B1");
    assert(isValidBoard(board));
    board[0][0].attackIce = true;
    assert(!isValidBoard(board));
    assertThrows(() => applyAttackIce(board, "A1"));
  });

  test("Prime Ice and Attack Ice cannot coexist on the same cell", () => {
    assert(!isValidBoardCell({ value: 31, status: "frozen", attackIce: true }));
    const board = boardFixture(["B1", 31, "frozen"]);
    board[0][1].attackIce = true;
    assert(!isValidBoard(board));
  });

  test("Attack flags must be boolean and canonical copies omit a false overlay", () => {
    for (const attackIce of [null, "true", 1, {}, []]) {
      assert(!isValidBoardCell({ value: 16, status: "normal", attackIce }));
    }
    const board = boardFixture(["A1", 16]);
    board[0][0].attackIce = false;
    assert(isValidBoard(board));
    assertDeepEqual(cloneBoard(board), boardFixture(["A1", 16]));
  });

  test("Freezing a second cell atomically moves the single overlay without Prime transitions", () => {
    const original = primeState();
    const first = freezeGameCell(original, "B1");
    const moved = freezeGameCell(first, "A1");
    assertEqual(moved.board.flat().filter((cell) => cell?.attackIce).length, 1);
    assertDeepEqual(getCell(moved.board, "A1"), { value: 23, status: "normal", attackIce: true });
    assertDeepEqual(getCell(moved.board, "B1"), { value: 31, status: "thawed" });
    assertDeepEqual(getCell(moved.board, "A2"), { value: 23, status: "frozen" });
    assertDeepEqual(moved.undo, { board: first.board });
    assert(isValidGameState(moved));
    assertDeepEqual(original, primeState());
  });

  test("Get/clone operations retain Attack Ice and isolate cell records", () => {
    const board = applyAttackIce(boardFixture(["A1", 16]), "A1");
    const cell = getCell(board, "A1");
    delete cell.attackIce;
    assert(isCellAttackIced(board, "A1"));
    const cloned = cloneBoard(board);
    assertDeepEqual(cloned, board);
    delete cloned[0][0].attackIce;
    assert(isCellAttackIced(board, "A1"));
  });

  test("Attack operations and Undo work on immutable current boards and snapshots", () => {
    const original = primeState();
    freezeBoardSnapshot(original.board);
    freezeBoardSnapshot(original.undo.board);
    Object.freeze(original.undo);
    Object.freeze(original);
    const iced = freezeGameCell(original, "B1");
    freezeBoardSnapshot(iced.board);
    freezeBoardSnapshot(iced.undo.board);
    assertDeepEqual(undoLastMove(iced).board, original.board);
    assertDeepEqual(unfreezeGameCell(iced, "B1").board, original.board);
  });

  for (const [neighbor, value, target, newValue] of [
    ["A1", 16, "B1", 24], ["B1", 24, "A1", 16],
    ["A1", 22, "A2", 22], ["A2", 22, "A1", 22],
  ]) {
    test("Attack Ice blocks placement through " + neighbor + " to " + target + " and removal restores it", () => {
      const board = boardFixture([neighbor, value]);
      assert(canPlaceNumber(board, target, newValue));
      const iced = applyAttackIce(board, neighbor);
      assert(!canPlaceNumber(iced, target, newValue));
      assert(!getLegalTargetCells(iced, newValue).includes(target));
      assertThrows(() => placeNumber(iced, target, newValue));
      assert(canPlaceNumber(removeAttackIce(iced, neighbor), target, newValue));
    });
  }

  test("Attack Ice remains occupied and never allows an A1 restart or overwrite", () => {
    const board = applyAttackIce(boardFixture(["B1", 24]), "B1");
    assert(!canPlaceNumber(board, "A1", 16));
    assertThrows(() => placeNumber(board, "B1", 46), "cannot be overwritten");
  });

  test("An independent usable OR connection still permits placement beside Attack Ice", () => {
    const board = applyAttackIce(boardFixture(["A1", 16], ["B1", 24], ["A2", 16]), "B1");
    assert(canPlaceNumber(board, "B2", 26));
    assert(getLegalTargetCells(board, 26).includes("B2"));
    const placed = placeNumber(board, "B2", 26);
    assertDeepEqual(getCell(placed, "B2"), { value: 26, status: "normal" });
    assert(isCellAttackIced(placed, "B1"));
  });

  test("Attack-Iced primes still trigger Prime contact after another neighbor validates placement", () => {
    const board = applyAttackIce(boardFixture(["A2", 16], ["B1", 31], ["D7", 53, "frozen"]), "B1");
    const placed = placeNumber(board, "B2", 23);
    assertDeepEqual(getCell(placed, "B2"), { value: 23, status: "frozen" });
    assertDeepEqual(getCell(placed, "D7"), { value: 53, status: "thawed" });
    assertDeepEqual(getCell(placed, "B1"), { value: 31, status: "normal", attackIce: true });
  });

  test("An illegal attempt cannot thaw Prime Ice or alter Attack Ice", () => {
    const state = freezeGameCell(primeState(), "B1");
    const saved = JSON.stringify(state);
    assertThrows(() => placeGameNumber(state, "C1", 41));
    assertEqual(JSON.stringify(state), saved);
  });

  test("Attack Ice on a normal value retains the complete base sum", () => {
    const board = applyAttackIce(boardFixture(["A1", 23], ["B1", 24], ["C3", 31, "thawed"]), "B1");
    assertDeepEqual(getScoreBreakdown(board), { baseSum: 47, streetBonus: 0, streetRows: [], score: 47 });
  });

  test("Attack Ice suppresses only a Street bonus and removing it fully restores the Street", () => {
    const original = streetBoard();
    assert(isStreetRow(original[0]));
    const iced = applyAttackIce(original, "B1");
    assert(!isStreetRow(iced[0]));
    assertDeepEqual(getScoreBreakdown(iced), { baseSum: 61, streetBonus: 0, streetRows: [], score: 61 });
    const restored = removeAttackIce(iced, "B1");
    assert(isStreetRow(restored[0]));
    assertEqual(calculateScore(restored), 111);
  });

  test("Moving Attack Ice restores the previous Street and suppresses the new row's Street", () => {
    const board = boardFixture(["A1", 11], ["B1", 12], ["C1", 13], ["D1", 14],
      ["A2", 21], ["B2", 22], ["C2", 23], ["D2", 24]);
    assertEqual(calculateScore(board), 313);
    const iced = applyAttackIce(board, "B1");
    assertDeepEqual(getScoreBreakdown(iced).streetRows, [2]);
    assertEqual(calculateScore(iced), 263);
    const moved = applyAttackIce(iced, "B2");
    assertDeepEqual(getScoreBreakdown(moved).streetRows, [1]);
    assertEqual(calculateScore(moved), 223);
    assertEqual(getScoreBreakdown(moved).baseSum, 173);
    assertEqual(calculateScore(removeAttackIce(moved, "B2")), 313);
  });

  test("Removing Attack Ice never repairs a thawed row's Street eligibility", () => {
    const board = streetBoard();
    board[0][2].status = "thawed";
    const restored = removeAttackIce(applyAttackIce(board, "C1"), "C1");
    assertDeepEqual(restored, board);
    assert(!isStreetRow(restored[0]));
    assertEqual(calculateScore(restored), 48);
  });

  for (const status of ["normal", "thawed"]) {
    test("Attack Ice temporarily suppresses " + status + " D7 goal without changing points", () => {
      const board = boardFixture(["D7", 53, status]);
      assert(hasReachedGoal(board));
      const iced = applyAttackIce(board, "D7");
      assert(!hasReachedGoal(iced));
      assertEqual(calculateScore(iced), status === "normal" ? 53 : 0);
      assert(hasReachedGoal(removeAttackIce(iced, "D7")));
      const moved = applyAttackIce(applyAttackIce(boardFixture(["A1", 16], ["D7", 53, status]), "D7"), "A1");
      assert(hasReachedGoal(moved));
    });
  }

  test("A Prime-frozen D7 remains blocked and cannot receive Attack Ice", () => {
    const board = boardFixture(["D7", 53, "frozen"]);
    assert(!hasReachedGoal(board));
    assertThrows(() => applyAttackIce(board, "D7"));
  });

  for (const action of ["Freeze", "Unfreeze", "Move"]) {
    test(action + " captures one complete snapshot and Undo restores every Prime/Attack field", () => {
      const original = primeState();
      const before = action === "Freeze" ? original : freezeGameCell(original, "B1");
      const after = action === "Unfreeze" ? unfreezeGameCell(before, "B1")
        : freezeGameCell(before, action === "Move" ? "A1" : "B1");
      assertDeepEqual(after.undo, { board: before.board });
      assert(after.undo.board !== before.board);
      assert(after.undo.board[0][0] !== before.board[0][0]);
      assert(after.undo.board[0][0] !== after.board[0][0]);
      assertDeepEqual(Object.keys(after.undo), ["board"]);
      assert(canUndo(after));
      assert(isValidGameState(after));
      const restored = undoLastMove(after);
      assertDeepEqual(restored, { board: before.board, undo: null });
      assert(!canUndo(restored));
      assertEqual(undoLastMove(restored), restored);
    });
  }

  test("Repeated Freeze and absent Unfreeze are no-ops that preserve the existing Undo", () => {
    const state = freezeGameCell(primeState(), "B1");
    const before = JSON.stringify(state);
    assertEqual(freezeGameCell(state, "B1"), state);
    assertEqual(unfreezeGameCell(state, "A1"), state);
    assertEqual(unfreezeGameCell(state, "D7"), state);
    assertEqual(JSON.stringify(state), before);
  });

  test("A placement preserves Attack Ice and its Undo restores the entire prior overlay", () => {
    const before = freezeGameCell({ board: boardFixture(["A1", 16], ["B1", 24], ["A2", 16]), undo: null }, "B1");
    const after = placeGameNumber(before, "B2", 26);
    assert(isCellAttackIced(after.board, "B1"));
    assertDeepEqual(undoLastMove(after), { board: before.board, undo: null });
  });

  test("Attack Undo also restores Street and goal displays' authoritative inputs", () => {
    const before = { board: streetBoard(), undo: null };
    const iced = freezeGameCell(before, "B1");
    assertEqual(calculateScore(undoLastMove(iced).board), 111);
    const goal = { board: boardFixture(["D7", 55]), undo: null };
    assert(hasReachedGoal(undoLastMove(freezeGameCell(goal, "D7")).board));
  });

  test("Clone state retains overlays on both independent current/Undo boards", () => {
    const moved = freezeGameCell(freezeGameCell(primeState(), "B1"), "A1");
    const cloned = cloneGameState(moved);
    assertDeepEqual(cloned, moved);
    delete cloned.board[0][0].attackIce;
    delete cloned.undo.board[0][1].attackIce;
    assert(isCellAttackIced(moved.board, "A1"));
    assert(isCellAttackIced(moved.undo.board, "B1"));
  });

  test("Attack snapshot validation rejects hidden Prime/value changes and multiple actions", () => {
    const before = primeState().board;
    const after = applyAttackIce(before, "B1");
    after[1][0].status = "thawed";
    assert(!isValidGameState({ board: after, undo: { board: before } }));
    after[1][0].status = "frozen";
    after[0][0].value = 24;
    assert(!isValidGameState({ board: after, undo: { board: before } }));
    const earlier = boardFixture(["A1", 16], ["A2", 16]);
    const combined = placeNumber(applyAttackIce(earlier, "A1"), "B2", 24);
    assert(!isValidGameState({ board: combined, undo: { board: earlier } }));
  });

  return results;
}
