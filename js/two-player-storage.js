import { cloneTwoPlayerState, createTwoPlayerState, isValidTwoPlayerState } from "./two-player-game.js?v=frontline-1";

export const TWO_PLAYER_STORAGE_KEY = "frosty-dice.two-player-game";
export const GAME_MODE_KEY = "frosty-dice.game-mode";
export const TWO_PLAYER_SAVE_VERSION = 1;
const target = (storage) => storage === undefined ? globalThis.localStorage : storage;

export function serializeTwoPlayerGame(state) {
  return JSON.stringify({ version: TWO_PLAYER_SAVE_VERSION, state: cloneTwoPlayerState(state) });
}
export function deserializeTwoPlayerGame(serialized) {
  try {
    if (typeof serialized !== "string") return null;
    const data = JSON.parse(serialized);
    return data?.version === TWO_PLAYER_SAVE_VERSION && isValidTwoPlayerState(data.state) ? cloneTwoPlayerState(data.state) : null;
  } catch { return null; }
}
export function loadTwoPlayerGame(storage) {
  try {
    const saved = target(storage).getItem(TWO_PLAYER_STORAGE_KEY);
    if (saved === null) return { state: createTwoPlayerState(), status: "missing" };
    const state = deserializeTwoPlayerGame(saved);
    return { state: state ?? createTwoPlayerState(), status: state ? "restored" : "invalid" };
  } catch { return { state: createTwoPlayerState(), status: "unavailable" }; }
}
export function saveTwoPlayerGame(state, storage) {
  try { target(storage).setItem(TWO_PLAYER_STORAGE_KEY, serializeTwoPlayerGame(state)); return true; } catch { return false; }
}
export function clearTwoPlayerGame(storage) {
  try { target(storage).removeItem(TWO_PLAYER_STORAGE_KEY); return true; } catch { return false; }
}
export function readGameMode(storage) {
  try { return target(storage).getItem(GAME_MODE_KEY) === "2p" ? "2p" : "3p-plus"; } catch { return "3p-plus"; }
}
export function writeGameMode(mode, storage) {
  if (!["2p", "3p-plus"].includes(mode)) return false;
  try { target(storage).setItem(GAME_MODE_KEY, mode); return true; } catch { return false; }
}
