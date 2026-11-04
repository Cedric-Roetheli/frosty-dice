// Deterministic demonstration data; no live game, storage, randomness, or turns.
import { applyAttackIce, cloneBoard, createEmptyBoard, placeNumber, removeAttackIce } from "./game.js?v=receipt-2";
import { getScoreBreakdown } from "./scoring.js?v=v3-multipliers-1";

function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

export const EXAMPLE_PLACEMENTS = freeze([["A1", 12], ["B1", 24], ["C1", 46], ["C2", 46], ["B2", 35]]);
export const FINAL_PLACEMENTS = freeze([
  ["D1", 56], ["D2", 56], ["C3", 46], ["B3", 35], ["A2", 12], ["A3", 12],
  ["A4", 12], ["B4", 24], ["C4", 46], ["D3", 56], ["D4", 56], ["C5", 46],
  ["B5", 34], ["A5", 22], ["A6", 22], ["B6", 34], ["C6", 46], ["D5", 56],
  ["D6", 56], ["A7", 22], ["B7", 34], ["C7", 46], ["D7", 56],
]);
export const EXAMPLE_CHALLENGE = freeze({ bids: { A: 30, B: 50 }, winner: "B", actions: ["freeze", "unfreeze"], beforeDice: true, tieWinner: null, tieAction: "bid-again" });

export function boardFromPlacements(placements) {
  return placements.reduce((board, [coordinate, value]) => placeNumber(board, coordinate, value), createEmptyBoard());
}

const prefixes = freeze(Array.from({ length: 6 }, (_, count) => boardFromPlacements(EXAMPLE_PLACEMENTS.slice(0, count))));
const opponent = freeze(applyAttackIce(boardFromPlacements([["A1", 22], ["A2", 22], ["B2", 34]]), "B2"));
const finalBoards = freeze(Object.fromEntries(EXAMPLE_CHALLENGE.actions.map((action) => {
  const board = action === "freeze" ? applyAttackIce(prefixes[5], "B2") : prefixes[5];
  return [action, FINAL_PLACEMENTS.reduce((current, [coordinate, value]) => placeNumber(current, coordinate, value), board)];
})));

