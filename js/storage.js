import {
  createGameState,
  generateRollNumbers,
  getRollOptions,
  isSchnapszahl,
  isValidBoard,
  isValidDieValue,
} from "./game.js";

export const STORAGE_KEY = "frosty-dice.game";
export const SAVE_VERSION = 1;

function isStorageRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isValidStoredState(state) {
  if (!isStorageRecord(state) || !isValidBoard(state.board)
      || !Number.isSafeInteger(state.ownRollCount) || state.ownRollCount < 0) {
    return false;
  }

  const roll = state.currentRoll;
  if (roll !== null) {
    if (!isStorageRecord(roll) || !Array.isArray(roll.dice) || roll.dice.length !== 2
        || !isValidDieValue(roll.dice[0]) || !isValidDieValue(roll.dice[1])
        || !["pending", "placed", "failed"].includes(roll.status) || state.ownRollCount === 0) {
      return false;
    }
    if (roll.status === "pending"
        && !getRollOptions(state.board, ...roll.dice).some((option) => option.targets.length > 0)) {
      return false;
    }
  }

  const action = state.schnapszahlAction;
  if (action !== null) {
    if (!isStorageRecord(action) || !isSchnapszahl(action.value)
        || roll === null || roll.status !== "placed"
        || !generateRollNumbers(...roll.dice).includes(action.value)
        || !state.board.some((row) => row.includes(action.value))) {
      return false;
    }
  }
  return true;
}

// Whitelist canonical state; never serialize score, targets, goal, or UI drafts.
function canonicalStoredState(state) {
  return {
    board: state.board.map((row) => [...row]),
    ownRollCount: state.ownRollCount,
    currentRoll: state.currentRoll === null ? null : {
      dice: [...state.currentRoll.dice],
      status: state.currentRoll.status,
    },
    schnapszahlAction: state.schnapszahlAction === null ? null : {
      value: state.schnapszahlAction.value,
    },
  };
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
    if (!isStorageRecord(payload) || payload.version !== SAVE_VERSION || !isValidStoredState(payload.state)) {
      return null;
    }
    return canonicalStoredState(payload.state);
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
