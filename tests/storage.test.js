import { canUndo, createGameState, freezeGameCell, getCell, getLegalTargetCells, hasReachedGoal, isCellAttackIced, placeGameNumber, undoLastMove, unfreezeGameCell } from "../js/game.js";
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

  test("Version 7 saves contain only current gameplay and one nullable Undo snapshot", () => {
    const state = createGameState();
    assertEqual(SAVE_VERSION, 7);
    assertDeepEqual(JSON.parse(serializeGame(state)), { version: SAVE_VERSION, state });
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
      assertEqual(JSON.parse(storage.getItem(STORAGE_KEY)).version, SAVE_VERSION);
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
    const state = { board: boardFixture(["B1", 31, "frozen"], ["A2", 23, "frozen"]), undo: null };
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
      const state = { board: boardFixture(["A1", 23], ["B1", 31, "thawed"], ["A2", 23, "frozen"]), undo: null };
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
    assertDeepEqual(deserializeGame(JSON.stringify({ version: SAVE_VERSION, state: extras })), state);
    assertDeepEqual(deserializeGame(JSON.stringify({ version: 3, state: extras })), { board: state.board, undo: null });
  });

  test("Score, Streets, goals, and targets are derived from restored cell records", () => {
    const state = { board: boardFixture(["A1", 11], ["B1", 12], ["C1", 13], ["D1", 14],
      ["C3", 31, "frozen"], ["D7", 46]), undo: null };
    const restored = deserializeGame(serializeGame(state));
    assertEqual(calculateScore(restored.board), 157);
    assertDeepEqual(getScoreBreakdown(restored.board).streetRows, [1]);
    assert(hasReachedGoal(restored.board));
    assertDeepEqual(getLegalTargetCells(restored.board, 11), ["A2", "C7"]);
  });

  test("Missing saves start fresh without writing a record", () => {
    const storage = memoryGameStorage();
    assertDeepEqual(loadGame(storage), { state: createGameState(), status: "missing" });
    assertEqual(storage.values.size, 0);
  });

  test("Version 6 repdigits restore unchanged and recalculate their new doubled score", () => {
    const state = placeGameNumber(createGameState(), "A1", 66);
    const serialized = JSON.stringify({ version: 6, state });
    const storage = memoryGameStorage();
    storage.setItem(STORAGE_KEY, serialized);
    const restored = loadGame(storage);
    assertEqual(restored.status, "restored");
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
    assertDeepEqual(restored.state, state);
    assertEqual(calculateScore(restored.state.board), 132);
    assertEqual(calculateScore(undoLastMove(restored.state).board), 0);
  });

  test("Malformed, old, or incompatible saves are rejected and left intact", () => {
    const storage = memoryGameStorage();
    const oldBoard = Array.from({ length: 7 }, () => Array(4).fill(null));
    oldBoard[0][0] = 11;
    for (const serialized of ["{", "null", "[]", "{}",
      JSON.stringify({ version: 1, state: { board: oldBoard } }),
      JSON.stringify({ version: 2, state: { board: oldBoard } }),
      JSON.stringify({ version: 3, state: { board: oldBoard } }),
      JSON.stringify({ version: SAVE_VERSION + 1, state: createGameState() }),
      JSON.stringify({ version: "3", state: createGameState() })]) {
      storage.setItem(STORAGE_KEY, serialized);
      assertEqual(deserializeGame(serialized), null);
      assertDeepEqual(loadGame(storage), { state: createGameState(), status: "invalid" });
      assertEqual(storage.getItem(STORAGE_KEY), serialized);
    }
    for (const input of [undefined, null, 42]) assertEqual(deserializeGame(input), null);
  });

  test("Malformed cell records, frozen composites, and sparse boards are rejected", () => {
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
    const state = { board: freezeBoardSnapshot(boardFixture(["A1", 11], ["B1", 13, "frozen"])), undo: null };
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

  test("Current state and its exact freeze/thaw Undo snapshot survive save and reload", () => {
    let state = createGameState();
    for (const [coordinate, value] of [["A1", 23], ["B1", 31], ["A2", 23]]) {
      state = placeGameNumber(state, coordinate, value);
    }
    const storage = memoryGameStorage();
    assert(saveGame(state, storage));
    const restored = loadGame(storage);
    assertDeepEqual(restored, { state, status: "restored" });
    assert(canUndo(restored.state));
    assertDeepEqual(restored.state.undo.board, boardFixture(["A1", 23], ["B1", 31, "frozen"]));
    const undone = undoLastMove(restored.state);
    assert(saveGame(undone, storage));
    assertDeepEqual(loadGame(storage).state, { board: boardFixture(["A1", 23], ["B1", 31, "frozen"]), undo: null });
    assert(!canUndo(loadGame(storage).state));
    assertEqual(JSON.parse(storage.getItem(STORAGE_KEY)).state.undo, null);
  });

  test("Only two flat boards can be stored even after many successful placements", () => {
    let state = createGameState();
    for (let row = 1; row <= 7; row += 1) state = placeGameNumber(state, "A" + row, 12);
    const payload = JSON.parse(serializeGame(state));
    assertDeepEqual(Object.keys(payload.state), ["board", "undo"]);
    assertDeepEqual(Object.keys(payload.state.undo), ["board"]);
    assertEqual(payload.state.undo.undo, undefined);
    assertEqual(payload.state.board.length, 7);
    assertEqual(payload.state.undo.board.length, 7);
  });

  test("Version 3 and 4 board-only games migrate unchanged without inventing Undo or writing on load", () => {
    const board = boardFixture(["A1", 23], ["B1", 31, "thawed"], ["A2", 23, "frozen"]);
    for (const version of [3, 4]) {
      const storage = memoryGameStorage();
      const serialized = JSON.stringify({ version, state: { board } });
      storage.setItem(STORAGE_KEY, serialized);
      assertDeepEqual(loadGame(storage), { state: { board, undo: null }, status: "restored" });
      assertEqual(storage.getItem(STORAGE_KEY), serialized);
      assert(!canUndo(loadGame(storage).state));
      const next = placeGameNumber(loadGame(storage).state, "C1", 46);
      assert(saveGame(next, storage));
      assertEqual(JSON.parse(storage.getItem(STORAGE_KEY)).version, SAVE_VERSION);
      assertDeepEqual(loadGame(storage).state.undo, { board });
    }
  });

  test("Valid legacy permanent damage survives migration and subsequent Undo exactly", () => {
    const board = boardFixture(["A1", 16], ["B1", 46, "thawed"]);
    const serialized = JSON.stringify({ version: 4, state: { board } });
    const restored = deserializeGame(serialized);
    assertDeepEqual(restored, { board, undo: null });
    assertEqual(calculateScore(restored.board), 16);
    assertEqual(deserializeGame(JSON.stringify({ version: 3, state: { board } })), null);
    const after = placeGameNumber(restored, "C1", 54);
    const roundTrip = deserializeGame(serializeGame(after));
    assertDeepEqual(undoLastMove(roundTrip), restored);
    assertEqual(calculateScore(undoLastMove(roundTrip).board), 16);
  });

  test("Malformed, recursive, unrelated, and incompatible Undo data cannot crash loading", () => {
    const state = placeGameNumber(createGameState(), "A1", 16);
    const badUndos = [false, 1, [], {}, { board: [] }, { board: state.board },
      { board: state.undo.board, undo: null }, { board: boardFixture(["D7", 55]) }];
    for (const undo of badUndos) {
      const storage = memoryGameStorage();
      const saved = JSON.stringify({ version: SAVE_VERSION, state: { board: state.board, undo } });
      storage.setItem(STORAGE_KEY, saved);
      assertEqual(deserializeGame(saved), null);
      assertDeepEqual(loadGame(storage), { state: createGameState(), status: "invalid" });
      assertEqual(storage.getItem(STORAGE_KEY), saved);
    }
  });

  test("A snapshot/current-board pair with an incorrect freeze transition is rejected", () => {
    const state = {
      board: boardFixture(["A1", 23], ["B1", 31, "normal"]),
      undo: { board: boardFixture(["A1", 23]) },
    };
    assert(!isValidStoredState(state));
    assertEqual(deserializeGame(JSON.stringify({ version: SAVE_VERSION, state })), null);
    assertThrows(() => serializeGame(state), "invalid game state");
  });

  test("Mixed legacy flags in either board cannot silently reset persisted status", () => {
    for (const target of ["board", "undo"]) {
      const state = placeGameNumber(placeGameNumber(createGameState(), "A1", 23), "B1", 31);
      const board = target === "board" ? state.board : state.undo.board;
      board[0][0].frozen = false;
      assert(!isValidStoredState(state));
      assertThrows(() => serializeGame(state), "invalid game state");
      assertEqual(deserializeGame(JSON.stringify({ version: SAVE_VERSION, state })), null);
    }
  });

  test("Loaded current and Undo boards are independent copies of canonical records", () => {
    const state = placeGameNumber(placeGameNumber(createGameState(), "A1", 23), "B1", 31);
    const saved = serializeGame(state);
    const restored = deserializeGame(saved);
    assert(restored.board[0][0] !== state.board[0][0]);
    assert(restored.undo.board[0][0] !== state.undo.board[0][0]);
    assert(restored.board[0][0] !== restored.undo.board[0][0]);
    restored.board[0][0].value = 24;
    assertEqual(restored.undo.board[0][0].value, 23);
    assertEqual(state.board[0][0].value, 23);
    assertEqual(serializeGame(state), saved);
  });

  for (const action of ["Freeze", "Unfreeze", "Move"]) {
    test("Attack " + action + " persists current state and exact Prime/Attack Undo after reload", () => {
      let original = createGameState();
      for (const [coordinate, value] of [["A1", 23], ["B1", 31], ["A2", 23]]) {
        original = placeGameNumber(original, coordinate, value);
      }
      const before = action === "Freeze" ? original : freezeGameCell(original, "B1");
      const after = action === "Unfreeze" ? unfreezeGameCell(before, "B1")
        : freezeGameCell(before, action === "Move" ? "A1" : "B1");
      const storage = memoryGameStorage();
      assert(saveGame(after, storage));
      const saved = storage.getItem(STORAGE_KEY);
      const restored = loadGame(storage);
      assertDeepEqual(restored, { state: after, status: "restored" });
      assertEqual(storage.getItem(STORAGE_KEY), saved);
      assertEqual(calculateScore(restored.state.board), 23);
      assertEqual(getCell(restored.state.board, "B1").status, "thawed");
      assertEqual(getCell(restored.state.board, "A2").status, "frozen");
      assertDeepEqual(undoLastMove(restored.state), { board: before.board, undo: null });
      assert(saveGame(undoLastMove(restored.state), storage));
      assertDeepEqual(loadGame(storage).state, { board: before.board, undo: null });
    });
  }

  test("Version 5 preserves complete Prime state and existing Undo with no Attack Ice or load-time writes", () => {
    let state = createGameState();
    for (const [coordinate, value] of [["A1", 23], ["B1", 31], ["A2", 23]]) {
      state = placeGameNumber(state, coordinate, value);
    }
    const storage = memoryGameStorage();
    const saved = JSON.stringify({ version: 5, state });
    storage.setItem(STORAGE_KEY, saved);
    assertDeepEqual(loadGame(storage), { state, status: "restored" });
    assertEqual(storage.getItem(STORAGE_KEY), saved);
    assertDeepEqual(undoLastMove(loadGame(storage).state).board, state.undo.board);
    assert(!isCellAttackIced(loadGame(storage).state.board, "B1"));
    assert(saveGame(freezeGameCell(loadGame(storage).state, "B1"), storage));
    assertEqual(JSON.parse(storage.getItem(STORAGE_KEY)).version, SAVE_VERSION);
    assert(isCellAttackIced(loadGame(storage).state.board, "B1"));
  });

  test("Legacy versions reject unexpected Attack fields on either current or Undo board", () => {
    for (const version of [2, 3, 4, 5]) {
      const board = boardFixture(["A1", 23]);
      if (version === 2) board[0][0] = { value: 23, frozen: false };
      for (const attackIce of [true, false, "true"]) {
        board[0][0].attackIce = attackIce;
        const saved = JSON.stringify({ version, state: { board, undo: null } });
        const storage = memoryGameStorage();
        storage.setItem(STORAGE_KEY, saved);
        assertDeepEqual(loadGame(storage), { state: createGameState(), status: "invalid" });
        assertEqual(storage.getItem(STORAGE_KEY), saved);
      }
    }
    const state = placeGameNumber(placeGameNumber(createGameState(), "A1", 23), "B1", 31);
    state.undo.board[0][0].attackIce = false;
    assertEqual(deserializeGame(JSON.stringify({ version: 5, state })), null);
  });

  test("Malformed current Attack states safely fall back without overwriting saved data", () => {
    const badBoards = [];
    const multiple = boardFixture(["A1", 16], ["B1", 24]);
    multiple[0][0].attackIce = true;
    multiple[0][1].attackIce = true;
    badBoards.push(multiple);
    const primeFrozen = boardFixture(["B1", 31, "frozen"]);
    primeFrozen[0][1].attackIce = true;
    badBoards.push(primeFrozen);
    for (const attackIce of ["true", null, 1]) {
      const board = boardFixture(["A1", 16]);
      board[0][0].attackIce = attackIce;
      badBoards.push(board);
    }
    for (const board of badBoards) {
      const state = { board, undo: null };
      assert(!isValidStoredState(state));
      assertThrows(() => serializeGame(state));
      const saved = JSON.stringify({ version: SAVE_VERSION, state });
      const storage = memoryGameStorage();
      storage.setItem(STORAGE_KEY, saved);
      assertDeepEqual(loadGame(storage), { state: createGameState(), status: "invalid" });
      assertEqual(storage.getItem(STORAGE_KEY), saved);
    }
  });

  test("Attack saves whitelist overlays, omit UI/derived values, and deep-copy both boards", () => {
    const initial = { board: boardFixture(["A1", 16], ["B1", 24]), undo: null };
    const state = freezeGameCell(freezeGameCell(initial, "A1"), "B1");
    const enriched = { ...state, score: 40, selectedActionCell: "B1", challengeWinner: "unused" };
    enriched.board[0][1].selected = true;
    const saved = serializeGame(enriched);
    const restored = deserializeGame(saved);
    assertDeepEqual(Object.keys(JSON.parse(saved).state), ["board", "undo"]);
    assertDeepEqual(getCell(restored.board, "B1"), { value: 24, status: "normal", attackIce: true });
    assert(isCellAttackIced(restored.undo.board, "A1"));
    assertEqual(restored.board[0][1].selected, undefined);
    delete restored.board[0][1].attackIce;
    delete restored.undo.board[0][0].attackIce;
    assert(isCellAttackIced(state.board, "B1"));
    assert(isCellAttackIced(state.undo.board, "A1"));
  });

  test("Attack data in a malformed Undo snapshot cannot be silently stripped or repaired", () => {
    const state = freezeGameCell({ board: boardFixture(["A1", 16], ["B1", 24]), undo: null }, "B1");
    state.undo.board[0][0].attackIce = true;
    state.undo.board[0][1].attackIce = true;
    const saved = JSON.stringify({ version: SAVE_VERSION, state });
    assertEqual(deserializeGame(saved), null);
    assert(!isValidStoredState(state));
  });

  return results;
}
