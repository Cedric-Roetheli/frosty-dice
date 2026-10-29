import {
  applyAttackIce, canApplyAttackIce, canPlaceNumber, canUndo, cloneBoard, cloneGameState,
  createGameState, freezeGameCell, getCell, getLegalTargetCells, hasReachedGoal,
  isCellAttackIced, isCellOccupied, isCellUsable, isValidBoard, isValidBoardCell,
  isValidGameState, placeGameNumber, placeNumber, removeAttackIce, undoLastMove, unfreezeGameCell,
} from "../js/game.js";
import { calculateScore, getScoreBreakdown, isStreetRow } from "../js/scoring.js";
import { boardFixture, freezeBoardSnapshot } from "./fixtures.js";
import { assert, assertDeepEqual, assertEqual, assertThrows } from "./assert.js";

export function runAttackIceTests() {
  const results = [];
  function test(name, action) {
    try { action(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, message: error.message }); }
  }
  function primeState() {
    const initial = { board: boardFixture(["A2", 23]), undo: null };
    return placeGameNumber(placeGameNumber(initial, "B2", 31), "A3", 23);
  }
  function streetBoard() {
    return boardFixture(["A2", 11], ["B2", 12], ["C2", 13], ["D2", 14]);
  }

  test("All first-row cells reject new Attack Ice without changing the board or Undo", () => {
    for (const coordinate of ["A1", "B1", "C1", "D1"]) {
      for (const status of ["normal", "thawed"]) {
        const state = { board: boardFixture([coordinate, 23, status]), undo: null };
        const before = JSON.stringify(state);
        assert(!canApplyAttackIce(state.board, coordinate));
        assertThrows(() => applyAttackIce(state.board, coordinate), "first row");
        assertThrows(() => freezeGameCell(state, coordinate), "first row");
        assertEqual(JSON.stringify(state), before);
      }
    }
  });

  test("Every eligible cell in rows 2–7 still supports Attack Ice and unchanged Unfreeze", () => {
    for (let row = 2; row <= 7; row += 1) {
      for (const column of ["A", "B", "C", "D"]) {
        for (const status of ["normal", "thawed"]) {
          const coordinate = column + row;
          const board = boardFixture([coordinate, 23, status]);
          assert(canApplyAttackIce(board, coordinate));
          const iced = applyAttackIce(board, coordinate);
          assert(isCellAttackIced(iced, coordinate));
          assertEqual(iced.flat().filter((cell) => cell?.attackIce).length, 1);
          assertDeepEqual(removeAttackIce(iced, coordinate), board);
        }
      }
    }
  });

  test("Moving an existing overlay into the protected row is rejected atomically", () => {
    const state = freezeGameCell({ board: boardFixture(["A1", 23], ["A2", 23]), undo: null }, "A2");
    const before = JSON.stringify(state);
    assertThrows(() => freezeGameCell(state, "A1"), "first row");
    assertEqual(JSON.stringify(state), before);
    assert(canUndo(state));
    assert(isCellAttackIced(state.board, "A2"));
  });

  test("First-row protection does not change normal Prime Ice or its later thaw", () => {
    let state = placeGameNumber(createGameState(), "A1", 23);
    state = placeGameNumber(state, "B1", 31);
    assertEqual(getCell(state.board, "B1").status, "frozen");
    state = placeGameNumber(state, "A2", 23);
    assertEqual(getCell(state.board, "B1").status, "thawed");
    assertEqual(getCell(state.board, "A2").status, "frozen");
    assertEqual(calculateScore(state.board), 23);
  });

  test("Attack Ice is an independent overlay on an unchanged normal value/status", () => {
    const original = boardFixture(["A2", 16]);
    const iced = applyAttackIce(original, "A2");
    assertDeepEqual(getCell(iced, "A2"), { value: 16, status: "normal", attackIce: true });
    assert(isCellAttackIced(iced, "A2"));
    assert(isCellOccupied(iced, "A2"));
    assert(!isCellUsable(iced, "A2"));
    assertDeepEqual(original, boardFixture(["A2", 16]));
    const restored = removeAttackIce(iced, "A2");
    assertDeepEqual(restored, original);
    assert(isCellUsable(restored, "A2"));
    assertEqual(calculateScore(iced), 16);
    assertEqual(calculateScore(restored), 16);
  });

  test("Attack Ice on a thawed cell preserves permanent damage and restores only usability", () => {
    const original = primeState().board;
    const iced = applyAttackIce(original, "B2");
    assertDeepEqual(getCell(iced, "B2"), { value: 31, status: "thawed", attackIce: true });
    assert(!isCellUsable(iced, "B2"));
    assert(!canPlaceNumber(iced, "C2", 46));
    assertEqual(calculateScore(iced), 23);
    const restored = removeAttackIce(iced, "B2");
    assertDeepEqual(restored, original);
    assert(isCellUsable(restored, "B2"));
    assert(canPlaceNumber(restored, "C2", 46));
    assertEqual(calculateScore(restored), 23);
    assertDeepEqual(getCell(restored, "A3"), { value: 23, status: "frozen" });
  });

  test("Currently Prime-frozen cells cannot receive Attack Ice or disturb an existing overlay/Undo", () => {
    const state = freezeGameCell(primeState(), "B2");
    const before = JSON.stringify(state);
    assert(!canApplyAttackIce(state.board, "A3"));
    assertThrows(() => freezeGameCell(state, "A3"), "normal or thawed occupied");
    assertEqual(JSON.stringify(state), before);
    assert(canUndo(state));
    assert(isCellAttackIced(state.board, "B2"));
  });

  test("Empty cells and invalid coordinates cannot receive Attack Ice", () => {
    const state = primeState();
    for (const coordinate of ["C2", "D7", "E1", "A0", null]) {
      assertThrows(() => freezeGameCell(state, coordinate));
    }
    assertDeepEqual(state, primeState());
  });

  test("A board can hold one Prime Ice and one Attack Ice, but never two Attack overlays", () => {
    const board = applyAttackIce(primeState().board, "B2");
    assert(isValidBoard(board));
    board[1][0].attackIce = true;
    assert(!isValidBoard(board));
    assertThrows(() => applyAttackIce(board, "A2"));
  });

  test("Prime Ice and Attack Ice cannot coexist on the same cell", () => {
    assert(!isValidBoardCell({ value: 31, status: "frozen", attackIce: true }));
    const board = boardFixture(["B2", 31, "frozen"]);
    board[1][1].attackIce = true;
    assert(!isValidBoard(board));
  });

  test("Attack flags must be boolean and canonical copies omit a false overlay", () => {
    for (const attackIce of [null, "true", 1, {}, []]) {
      assert(!isValidBoardCell({ value: 16, status: "normal", attackIce }));
    }
    const board = boardFixture(["A2", 16]);
    board[1][0].attackIce = false;
    assert(isValidBoard(board));
    assertDeepEqual(cloneBoard(board), boardFixture(["A2", 16]));
  });

  test("Freezing a second cell atomically moves the single overlay without Prime transitions", () => {
    const original = primeState();
    const first = freezeGameCell(original, "B2");
    const moved = freezeGameCell(first, "A2");
    assertEqual(moved.board.flat().filter((cell) => cell?.attackIce).length, 1);
    assertDeepEqual(getCell(moved.board, "A2"), { value: 23, status: "normal", attackIce: true });
    assertDeepEqual(getCell(moved.board, "B2"), { value: 31, status: "thawed" });
    assertDeepEqual(getCell(moved.board, "A3"), { value: 23, status: "frozen" });
    assertDeepEqual(moved.undo, { board: first.board });
    assert(isValidGameState(moved));
    assertDeepEqual(original, primeState());
  });

  test("Get/clone operations retain Attack Ice and isolate cell records", () => {
    const board = applyAttackIce(boardFixture(["A2", 16]), "A2");
    const cell = getCell(board, "A2");
    delete cell.attackIce;
    assert(isCellAttackIced(board, "A2"));
    const cloned = cloneBoard(board);
    assertDeepEqual(cloned, board);
    delete cloned[1][0].attackIce;
    assert(isCellAttackIced(board, "A2"));
  });

  test("Attack operations and Undo work on immutable current boards and snapshots", () => {
    const original = primeState();
    freezeBoardSnapshot(original.board);
    freezeBoardSnapshot(original.undo.board);
    Object.freeze(original.undo);
    Object.freeze(original);
    const iced = freezeGameCell(original, "B2");
    freezeBoardSnapshot(iced.board);
    freezeBoardSnapshot(iced.undo.board);
    assertDeepEqual(undoLastMove(iced).board, original.board);
    assertDeepEqual(unfreezeGameCell(iced, "B2").board, original.board);
  });

  for (const [neighbor, value, target, newValue] of [
    ["A2", 16, "B2", 24], ["B2", 24, "A2", 16],
    ["A2", 22, "A3", 22], ["A3", 22, "A2", 22],
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

  test("Attack Ice remains occupied and never allows an isolated restart or overwrite", () => {
    const board = applyAttackIce(boardFixture(["B2", 24]), "B2");
    assert(!canPlaceNumber(board, "A2", 16));
    assertThrows(() => placeNumber(board, "B2", 46), "cannot be overwritten");
  });

  test("An independent usable OR connection still permits placement beside Attack Ice", () => {
    const board = applyAttackIce(boardFixture(["A2", 16], ["B2", 24], ["A3", 16]), "B2");
    assert(canPlaceNumber(board, "B3", 26));
    assert(getLegalTargetCells(board, 26).includes("B3"));
    const placed = placeNumber(board, "B3", 26);
    assertDeepEqual(getCell(placed, "B3"), { value: 26, status: "normal" });
    assert(isCellAttackIced(placed, "B2"));
  });

  test("Attack-Iced primes still trigger Prime contact after another neighbor validates placement", () => {
    const board = applyAttackIce(boardFixture(["A3", 16], ["B2", 31], ["D7", 53, "frozen"]), "B2");
    const placed = placeNumber(board, "B3", 23);
    assertDeepEqual(getCell(placed, "B3"), { value: 23, status: "frozen" });
    assertDeepEqual(getCell(placed, "D7"), { value: 53, status: "thawed" });
    assertDeepEqual(getCell(placed, "B2"), { value: 31, status: "normal", attackIce: true });
  });

  test("An illegal attempt cannot thaw Prime Ice or alter Attack Ice", () => {
    const state = freezeGameCell(primeState(), "B2");
    const saved = JSON.stringify(state);
    assertThrows(() => placeGameNumber(state, "C2", 41));
    assertEqual(JSON.stringify(state), saved);
  });

  test("Attack Ice on a normal value retains the complete base sum", () => {
    const board = applyAttackIce(boardFixture(["A2", 23], ["B2", 24], ["C4", 31, "thawed"]), "B2");
    assertDeepEqual(getScoreBreakdown(board), { baseSum: 47, streetBonus: 0, streetRows: [], score: 47 });
  });

  test("Attack Ice suppresses only a Street bonus and removing it fully restores the Street", () => {
    const original = streetBoard();
    assert(isStreetRow(original[1]));
    const iced = applyAttackIce(original, "B2");
    assert(!isStreetRow(iced[1]));
    assertDeepEqual(getScoreBreakdown(iced), { baseSum: 61, streetBonus: 0, streetRows: [], score: 61 });
    const restored = removeAttackIce(iced, "B2");
    assert(isStreetRow(restored[1]));
    assertEqual(calculateScore(restored), 122);
  });

  test("Moving Attack Ice restores the previous Street and suppresses the new row's Street", () => {
    const board = boardFixture(["A2", 11], ["B2", 12], ["C2", 13], ["D2", 14],
      ["A3", 21], ["B3", 22], ["C3", 23], ["D3", 24]);
    assertEqual(calculateScore(board), 346);
    const iced = applyAttackIce(board, "B2");
    assertDeepEqual(getScoreBreakdown(iced).streetRows, [3]);
    assertEqual(calculateScore(iced), 285);
    const moved = applyAttackIce(iced, "B3");
    assertDeepEqual(getScoreBreakdown(moved).streetRows, [2]);
    assertEqual(calculateScore(moved), 234);
    assertEqual(getScoreBreakdown(moved).baseSum, 173);
    assertEqual(calculateScore(removeAttackIce(moved, "B3")), 346);
  });

  test("Removing Attack Ice never repairs a thawed row's Street eligibility", () => {
    const board = streetBoard();
    board[1][2].status = "thawed";
    const restored = removeAttackIce(applyAttackIce(board, "C2"), "C2");
    assertDeepEqual(restored, board);
    assert(!isStreetRow(restored[1]));
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
      const moved = applyAttackIce(applyAttackIce(boardFixture(["A2", 16], ["D7", 53, status]), "D7"), "A2");
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
      const before = action === "Freeze" ? original : freezeGameCell(original, "B2");
      const after = action === "Unfreeze" ? unfreezeGameCell(before, "B2")
        : freezeGameCell(before, action === "Move" ? "A2" : "B2");
      assertDeepEqual(after.undo, { board: before.board });
      assert(after.undo.board !== before.board);
      assert(after.undo.board[1][0] !== before.board[1][0]);
      assert(after.undo.board[1][0] !== after.board[1][0]);
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
    const state = freezeGameCell(primeState(), "B2");
    const before = JSON.stringify(state);
    assertEqual(freezeGameCell(state, "B2"), state);
    assertEqual(unfreezeGameCell(state, "A2"), state);
    assertEqual(unfreezeGameCell(state, "D7"), state);
    assertEqual(JSON.stringify(state), before);
  });

  test("A placement preserves Attack Ice and its Undo restores the entire prior overlay", () => {
    const before = freezeGameCell({ board: boardFixture(["A2", 16], ["B2", 24], ["A3", 16]), undo: null }, "B2");
    const after = placeGameNumber(before, "B3", 26);
    assert(isCellAttackIced(after.board, "B2"));
    assertDeepEqual(undoLastMove(after), { board: before.board, undo: null });
  });

  test("Attack Undo also restores Street and goal displays' authoritative inputs", () => {
    const before = { board: streetBoard(), undo: null };
    const iced = freezeGameCell(before, "B2");
    assertEqual(calculateScore(undoLastMove(iced).board), 122);
    const goal = { board: boardFixture(["D7", 55]), undo: null };
    assert(hasReachedGoal(undoLastMove(freezeGameCell(goal, "D7")).board));
  });

  test("Clone state retains overlays on both independent current/Undo boards", () => {
    const moved = freezeGameCell(freezeGameCell(primeState(), "B2"), "A2");
    const cloned = cloneGameState(moved);
    assertDeepEqual(cloned, moved);
    delete cloned.board[1][0].attackIce;
    delete cloned.undo.board[1][1].attackIce;
    assert(isCellAttackIced(moved.board, "A2"));
    assert(isCellAttackIced(moved.undo.board, "B2"));
  });

  test("Attack snapshot validation rejects hidden Prime/value changes and multiple actions", () => {
    const before = primeState().board;
    const after = applyAttackIce(before, "B2");
    after[2][0].status = "thawed";
    assert(!isValidGameState({ board: after, undo: { board: before } }));
    after[2][0].status = "frozen";
    after[1][0].value = 24;
    assert(!isValidGameState({ board: after, undo: { board: before } }));
    const earlier = boardFixture(["A2", 16], ["A3", 16]);
    const combined = placeNumber(applyAttackIce(earlier, "A2"), "B3", 24);
    assert(!isValidGameState({ board: combined, undo: { board: earlier } }));
  });

  return results;
}
