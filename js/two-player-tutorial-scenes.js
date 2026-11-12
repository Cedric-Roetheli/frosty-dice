// Fixed, rule-checked teaching examples. These states never touch a live game.
import { createTwoPlayerState, getTwoPlayerDuels, placeTwoPlayerNumber, cloneTwoPlayerState } from "./two-player-game.js?v=frontline-1";

function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

export const TWO_PLAYER_TUTORIAL_STEPS = freeze([
  { id: 1, title: { en: "Two Players, One Device", de: "Zwei Spieler, ein Handy" }, text: {
    en: "Play face-to-face on one phone! Each player has their own board. The original Frosty Dice rules still apply.",
    de: "Spielt euch auf einem Handy gegenüber! Jeder hat sein eigenes Spielfeld. Die grundlegenden Frosty-Dice-Regeln bleiben gleich." } },
  { id: 2, title: { en: "Share the Dice", de: "Würfel teilen" }, text: {
    en: "Roll four dice. The active player chooses two to make a number. The other player may use the remaining two. Both can choose the digit order.",
    de: "Würfelt mit vier Würfeln. Der aktive Spieler wählt zwei für seine Zahl. Der andere darf die übrigen zwei verwenden. Beide bestimmen die Reihenfolge selbst." } },
  { id: 3, title: { en: "Place Your Numbers", de: "Zahlen eintragen" }, text: {
    en: "Start in any cell of your outer row. After that, each new number needs a valid neighboring cell.",
    de: "Beginne in einem beliebigen Feld deiner äusseren Reihe. Danach benötigt jede neue Zahl einen gültigen Nachbarn." } },
  { id: 4, title: { en: "Follow the Arrows", de: "Folge den Pfeilen" }, text: {
    en: "On both boards, numbers increase in the direction of the colored arrows. Vertically, neighboring numbers must be equal.",
    de: "Auf beiden Spielfeldern steigen die Zahlen in Pfeilrichtung. Vertikal müssen benachbarte Zahlen gleich sein." } },
  { id: 5, title: { en: "The Frosty Frontline", de: "Die Frosty Frontline" }, text: {
    en: "Each column is a battle! The Frontline moves with your points, and each colored dot shows who leads that column.",
    de: "Jede Spalte ist ein Duell! Die Frontline bewegt sich mit euren Punkten. Die farbigen Punkte zeigen, wer die jeweilige Spalte anführt." } },
  { id: 6, title: { en: "Win the Column Battles", de: "Gewinne die Spaltenduelle" }, text: {
    en: "When a player fills all 15 cells, finish the current roll. The player winning more columns wins. Equal column victories mean a draw.",
    de: "Sobald ein Spieler alle 15 Felder gefüllt hat, beendet ihr den aktuellen Wurf. Wer mehr Spalten gewinnt, gewinnt. Bei gleich vielen Spaltensiegen endet das Spiel unentschieden." } },
]);

// Each inner group is one visible animation stage. Use the actual guarded 2P
// placement path, then discard its demo-only Undo snapshot.
const horizontal = [
  [[2, "A3", 44]], [[2, "B3", 46]],
];
const direction = [
  [[1, "E3", 12], [2, "A3", 12]],
  [[1, "D3", 24], [2, "B3", 24]],
  [[1, "C3", 46], [2, "C3", 46]],
  [[1, "D2", 24], [2, "B2", 24]],
];
const duel = [
  [[1, "C3", 24]], [[2, "C3", 12]], [[2, "C2", 12]],
];
const finalP1 = [14, 24, 35, 46, 56];
const finalP2 = [12, 25, 34, 45, 66];
const finish = finalP1.map((value, physical) => {
  const p1 = "EDCBA"[physical], p2 = "ABCDE"[physical];
  return [3, 2, 1].flatMap((row) => [[1, p1 + row, value], [2, p2 + row, finalP2[physical]]]);
});

export const TWO_PLAYER_DEMO_ACTIONS = freeze({ 1: [], 2: [], 3: horizontal, 4: direction, 5: duel, 6: finish });

function stages(groups) {
  const result = [createTwoPlayerState()];
  for (const group of groups) {
    let state = result.at(-1);
    for (const [player, coordinate, value] of group) {
      state = { ...placeTwoPlayerNumber(state, player, coordinate, value), undo: null };
    }
    result.push(state);
  }
  return freeze(result);
}

const DEMOS = freeze(Object.fromEntries(Object.entries(TWO_PLAYER_DEMO_ACTIONS).map(([step, groups]) => [step, stages(groups)])));

export function getTwoPlayerTutorialStageCount(step) {
  if (!Number.isInteger(step) || step < 1 || step > TWO_PLAYER_TUTORIAL_STEPS.length) throw new RangeError("Choose 2P tutorial step 1–6.");
  return DEMOS[step].length;
}

export function getTwoPlayerTutorialScene(step, stage = getTwoPlayerTutorialStageCount(step) - 1) {
  if (!Number.isInteger(stage) || stage < 0 || stage >= getTwoPlayerTutorialStageCount(step)) throw new RangeError("Choose a valid demonstration stage.");
  const state = cloneTwoPlayerState(DEMOS[step][stage]);
  const duels = getTwoPlayerDuels(state);
  return { ...TWO_PLAYER_TUTORIAL_STEPS[step - 1], stage, state, duels,
    highlights: stage > 0 ? TWO_PLAYER_DEMO_ACTIONS[step][stage - 1].map(([player, coordinate]) => [player, coordinate]) : [],
    victories: {
      player1: duels.filter((item) => item.player1.lit).length,
      player2: duels.filter((item) => item.player2.lit).length,
    },
  };
}