export const TUTORIAL_STEPS = freeze([
  { id: 1, type: "goal", title: { en: "The Goal", de: "Das Spielziel" }, text: {
    en: "Start at A1 and work your way to D7. Every number you place earns points!",
    de: "Starte bei A1 und arbeite dich bis D7 vor. Jede platzierte Zahl bringt Punkte!" } },
  { id: 2, type: "dice", title: { en: "Roll the Dice", de: "Würfeln" }, text: {
    en: "Roll four dice on your turn.", de: "Würfle in deinem Zug mit vier Würfeln." } },
  { id: 3, type: "number", title: { en: "Make a Number", de: "Zahlen bilden" }, text: {
    en: "Choose two dice to make a two-digit number. Their order matters!",
    de: "Wähle zwei Würfel und bilde eine zweistellige Zahl. Die Reihenfolge zählt!" } },
  { id: 4, type: "placement", title: { en: "Place Your Number", de: "Zahlen platzieren" }, text: {
    en: "Place your first number at A1. Build your board by adding more numbers.",
    de: "Setze deine erste Zahl auf A1. Fülle dein Brett nach und nach mit weiteren Zahlen." } },
  { id: 5, type: "neighbors", title: { en: "Stay Connected", de: "Nachbarschaft" }, text: {
    en: "New numbers must touch an occupied, usable cell. Diagonals don’t count!",
    de: "Neue Zahlen müssen an ein belegtes, nutzbares Feld angrenzen. Diagonal zählt nicht!" } },
  { id: 6, type: "right", title: { en: "Going Right", de: "Nach rechts" }, text: {
    en: "To the right, numbers must be larger. To the left, smaller.",
    de: "Nach rechts müssen Zahlen grösser sein, nach links kleiner." } },
  { id: 7, type: "vertical", title: { en: "Going Up & Down", de: "Nach oben & unten" }, text: {
    en: "To place a number using a vertical neighbor, both numbers must match.",
    de: "Bei einer vertikalen Verbindung müssen beide Zahlen gleich sein." } },
  { id: 8, type: "left", title: { en: "Going Left", de: "Nach links" }, text: {
    en: "35 fits left of 46. It doesn’t need to match the 24 above—one valid connection is enough!",
    de: "35 passt links neben 46. Die 24 darüber muss nicht übereinstimmen – eine gültige Verbindung genügt!" } },
  { id: 9, type: "challenge", title: { en: "Challenge!", de: "Challenge!" }, text: {
    en: "Before rolling, you can challenge another player and bid Frosty Dollars!",
    de: "Vor dem Würfeln kannst du einen Mitspieler herausfordern und Frosty Dollars bieten!" } },
  { id: 10, type: "bids", title: { en: "Place Your Bids", de: "Gebote abgeben" }, text: {
    en: "Both players bid secretly. Both bids are spent, whether you win or lose.",
    de: "Beide Spieler bieten verdeckt. Die Gebote werden unabhängig vom Ergebnis abgezogen." } },
  { id: 11, type: "winner", title: { en: "The Winner Decides", de: "Der Gewinner entscheidet" }, text: {
    en: "The higher bid wins! The winner can freeze an opponent’s cell or unfreeze one of their own.",
    de: "Das höhere Gebot gewinnt! Der Gewinner darf ein gegnerisches Feld einfrieren oder ein eigenes auftauen." } },
  { id: 12, type: "finish", title: { en: "The Finish Line", de: "Das Ziel" }, text: {
    en: "The player who reaches D7 first wins! If two players reach D7 at the same time, the player with more Frosty Dollars wins.",
    de: "Wer D7 zuerst erreicht, gewinnt! Erreichen zwei Spieler D7 gleichzeitig, gewinnt der Spieler mit mehr Frosty Dollars." } },
]);

export function getTutorialScene(step, action = "freeze") {
  if (!Number.isInteger(step) || step < 1 || step > TUTORIAL_STEPS.length) throw new RangeError("Choose tutorial step 1–12.");
  if (!EXAMPLE_CHALLENGE.actions.includes(action)) throw new RangeError("Choose one example action.");
  const count = step < 4 ? 0 : step < 7 ? 3 : step === 7 ? 4 : 5;
  let boardA = prefixes[count];
  let boardB = step >= 9 && step <= 11 ? opponent : null;
  if (step === 11) {
    if (action === "freeze") boardA = applyAttackIce(boardA, "B2");
    else boardB = removeAttackIce(boardB, "B2");
  }
  if (step === 12) boardA = finalBoards[action];
  const pointsSpent = step >= 10 ? 30 : 0;
  return {
    ...TUTORIAL_STEPS[step - 1],
    boardA: cloneBoard(boardA), boardB: boardB === null ? null : cloneBoard(boardB),
    action, pointsSpent, opponentSpent: step >= 10 ? 50 : 0,
    scoring: getScoreBreakdown(boardA, pointsSpent),
  };
}

// One canonical 400 × 700 board, viewed through full or cropped camera windows.
export function getTutorialCamera(step, width, height, player = "A") {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) throw new RangeError("Use positive camera bounds.");
  const scene = TUTORIAL_STEPS[step - 1];
  if (!scene) throw new RangeError("Choose tutorial step 1–12.");
  const paired = step >= 9 && step <= 11;
  const rows = step === 1 || step === 12 ? 7 : 2.45;
  const columns = paired ? 2.45 : 4;
  const column = paired && player === "A" ? 1 : 0;
  const availableWidth = paired ? (width - 12) / 1.8 : width;
  const availableHeight = paired ? (height - 72) / 2 - 32 : height - 72;
  const scale = Math.min(availableWidth / (columns * 100), availableHeight / (rows * 100));
  return { rows, columns, row: 0, column, scale, width: columns * 100 * scale, height: rows * 100 * scale, x: -column * 100 * scale, y: 0 };
}
