import { canUndo, cloneGameState, confirmGameBid, createGameState, freezeGameCell, getCell, isValidGameState, parseBidInput, placeGameNumber, undoLastMove, unfreezeGameCell, validateBid } from "../js/game.js";
import { calculateScore, getScoreBreakdown } from "../js/scoring.js";
import { SAVE_VERSION, STORAGE_KEY, deserializeGame, loadGame, serializeGame } from "../js/storage.js";
import { boardFixture, freezeBoardSnapshot } from "./fixtures.js";
import { assert, assertDeepEqual, assertEqual, assertThrows } from "./assert.js";

export function runChallengeTests() {
  const results = [];
  function test(name, action) {
    try { action(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, message: error.message }); }
  }
  function score(state) { return calculateScore(state.board, state.pointsSpent ?? 0); }
  function gameWith47Points() {
    return placeGameNumber(placeGameNumber(createGameState(), "A1", 23), "B1", 24);
  }

  test("Bids 0, 12, and the entire available score 47 are accepted", () => {
    for (const bid of [0, 12, 47]) {
      assertDeepEqual(validateBid(bid, 47), { valid: true, reason: null });
      assertEqual(score(confirmGameBid(gameWith47Points(), bid)), 47 - bid);
    }
    const zero = confirmGameBid(createGameState(), 0);
    assertEqual(score(zero), 0);
    assert(canUndo(zero));
  });

  test("Unaffordable, negative, fractional, nonnumeric, and unsafe bids are rejected", () => {
    const state = gameWith47Points();
    const before = JSON.stringify(state);
    for (const bid of [48, -1, 1.5, "12", "", null, undefined, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      assertEqual(validateBid(bid, 47).valid, false);
      assertThrows(() => confirmGameBid(state, bid));
      assertEqual(JSON.stringify(state), before);
    }
  });

  test("Bid input accepts only complete nonnegative decimal integers", () => {
    for (const input of ["0", "12", "47", "00012"]) assertEqual(parseBidInput(input), Number(input));
    for (const input of ["", " ", "-1", "+1", "1.5", "1.0", "1e1", "0x10", "12\n", "12 ", " 12", "word", null, 12, "9007199254740992"]) {
      assertThrows(() => parseBidInput(input), "whole number");
    }
  });

  test("Confirming 12 spends precisely 12 while preserving all board values and statuses", () => {
    const state = gameWith47Points();
    const original = JSON.stringify(state);
    freezeBoardSnapshot(state.board);
    const after = confirmGameBid(state, 12);
    assertEqual(after.pointsSpent, 12);
    assertEqual(score(after), 35);
    assertEqual(JSON.stringify(state), original);
    assertDeepEqual(after.board, state.board);
    assert(after.board[0][0] !== state.board[0][0]);
    assert(after.undo.board[0][0] !== after.board[0][0]);
    assert(isValidGameState(after));
  });

  test("Later bids use the reduced score rather than the original board total", () => {
    const after = confirmGameBid(gameWith47Points(), 12);
    assertThrows(() => confirmGameBid(after, 36), "Not enough points");
    const empty = confirmGameBid(after, 35);
    assertEqual(empty.pointsSpent, 47);
    assertEqual(score(empty), 0);
    assertThrows(() => confirmGameBid(empty, 1), "Not enough points");
    assertEqual(score(confirmGameBid(empty, 0)), 0);
  });

  test("Doubled 66 points are fully available for bidding, persistence, and bid Undo", () => {
    const before = placeGameNumber(createGameState(), "A1", 66);
    assertEqual(score(before), 132);
    assertThrows(() => confirmGameBid(before, 133), "Not enough points");
    const paid = confirmGameBid(before, 132);
    assertEqual(score(paid), 0);
    assertEqual(paid.pointsSpent, 132);
    const restored = deserializeGame(serializeGame(paid));
    assertDeepEqual(restored, paid);
    assertEqual(score(restored), 0);
    assertEqual(score(undoLastMove(restored)), 132);
    assertDeepEqual(getCell(restored.board, "A1"), { value: 66, status: "normal" });
  });

  test("Boundary Street and spending restore from canonical state without storing scoring bonuses", () => {
    let state = createGameState();
    for (const [coordinate, value] of [["A1", 55], ["B1", 56], ["C1", 61], ["D1", 62]]) {
      state = placeGameNumber(state, coordinate, value);
    }
    const paid = confirmGameBid(state, 100);
    assertEqual(score(paid), 478);
    const iced = freezeGameCell(paid, "A1");
    const restored = deserializeGame(serializeGame(iced));
    assertDeepEqual(restored, iced);
    assertEqual(score(restored), 189);
    assertDeepEqual(getScoreBreakdown(restored.board, restored.pointsSpent).streetRows, []);
    assertEqual(score(undoLastMove(restored)), 478);
    assertDeepEqual(getScoreBreakdown(undoLastMove(restored).board, restored.pointsSpent).streetRows, [1]);
    assertDeepEqual(Object.keys(JSON.parse(serializeGame(restored)).state), ["board", "undo", "pointsSpent"]);
  });

  test("Bid Undo restores complete pre-bid state and consumes the single snapshot", () => {
    const before = confirmGameBid(gameWith47Points(), 12);
    const after = confirmGameBid(before, 20);
    const restored = undoLastMove(after);
    assertDeepEqual(restored, { board: before.board, undo: null, pointsSpent: 12 });
    assertEqual(score(restored), 35);
    assert(!canUndo(restored));
    assertEqual(undoLastMove(restored), restored);
    assertEqual(restored.undo, null);
  });

  test("Placement after a bid preserves spending and its Undo restores the reduced score", () => {
    const before = confirmGameBid(gameWith47Points(), 12);
    const placed = placeGameNumber(before, "C1", 46);
    assertEqual(placed.pointsSpent, 12);
    assertEqual(score(placed), 81);
    assertDeepEqual(undoLastMove(placed), { board: before.board, undo: null, pointsSpent: 12 });
    assertEqual(score(undoLastMove(placed)), 35);
    const original = JSON.stringify(before);
    assertThrows(() => placeGameNumber(before, "D7", 46));
    assertEqual(JSON.stringify(before), original);
  });

  test("Manual Attack Ice and its Undo preserve confirmed spending and underlying Prime state", () => {
    let state = createGameState();
    for (const [coordinate, value] of [["A1", 23], ["B1", 31], ["A2", 23]]) state = placeGameNumber(state, coordinate, value);
    const paid = confirmGameBid(state, 12);
    const frozen = freezeGameCell(paid, "B1");
    assertEqual(score(frozen), 11);
    assertEqual(getCell(frozen.board, "B1").status, "thawed");
    assertEqual(getCell(frozen.board, "A2").status, "frozen");
    assertDeepEqual(undoLastMove(frozen), { board: paid.board, undo: null, pointsSpent: 12 });
    const thawed = unfreezeGameCell(frozen, "B1");
    assertEqual(score(thawed), 11);
    assertDeepEqual(undoLastMove(thawed), { board: frozen.board, undo: null, pointsSpent: 12 });
  });

  test("Score spending preserves board-derived Street bonus details", () => {
    const state = { board: boardFixture(["A1", 11], ["B1", 12], ["C1", 13], ["D1", 14]), undo: null };
    const after = confirmGameBid(state, 40);
    assertDeepEqual(getScoreBreakdown(after.board, after.pointsSpent), {
      baseSum: 61, streetBonus: 61, streetRows: [1], score: 82,
    });
  });

  test("Confirmed bid and exact Undo spending survive serialization and reload", () => {
    const after = confirmGameBid(confirmGameBid(gameWith47Points(), 12), 20);
    const serialized = serializeGame({ ...after, bidDraft: "9", confirmedBid: 20, challengeOpen: true, score: 999 });
    const restored = deserializeGame(serialized);
    assertDeepEqual(restored, after);
    assertEqual(score(restored), 15);
    assertEqual(score(undoLastMove(restored)), 35);
    assertEqual(JSON.parse(serialized).version, 7);
    assertDeepEqual(Object.keys(restored), ["board", "undo", "pointsSpent"]);
    assertDeepEqual(Object.keys(restored.undo), ["board", "pointsSpent"]);
    assert(restored.board[0][0] !== restored.undo.board[0][0]);
    const consumed = deserializeGame(serializeGame(undoLastMove(restored)));
    assertEqual(consumed.undo, null);
    assertEqual(score(consumed), 35);
    assertDeepEqual(cloneGameState(after), after);
  });

  test("Version 6 migrates valid Prime/Attack boards and Undo without rewriting the old save", () => {
    const state = freezeGameCell(placeGameNumber(placeGameNumber(createGameState(), "A1", 23), "B1", 31), "A1");
    const serialized = JSON.stringify({ version: 6, state });
    const storage = { getItem(key) { assertEqual(key, STORAGE_KEY); return serialized; } };
    assertDeepEqual(loadGame(storage), { state, status: "restored" });
    const paid = confirmGameBid(loadGame(storage).state, 12);
    assertEqual(score(paid), 11);
    assertEqual(JSON.parse(serializeGame(paid)).version, SAVE_VERSION);
    assertDeepEqual(undoLastMove(paid).board, state.board);
  });

  test("Malformed spending, unaffordable bid snapshots, and mixed legacy spending are rejected", () => {
    const paid = confirmGameBid(gameWith47Points(), 12);
    for (const pointsSpent of [-1, null, "12", 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      assert(!isValidGameState({ ...paid, pointsSpent }));
      assertEqual(deserializeGame(JSON.stringify({ version: SAVE_VERSION, state: { ...paid, pointsSpent } })), null);
      assertEqual(deserializeGame(JSON.stringify({ version: SAVE_VERSION, state: { ...paid, undo: { ...paid.undo, pointsSpent } } })), null);
    }
    assertEqual(deserializeGame(JSON.stringify({ version: SAVE_VERSION, state: { ...paid, pointsSpent: 48 } })), null);
    const simultaneous = { ...paid, board: boardFixture(["A1", 23], ["B1", 24], ["C1", 46]) };
    assert(!isValidGameState(simultaneous));
    for (const version of [2, 3, 4, 5, 6]) {
      assertEqual(deserializeGame(JSON.stringify({ version, state: paid })), null);
    }
  });

  return results;
}
