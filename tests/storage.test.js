import { createGameState, getCell, getLegalTargetCells, hasReachedGoal, placeGameNumber } from "../js/game.js";
import { calculateScore, getScoreBreakdown } from "../js/scoring.js";
import { SAVE_VERSION, STORAGE_KEY, clearSavedGame, deserializeGame, isValidStoredState, loadGame, saveGame, serializeGame } from "../js/storage.js";
import { boardFixture, freezeBoardSnapshot } from "./fixtures.js";
import { assert, assertDeepEqual, assertEqual, assertThrows } from "./assert.js";

function memoryGameStorage() {
  const values = new Map();
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

export function runStorageTests() {
  const results = [];
  function test(name, action) {
    try { action(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, message: error.message }); }
  }

  test("Version 3 saves contain only the canonical board", () => {
    const state = createGameState();
    assertEqual(SAVE_VERSION, 3);
    assertDeepEqual(JSON.parse(serializeGame(state)), { version: 3, state });
    assertDeepEqual(deserializeGame(serializeGame(state)), state);
  });

  test("Normal and frozen statuses survive restoration without retroactive freezing", () => {
    const state = placeGameNumber(placeGameNumber(createGameState(), "A1", 11), "B1", 13);
    const restored = deserializeGame(serializeGame(state));
    assertDeepEqual(restored, state);
    assertDeepEqual(getCell(restored.board, "A1"), { value: 11, status: "normal" });
    assertDeepEqual(getCell(restored.board, "B1"), { value: 13, status: "frozen" });
    assert(restored.board !== state.board);
    assert(restored.board[0][0] !== state.board[0][0]);
    restored.board[0][0].value = 16;
    assertEqual(state.board[0][0].value, 11);
  });

  test("All three statuses persist and resumed freeze moves never restore damaged points", () => {
    const state = placeGameNumber(placeGameNumber(placeGameNumber(createGameState(), "A1", 23), "B1", 31), "A2", 23);
    const restored = deserializeGame(serializeGame(state));
    assertDeepEqual(restored, state);
    assertDeepEqual(getCell(restored.board, "B1"), { value: 31, status: "thawed" });
    const moved = deserializeGame(serializeGame(placeGameNumber(restored, "C1", 41)));
    assertDeepEqual(getCell(moved.board, "A2"), { value: 23, status: "thawed" });
    assertDeepEqual(getCell(moved.board, "B1"), { value: 31, status: "thawed" });
    assertDeepEqual(getCell(moved.board, "C1"), { value: 41, status: "frozen" });
    assertEqual(calculateScore(moved.board), 23);
  });

  test("Version 2 records with zero or one freeze migrate without guessing or rewriting on load", () => {
    for (const frozen of [false, true]) {
      const board = Array.from({ length: 7 }, () => Array(4).fill(null));
      board[0][0] = { value: 23, frozen: false };
      board[0][1] = { value: 31, frozen };
      const serialized = JSON.stringify({ version: 2, state: { board } });
      const storage = memoryGameStorage();
      storage.setItem(STORAGE_KEY, serialized);
      const restored = loadGame(storage);
      assertEqual(restored.status, "restored");
      assertDeepEqual(getCell(restored.state.board, "A1"), { value: 23, status: "normal" });
      assertDeepEqual(getCell(restored.state.board, "B1"), { value: 31, status: frozen ? "frozen" : "normal" });
      assertEqual(storage.getItem(STORAGE_KEY), serialized);
      const moved = placeGameNumber(restored.state, "A2", 23);
      assert(saveGame(moved, storage));
      assertEqual(JSON.parse(storage.getItem(STORAGE_KEY)).version, 3);
      if (frozen) assertDeepEqual(getCell(loadGame(storage).state.board, "B1"), { value: 31, status: "thawed" });
    }
  });

  test("Multiple old freezes fall back safely while preserving the original save", () => {
    const board = Array.from({ length: 7 }, () => Array(4).fill(null));
    board[0][0] = { value: 23, frozen: false };
    board[0][1] = { value: 31, frozen: true };
    board[1][0] = { value: 23, frozen: true };
    const serialized = JSON.stringify({ version: 2, state: { board } });
    const storage = memoryGameStorage();
    storage.setItem(STORAGE_KEY, serialized);
    assertEqual(deserializeGame(serialized), null);
    assertDeepEqual(loadGame(storage), { state: createGameState(), status: "invalid" });
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
  });

  test("Version 3 snapshots with more than one current freeze cannot be saved or restored", () => {
    const state = { board: boardFixture(["B1", 31, "frozen"], ["A2", 23, "frozen"]) };
    assert(!isValidStoredState(state));
    assertThrows(() => serializeGame(state), "invalid game state");
    assertEqual(deserializeGame(JSON.stringify({ version: 3, state })), null);
  });

  test("Invalid version 2 flags, values, or board shapes do not crash migration", () => {
    for (const cell of [13, {}, { value: 13 }, { value: 13, frozen: "true" },
      { value: 22, frozen: true }, { value: 17, frozen: false }]) {
      const board = Array.from({ length: 7 }, () => Array(4).fill(null));
      board[0][0] = cell;
      assertEqual(deserializeGame(JSON.stringify({ version: 2, state: { board } })), null);
    }
    for (const state of [null, {}, { board: [] }, { board: Array(7).fill([]) }]) {
      assertEqual(deserializeGame(JSON.stringify({ version: 2, state })), null);
    }
  });

  test("Version 2 migration rejects mixed status/boolean records rather than restoring damaged points", () => {
    const board = Array.from({ length: 7 }, () => Array(4).fill(null));
    board[0][0] = { value: 23, frozen: false };
    for (const status of ["normal", "frozen", "thawed"]) {
      board[0][1] = { value: 31, frozen: false, status };
      const serialized = JSON.stringify({ version: 2, state: { board } });
      const storage = memoryGameStorage();
      storage.setItem(STORAGE_KEY, serialized);
      assertEqual(deserializeGame(serialized), null);
      assertDeepEqual(loadGame(storage), { state: createGameState(), status: "invalid" });
      assertEqual(storage.getItem(STORAGE_KEY), serialized);
    }
  });

  test("Version 3 rejects legacy frozen flags rather than silently ignoring contradictory state", () => {
    for (const frozen of [false, true]) {
      const state = { board: boardFixture(["A1", 23], ["B1", 31, "thawed"], ["A2", 23, "frozen"]) };
      state.board[0][1].frozen = frozen;
      assert(!isValidStoredState(state));
      assertThrows(() => serializeGame(state), "invalid game state");
      assertEqual(deserializeGame(JSON.stringify({ version: 3, state })), null);
    }
  });

  test("Saving drops legacy metadata, derived values, and cell presentation fields", () => {
    const state = placeGameNumber(createGameState(), "A1", 16);
    const extras = { ...state, ownRollCount: 100, source: "unused pair", score: 999, streetRows: [1], goalReached: true };
    extras.board = boardFixture(["A1", 16]);
    extras.board[0][0].selected = true;
    assertDeepEqual(JSON.parse(serializeGame(extras)).state, state);
    assertDeepEqual(deserializeGame(JSON.stringify({ version: 3, state: extras })), state);
  });

  test("Score, Streets, goals, and targets are derived from restored cell records", () => {
    const state = { board: boardFixture(["A1", 11], ["B1", 12], ["C1", 13], ["D1", 14],
      ["C3", 31, "frozen"], ["D7", 46]) };
    const restored = deserializeGame(serializeGame(state));
    assertEqual(calculateScore(restored.board), 146);
    assertDeepEqual(getScoreBreakdown(restored.board).streetRows, [1]);
    assert(hasReachedGoal(restored.board));
    assertDeepEqual(getLegalTargetCells(restored.board, 11), ["A2", "C7"]);
  });

  test("Missing saves start fresh without writing a record", () => {
    const storage = memoryGameStorage();
    assertDeepEqual(loadGame(storage), { state: createGameState(), status: "missing" });
    assertEqual(storage.values.size, 0);
  });

  test("Malformed, old, or incompatible saves are rejected and left intact", () => {
    const storage = memoryGameStorage();
    const oldBoard = Array.from({ length: 7 }, () => Array(4).fill(null));
    oldBoard[0][0] = 11;
    for (const serialized of ["{", "null", "[]", "{}",
      JSON.stringify({ version: 1, state: { board: oldBoard } }),
      JSON.stringify({ version: 2, state: { board: oldBoard } }),
      JSON.stringify({ version: 3, state: { board: oldBoard } }),
      JSON.stringify({ version: 4, state: createGameState() }),
      JSON.stringify({ version: "3", state: createGameState() })]) {
      storage.setItem(STORAGE_KEY, serialized);
      assertEqual(deserializeGame(serialized), null);
      assertDeepEqual(loadGame(storage), { state: createGameState(), status: "invalid" });
      assertEqual(storage.getItem(STORAGE_KEY), serialized);
    }
    for (const input of [undefined, null, 42]) assertEqual(deserializeGame(input), null);
  });

  test("Malformed cell records, damaged composites, and sparse boards are rejected", () => {
    for (const cell of [16, {}, { value: 17, status: "normal" }, { value: 13 },
      { value: 13, status: "invalid" }, { value: 22, status: "frozen" }]) {
      const state = createGameState();
      state.board[0][0] = cell;
      assert(!isValidStoredState(state));
      assertThrows(() => serializeGame(state), "invalid game state");
      assertEqual(deserializeGame(JSON.stringify({ version: 3, state })), null);
    }
    const sparse = createGameState();
    delete sparse.board[0][0];
    for (const state of [sparse, null, [], {}, { board: [] }]) {
      assert(!isValidStoredState(state));
      assertThrows(() => serializeGame(state), "invalid game state");
    }
  });

  test("Save/load touches only the game key", () => {
    const storage = memoryGameStorage();
    storage.setItem("other-app", "untouched");
    const state = placeGameNumber(createGameState(), "A1", 16);
    assert(saveGame(state, storage));
    assertDeepEqual(loadGame(storage), { state, status: "restored" });
    assertEqual(storage.getItem("other-app"), "untouched");
  });

  test("An invalid state cannot overwrite an existing save", () => {
    const storage = memoryGameStorage();
    const state = createGameState();
    assert(saveGame(state, storage));
    assert(!saveGame({ board: [] }, storage));
    assertEqual(storage.getItem(STORAGE_KEY), serializeGame(state));
  });

  test("Serialization does not mutate immutable cell records", () => {
    const state = { board: freezeBoardSnapshot(boardFixture(["A1", 11], ["B1", 13, "frozen"])) };
    Object.freeze(state);
    const before = JSON.stringify(state);
    assertDeepEqual(deserializeGame(serializeGame(state)), state);
    assertEqual(JSON.stringify(state), before);
  });

  test("Storage access, write, and clear failures do not throw", () => {
    const unavailable = {
      getItem() { throw new Error("Unavailable"); },
      setItem() { throw new Error("Quota exceeded"); },
      removeItem() { throw new Error("Unavailable"); },
    };
    for (const storage of [unavailable, null]) {
      assertDeepEqual(loadGame(storage), { state: createGameState(), status: "unavailable" });
      assertEqual(saveGame(createGameState(), storage), false);
      assertEqual(clearSavedGame(storage), false);
    }
  });

  test("A throwing localStorage getter is handled safely", () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    try {
      Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("Denied"); } });
      assertEqual(loadGame().status, "unavailable");
      assertEqual(saveGame(createGameState()), false);
      assertEqual(clearSavedGame(), false);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
      else delete globalThis.localStorage;
    }
  });

  test("Reset clears only this save, allowing the next load to start empty", () => {
    const storage = memoryGameStorage();
    storage.setItem("other-app", "untouched");
    assert(saveGame(placeGameNumber(createGameState(), "A1", 16), storage));
    assert(clearSavedGame(storage));
    assertEqual(storage.getItem(STORAGE_KEY), null);
    assertEqual(storage.getItem("other-app"), "untouched");
    assertDeepEqual(loadGame(storage), { state: createGameState(), status: "missing" });
  });

  return results;
}
