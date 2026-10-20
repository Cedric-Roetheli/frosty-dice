import { BOARD_COLUMNS, BOARD_ROW_COUNT, cloneGameState, createGameState, isPrimeNumber, isValidBoard, isValidGameState } from "./game.js?v=v3-multipliers-1";

export const STORAGE_KEY = "frosty-dice.game";
export const SAVE_VERSION = 7;

function isStorageRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isValidStoredState(state) {
  // Do not silently discard a legacy flag that could contradict permanent damage.
  return isValidGameState(state) && hasCanonicalCells(state.board)
    && (state.undo == null || hasCanonicalCells(state.undo.board));
}

function hasCanonicalCells(board) {
  return board.every((row) => row.every((cell) => cell === null
    || !Object.prototype.hasOwnProperty.call(cell, "frozen")));
}

// Whitelist canonical state; never serialize score, targets, goal, or UI drafts.
function canonicalStoredState(state) {
  return cloneGameState(state);
}

function hasLegacyCells(board) {
  // Attack Ice never existed in these versions; reject mixed development saves.
  return isValidBoard(board) && hasCanonicalCells(board)
    && board.every((row) => row.every((cell) => cell === null
      || !Object.prototype.hasOwnProperty.call(cell, "attackIce")));
}

function migrateVersion5State(state) {
  return hasNoLegacySpending(state) && isValidStoredState(state) && hasLegacyCells(state.board)
    && (state.undo == null || hasLegacyCells(state.undo.board)) ? state : null;
}

function hasNoLegacySpending(state) {
  return isStorageRecord(state) && !Object.prototype.hasOwnProperty.call(state, "pointsSpent")
    && (state.undo == null || (isStorageRecord(state.undo)
      && !Object.prototype.hasOwnProperty.call(state.undo, "pointsSpent")));
}

function migrateVersion6State(state) {
  return hasNoLegacySpending(state) && isValidStoredState(state) ? state : null;
}

function migrateBoardOnlyState(state) {
  if (!hasNoLegacySpending(state) || !hasLegacyCells(state.board)) return null;
  // Older formats never stored a previous board: do not infer an Undo history.
  const migrated = { board: state.board, undo: null };
  return isValidStoredState(migrated) ? migrated : null;
}

function migrateVersion2State(state) {
  if (!hasNoLegacySpending(state) || !Array.isArray(state.board) || state.board.length !== BOARD_ROW_COUNT) return null;
  const board = [];
  for (const row of state.board) {
    if (!Array.isArray(row) || row.length !== BOARD_COLUMNS.length) return null;
    const entries = [];
    for (const cell of row) {
      if (cell === null) {
        entries.push(null);
      } else {
        if (!isStorageRecord(cell) || typeof cell.frozen !== "boolean"
            || Object.prototype.hasOwnProperty.call(cell, "status")
            || Object.prototype.hasOwnProperty.call(cell, "attackIce")) return null;
        entries.push({ value: cell.value, status: cell.frozen ? "frozen" : "normal" });
      }
    }
    board.push(entries);
  }
  const migrated = { board, undo: null };
  // Multiple old freezes have no chronology: never guess which one is current.
  return isValidStoredState(migrated) ? migrated : null;
}

function migrateVersion3State(state) {
  const migrated = migrateBoardOnlyState(state);
  if (migrated === null) return null;
  // Version 3 only allowed primes in damaged cells; keep rejecting malformed old saves.
  return migrated.board.every((row) => row.every((cell) => cell === null
    || cell.status !== "thawed" || isPrimeNumber(cell.value))) ? migrated : null;
}

export function serializeGame(state) {
  if (!isValidStoredState(state)) {
    throw new TypeError("Cannot save invalid game state.");
  }
  return JSON.stringify({ version: SAVE_VERSION, state: canonicalStoredState(state) });
}

export function deserializeGame(serialized) {
  try {
    if (typeof serialized !== "string") {
      return null;
    }
    const payload = JSON.parse(serialized);
    if (!isStorageRecord(payload)) return null;
    const state = payload.version === SAVE_VERSION ? payload.state
      : payload.version === 6 ? migrateVersion6State(payload.state)
      : payload.version === 5 ? migrateVersion5State(payload.state)
      : payload.version === 4 ? migrateBoardOnlyState(payload.state)
      : payload.version === 3 ? migrateVersion3State(payload.state)
      : payload.version === 2 ? migrateVersion2State(payload.state) : null;
    return isValidStoredState(state) ? canonicalStoredState(state) : null;
  } catch {
    return null;
  }
}

// Resolve browser storage inside each caller's try block: even access can throw.
function gameStorageTarget(storage) {
  return storage === undefined ? globalThis.localStorage : storage;
}

export function saveGame(state, storage) {
  try {
    const serialized = serializeGame(state);
    gameStorageTarget(storage).setItem(STORAGE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

export function loadGame(storage) {
  try {
    const serialized = gameStorageTarget(storage).getItem(STORAGE_KEY);
    if (serialized === null) {
      return { state: createGameState(), status: "missing" };
    }
    const state = deserializeGame(serialized);
    return state
      ? { state, status: "restored" }
      : { state: createGameState(), status: "invalid" };
  } catch {
    return { state: createGameState(), status: "unavailable" };
  }
}

export function clearSavedGame(storage) {
  try {
    gameStorageTarget(storage).removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
