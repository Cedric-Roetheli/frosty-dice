import {
  confirmOwnRoll,
  createGameState,
  finishSchnapszahlAction,
  getCellValue,
  getLegalTargetCells,
  getRollOptions,
  hasReachedGoal,
  placeExternalNumber,
  placeOwnRollNumber,
  placeStolenNumber,
  prepareNextOwnRoll,
  removeOwnNumber,
} from "../js/game.js";
import { getScoreBreakdown } from "../js/scoring.js";
import {
  SAVE_VERSION,
  STORAGE_KEY,
  clearSavedGame,
  deserializeGame,
  isValidStoredState,
  loadGame,
  saveGame,
  serializeGame,
} from "../js/storage.js";
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
    try {
      action();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, message: error.message });
    }
  }

  test("An initial save contains only versioned canonical game state", () => {
    const state = createGameState();
    assertDeepEqual(JSON.parse(serializeGame(state)), { version: SAVE_VERSION, state });
    assertDeepEqual(deserializeGame(serializeGame(state)), state);
  });

  test("Board, own-roll count, and dice round-trip into independent arrays", () => {
    const state = placeOwnRollNumber(confirmOwnRoll(createGameState(), 1, 6), "A1", 16);
    const restored = deserializeGame(serializeGame(state));
    assertDeepEqual(restored, state);
    assert(restored.board !== state.board);
    assert(restored.board.every((row, index) => row !== state.board[index]));
    assert(restored.currentRoll.dice !== state.currentRoll.dice);
    restored.board[0][0] = null;
    restored.currentRoll.dice[0] = 2;
    assertEqual(getCellValue(state.board, "A1"), 16);
    assertEqual(state.currentRoll.dice[0], 1);
  });

  test("Serialization and restoration discard derived values and UI drafts", () => {
    const state = confirmOwnRoll(createGameState(), 1, 6);
    const extras = { ...state, score: 999, streetRows: [1], goalReached: true, selectedNumber: 61 };
    extras.currentRoll = { ...state.currentRoll, targets: ["D7"] };
    assertDeepEqual(JSON.parse(serializeGame(extras)).state, state);
    assertDeepEqual(deserializeGame(JSON.stringify({ version: SAVE_VERSION, state: extras })), state);
    const special = placeOwnRollNumber(confirmOwnRoll(createGameState(), 3, 3), "A1", 33);
    assertDeepEqual(deserializeGame(serializeGame({
      ...special, schnapszahlAction: { value: 33, opponent: "not saved" },
    })), special);
  });

  test("A restored pending own roll resumes with targets and cannot be counted again", () => {
    const pending = confirmOwnRoll(createGameState(), 1, 6);
    const restored = deserializeGame(serializeGame(pending));
    assertDeepEqual(getRollOptions(restored.board, ...restored.currentRoll.dice), getRollOptions(pending.board, 1, 6));
    assertThrows(() => confirmOwnRoll(restored, 1, 6), "already confirmed");
    const placed = placeOwnRollNumber(restored, "A1", 16);
    assertEqual(placed.ownRollCount, 1);
    assertEqual(getCellValue(placed.board, "A1"), 16);
  });

  test("A restored successful own roll remains completed and counted once", () => {
    const state = placeOwnRollNumber(confirmOwnRoll(createGameState(), 1, 6), "A1", 16);
    const restored = deserializeGame(serializeGame(state));
    assertThrows(() => confirmOwnRoll(restored, 1, 6), "already confirmed");
    assertThrows(() => placeOwnRollNumber(restored, "A2", 16), "finished roll");
    assertEqual(prepareNextOwnRoll(restored).ownRollCount, 1);
  });

  test("A restored failed own roll stays counted once until a new roll is confirmed", () => {
    const initial = placeExternalNumber(createGameState(), "A1", 66);
    const failed = confirmOwnRoll(initial, 1, 2);
    const restored = deserializeGame(serializeGame(failed));
    assertEqual(restored.currentRoll.status, "failed");
    assertEqual(restored.ownRollCount, 1);
    assertThrows(() => confirmOwnRoll(restored, 1, 2), "already confirmed");
    assertEqual(confirmOwnRoll(prepareNextOwnRoll(restored), 1, 2).ownRollCount, 2);
  });

  test("An unfinished Schnapszahl action survives reload and can place a stolen number", () => {
    const special = placeOwnRollNumber(confirmOwnRoll(createGameState(), 3, 3), "A1", 33);
    const restored = deserializeGame(serializeGame(special));
    assertDeepEqual(restored.schnapszahlAction, { value: 33 });
    assertThrows(() => prepareNextOwnRoll(restored), "Finish the Schnapszahl");
    const stolen = placeStolenNumber(restored, "B1", 46);
    assertEqual(getCellValue(stolen.board, "B1"), 46);
    assertEqual(stolen.ownRollCount, 1);
    assertEqual(stolen.schnapszahlAction, null);
  });

  test("Finished or consumed Schnapszahl actions do not retrigger after reload", () => {
    const special = placeOwnRollNumber(confirmOwnRoll(createGameState(), 3, 3), "A1", 33);
    for (const state of [finishSchnapszahlAction(special), placeStolenNumber(special, "B1", 46)]) {
      const restored = deserializeGame(serializeGame(state));
      assertEqual(restored.schnapszahlAction, null);
      assertEqual(getCellValue(restored.board, "A1"), 33);
      assertEqual(prepareNextOwnRoll(restored).ownRollCount, 1);
    }
  });

  test("Removed and disconnected cells restore with scoring, targets, and goal derived afresh", () => {
    let state = createGameState();
    for (let row = 1; row <= 7; row += 1) {
      state = placeExternalNumber(state, `A${row}`, 16);
    }
    for (const [coordinate, value] of [["B7", 24], ["C7", 35], ["D7", 46]]) {
      state = placeExternalNumber(state, coordinate, value);
    }
    state = removeOwnNumber(state, "A1");
    state = removeOwnNumber(state, "C7");
    state.ownRollCount = 2;
    const restored = deserializeGame(serializeGame(state));
    assertEqual(getCellValue(restored.board, "A1"), null);
    assertEqual(getCellValue(restored.board, "C7"), null);
    assert(hasReachedGoal(restored.board));
    assertEqual(getScoreBreakdown(restored.board, restored.ownRollCount).score, 83);
    assert(getLegalTargetCells(restored.board, 35).includes("C7"));
    const removedGoal = deserializeGame(serializeGame(removeOwnNumber(restored, "D7")));
    assert(!hasReachedGoal(removedGoal.board));
  });

  test("Street bonuses and scores are recalculated from restored canonical data", () => {
    let state = createGameState();
    for (const [coordinate, value] of [["A1", 11], ["B1", 12], ["C1", 13], ["D1", 14]]) {
      state = placeExternalNumber(state, coordinate, value);
    }
    state.ownRollCount = 2;
    const restored = deserializeGame(serializeGame(state));
    const scoring = getScoreBreakdown(restored.board, restored.ownRollCount);
    assertDeepEqual(scoring.streetRows, [1]);
    assertEqual(scoring.streetBonus, 50);
    assertEqual(scoring.score, 50);
  });

  test("Missing storage returns a fresh game without creating a save", () => {
    const storage = memoryGameStorage();
    assertDeepEqual(loadGame(storage), { state: createGameState(), status: "missing" });
    assertEqual(storage.values.size, 0);
  });

  test("Saving and loading use only the game key and preserve unrelated storage", () => {
    const storage = memoryGameStorage();
    storage.setItem("other-app", "untouched");
    const state = placeExternalNumber(createGameState(), "A1", 16);
    assert(saveGame(state, storage));
    assertEqual(storage.getItem(STORAGE_KEY), serializeGame(state));
    assertDeepEqual(loadGame(storage), { state, status: "restored" });
    assertEqual(storage.getItem("other-app"), "untouched");
  });

  test("Malformed or incompatible serialized data is safely rejected", () => {
    for (const serialized of [
      undefined, null, 42, "", "{", "null", "[]", "true", "{}",
      JSON.stringify({ version: 0, state: createGameState() }),
      JSON.stringify({ version: SAVE_VERSION + 1, state: createGameState() }),
      JSON.stringify({ version: String(SAVE_VERSION), state: createGameState() }),
      JSON.stringify({ state: createGameState() }),
      JSON.stringify({ version: SAVE_VERSION }),
    ]) {
      assertEqual(deserializeGame(serialized), null);
    }
  });

  test("Invalid board shapes, values, and sparse cells cannot be saved or restored", () => {
    const badValue = createGameState().board;
    badValue[0][0] = 17;
    const sparse = createGameState().board;
    delete sparse[0][0];
    for (const board of [null, [], Array(7).fill([]), badValue, sparse]) {
      const state = { ...createGameState(), board };
      assert(!isValidStoredState(state));
      assertThrows(() => serializeGame(state), "invalid game state");
    }
    for (const value of ["16", 70, 5, 123, 0, false, {}]) {
      const state = createGameState();
      state.board[0][0] = value;
      assertEqual(deserializeGame(JSON.stringify({ version: SAVE_VERSION, state })), null);
    }
  });

  test("The saved own-roll count must be a non-negative safe integer", () => {
    for (const ownRollCount of [-1, 0.5, "1", null, undefined, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      assert(!isValidStoredState({ ...createGameState(), ownRollCount }));
    }
    assert(isValidStoredState({ ...createGameState(), ownRollCount: Number.MAX_SAFE_INTEGER }));
  });

  test("Saved roll metadata and required state fields are validated", () => {
    for (const currentRoll of [
      undefined, [], {}, { dice: [1], status: "pending" },
      { dice: [1, 6, 1], status: "pending" }, { dice: [0, 6], status: "pending" },
      { dice: [1, 7], status: "pending" }, { dice: ["1", 6], status: "pending" },
      { dice: [1, 6], status: "unknown" },
    ]) {
      assert(!isValidStoredState({ ...createGameState(), ownRollCount: 1, currentRoll }));
    }
    assert(!isValidStoredState({ ...createGameState(), currentRoll: { dice: [1, 6], status: "pending" } }));
    assert(!isValidStoredState({ ...createGameState(), schnapszahlAction: undefined }));
    assert(!isValidStoredState(null));
    assert(!isValidStoredState([]));
  });

  test("A corrupt pending roll with no legal placement is rejected", () => {
    const state = placeExternalNumber(createGameState(), "A1", 66);
    state.ownRollCount = 1;
    state.currentRoll = { dice: [1, 2], status: "pending" };
    assert(!isValidStoredState(state));
    assertEqual(deserializeGame(JSON.stringify({ version: SAVE_VERSION, state })), null);
  });

  test("A saved special action must match an already-placed own double", () => {
    const special = placeOwnRollNumber(confirmOwnRoll(createGameState(), 3, 3), "A1", 33);
    for (const state of [
      { ...special, schnapszahlAction: { value: 16 } },
      { ...special, schnapszahlAction: { value: 22 } },
      { ...special, schnapszahlAction: [] },
      { ...special, currentRoll: null },
      { ...special, currentRoll: { dice: [3, 3], status: "pending" } },
      { ...special, currentRoll: { dice: [3, 3], status: "failed" } },
      { ...special, board: createGameState().board },
    ]) {
      assert(!isValidStoredState(state));
    }
  });

  test("Completed roll history survives later removal or newly available placements", () => {
    const placed = placeOwnRollNumber(confirmOwnRoll(createGameState(), 1, 6), "A1", 16);
    const removed = removeOwnNumber(placed, "A1");
    assertDeepEqual(deserializeGame(serializeGame(removed)), removed);
    const failed = confirmOwnRoll(placeExternalNumber(createGameState(), "A1", 66), 1, 2);
    const nowEmpty = removeOwnNumber(failed, "A1");
    const restored = deserializeGame(serializeGame(nowEmpty));
    assertEqual(restored.currentRoll.status, "failed");
    assertEqual(restored.ownRollCount, 1);
    assertThrows(() => placeOwnRollNumber(restored, "A1", 12), "finished roll");
  });

  test("Serialization and validation do not mutate frozen game state", () => {
    const state = confirmOwnRoll(createGameState(), 1, 6);
    const before = JSON.stringify(state);
    state.board.forEach(Object.freeze);
    Object.freeze(state.board);
    Object.freeze(state.currentRoll.dice);
    Object.freeze(state.currentRoll);
    Object.freeze(state);
    assert(isValidStoredState(state));
    assertDeepEqual(deserializeGame(serializeGame(state)), state);
    assertEqual(JSON.stringify(state), before);
  });

  test("Loading a corrupt save returns a fresh game and preserves the original record", () => {
    const storage = memoryGameStorage();
    for (const serialized of ["{", JSON.stringify({ version: SAVE_VERSION + 1, state: createGameState() })]) {
      storage.setItem(STORAGE_KEY, serialized);
      assertDeepEqual(loadGame(storage), { state: createGameState(), status: "invalid" });
      assertEqual(storage.getItem(STORAGE_KEY), serialized);
    }
  });

  test("Invalid state cannot overwrite an existing valid save", () => {
    const storage = memoryGameStorage();
    const state = createGameState();
    assert(saveGame(state, storage));
    assert(!saveGame({ ...state, ownRollCount: -1 }, storage));
    assertEqual(storage.getItem(STORAGE_KEY), serializeGame(state));
  });

  test("Storage read, quota, and removal failures return safe results", () => {
    const unavailable = {
      getItem() { throw new Error("Storage unavailable"); },
      setItem() { throw new Error("Quota exceeded"); },
      removeItem() { throw new Error("Storage unavailable"); },
    };
    for (const storage of [unavailable, null]) {
      assertDeepEqual(loadGame(storage), { state: createGameState(), status: "unavailable" });
      assertEqual(saveGame(createGameState(), storage), false);
      assertEqual(clearSavedGame(storage), false);
    }
  });

  test("Even a throwing localStorage property is handled without a crash", () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    try {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        get() { throw new Error("Access denied"); },
      });
      assertEqual(loadGame().status, "unavailable");
      assertEqual(saveGame(createGameState()), false);
      assertEqual(clearSavedGame(), false);
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, "localStorage", descriptor);
      } else {
        delete globalThis.localStorage;
      }
    }
  });

  test("Clearing a saved game removes only its key and leaves the next load initial", () => {
    const storage = memoryGameStorage();
    storage.setItem("other-app", "untouched");
    assert(saveGame(confirmOwnRoll(createGameState(), 1, 6), storage));
    assert(clearSavedGame(storage));
    assertEqual(storage.getItem(STORAGE_KEY), null);
    assertEqual(storage.getItem("other-app"), "untouched");
    assertDeepEqual(loadGame(storage), { state: createGameState(), status: "missing" });
    assert(clearSavedGame(storage));
  });

  return results;
}
