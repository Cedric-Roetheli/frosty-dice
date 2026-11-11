import { cloneTwoPlayerState, createTwoPlayerState, getTwoPlayerDuels, getTwoPlayerHorizontalDirection, placeTwoPlayerNumber, TWO_PLAYER_COLUMNS, TWO_PLAYER_START_ROW, undoTwoPlayerMove } from "./two-player-game.js?v=frontline-1";
import { clearTwoPlayerGame, loadTwoPlayerGame, saveTwoPlayerGame } from "./two-player-storage.js?v=frontline-1";
import { getCellScoreMultiplier } from "./scoring.js?v=v3-multipliers-1";
import { createFrontlineGeometry, directionArrowGeometry, frontlineFraction } from "./two-player-frontline.js?v=frontline-guides-2";

const copy = {
  en: { player: "Player", empty: "empty", start: "Start", frozen: "Frozen · 0 points · unusable", thawed: "Thawed · permanently 0 points · usable", input: "Choose two digits from 1–6", ready: "Tap an empty cell to enter a number.", placed: "placed at", undone: "Last move undone.", reset: "New two-player game started.", lit: "lit", unlit: "unlit", column: "Physical column", help: "Start in any outer-row cell. Win more columns to win. White points count for both players. No Challenges or Streets. First full board: finish the current roll together.", save: "Local saving is unavailable. Changes may not survive a reload.", invalidSave: "Saved 2P data could not be restored. The old save is kept until you play or reset.", resetFailed: "The saved game could not be cleared. Your game was kept.", board: "board", direction: "Numbers increase from screen left to right", number: "Use two digits from 1–6.", cell: "Choose a cell from A1 to E3.", occupied: "This cell is already occupied.", neighbor: "This number needs a valid usable neighboring connection.", first: "Start in any cell of the outer row.", invalidBoard: "The board could not be read." },
  de: { player: "Spieler", empty: "leer", start: "Start", frozen: "Eingefroren · 0 Punkte · nicht nutzbar", thawed: "Aufgetaut · dauerhaft 0 Punkte · nutzbar", input: "Zwei Ziffern von 1–6 wählen", ready: "Tippe auf ein leeres Feld, um eine Zahl einzutragen.", placed: "platziert auf", undone: "Letzter Zug rückgängig gemacht.", reset: "Neues Zweispielerspiel gestartet.", lit: "leuchtet", unlit: "leuchtet nicht", column: "Physische Spalte", help: "Beginnt in einem beliebigen Feld der äusseren Reihe. Wer mehr Spalten gewinnt, gewinnt. Weisse Punkte zählen für beide. Keine Challenges oder Strassen. Erstes volles Brett: Beendet den aktuellen Wurf gemeinsam.", save: "Lokales Speichern ist nicht möglich. Änderungen können beim Neuladen verloren gehen.", invalidSave: "Gespeicherte 2P-Daten konnten nicht geladen werden. Der alte Spielstand bleibt bis zur nächsten Aktion erhalten.", resetFailed: "Der Spielstand konnte nicht gelöscht werden. Deine Partie bleibt erhalten.", board: "Brett", direction: "Zahlen steigen auf dem Bildschirm von links nach rechts", number: "Verwende zwei Ziffern von 1–6.", cell: "Wähle ein Feld von A1 bis E3.", occupied: "Dieses Feld ist bereits belegt.", neighbor: "Diese Zahl braucht eine gültige Verbindung zu einem nutzbaren Nachbarfeld.", first: "Beginne in einem beliebigen Feld der äusseren Reihe.", invalidBoard: "Das Brett konnte nicht gelesen werden." },
};

export function initializeTwoPlayer(document, storage) {
  const byId = (id) => document.getElementById(id);
  const restored = loadTwoPlayerGame(storage);
  let state = restored.state;
  let active = false;
  let entry = null;
  let resetting = false;
  let language = byId("rules-language-de")?.getAttribute("aria-pressed") === "true" ? "de" : "en";
  let storageMessage = restored.status === "invalid" ? "invalidSave" : restored.status === "unavailable" ? "save" : "";
  const feedback = { 1: { kind: "ready" }, 2: { kind: "ready" } };
  const root = byId("two-player-game");
  const undo = byId("undo-move");
  const resetPanel = byId("reset-confirmation");
  const snowman = byId("new-game");
  const frontline = byId("two-player-duels");
  let visualFractions = null, targetFractions = null, frameId = null;
  const available = () => active && !byId("new-game-menu")?.open;
  const cellId = (player, coordinate) => "two-player-" + player + "-" + coordinate;
  function append(tag, className, parent) {
    const node = document.createElement(tag); node.className = className; parent.append(node); return node;
  }
  function svg(tag, attrs, parent) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    parent.append(node); return node;
  }
  const guides = ["player1", "player2"].map((player) => ({
    shaft: svg("line", { class: `two-player-frontline__guide two-player-frontline__guide--${player}`, "aria-hidden": "true" }, frontline),
    head: svg("polygon", { class: `two-player-frontline__guide-head two-player-frontline__guide-head--${player}`, "aria-hidden": "true" }, frontline),
  }));
  const outline = svg("path", { class: "two-player-frontline__outline" }, frontline);
  const curve = svg("path", { class: "two-player-frontline__curve" }, frontline);
  const points = Array.from({ length: 5 }, (_, physical) => {
    const circle = svg("circle", { r: 7.5, class: "two-player-frontline__point" }, frontline);
    circle.dataset.physical = String(physical);
    return circle;
  });
  const upperScores = Array.from({ length: 5 }, () => svg("text", { y: 14, class: "two-player-frontline__score" }, frontline));
  const lowerScores = Array.from({ length: 5 }, () => svg("text", { y: 98, class: "two-player-frontline__score" }, frontline));
  function frontlineWidth() { return byId("two-player-board-2").clientWidth || byId("two-player-board-1").clientWidth || 286; }
  function paintFrontline(duels, fractions) {
    const geometry = createFrontlineGeometry(duels, frontlineWidth(), fractions);
    frontline.setAttribute("viewBox", `0 0 ${geometry.width} ${geometry.height}`);
    directionArrowGeometry(geometry.width).forEach((arrow, i) => {
      const { shaft, head } = guides[i];
      shaft.setAttribute("x1", arrow.startX); shaft.setAttribute("x2", arrow.baseX + 1);
      shaft.setAttribute("y1", arrow.y); shaft.setAttribute("y2", arrow.y);
      head.setAttribute("points", arrow.head);
    });
    outline.setAttribute("d", geometry.center);
    curve.setAttribute("d", geometry.center);
    geometry.points.forEach((point, i) => {
      points[i].setAttribute("cx", point.x); points[i].setAttribute("cy", point.y);
      points[i].dataset.control = point.control;
      upperScores[i].setAttribute("x", point.x);
      upperScores[i].setAttribute("transform", `rotate(180 ${point.x} 14)`);
      lowerScores[i].setAttribute("x", point.x);
    });
    visualFractions = [...fractions];
  }
  function updateFrontline(duels = getTwoPlayerDuels(state)) {
    const next = duels.map((duel) => frontlineFraction(duel.player1.score, duel.player2.score));
    const window = document.defaultView;
    if (frameId !== null) { window?.cancelAnimationFrame?.(frameId); frameId = null; }
    const animate = active && visualFractions && targetFractions?.some((value, i) => value !== next[i])
      && window?.requestAnimationFrame && !window?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    targetFractions = next;
    if (!animate) { paintFrontline(duels, next); return; }
    const from = [...visualFractions];
    let start = null;
    const step = (time) => {
      if (start === null) start = time;
      const progress = Math.min(1, (time - start) / 280);
      const eased = progress * progress * (3 - 2 * progress);
      paintFrontline(duels, next.map((value, i) => from[i] + (value - from[i]) * eased));
      if (progress < 1) frameId = window.requestAnimationFrame(step);
      else frameId = null;
    };
    frameId = window.requestAnimationFrame(step);
  }
  function describe(player, coordinate, record) {
    const t = copy[language];
    return `${t.player} ${player}, ${coordinate}, ${record?.value ?? t.empty}`
      + (record?.status === "frozen" ? ", " + t.frozen : record?.status === "thawed" ? ", " + t.thawed : "");
  }
  function updateText() {
    const t = copy[language];
    root.lang = language;
    root.setAttribute("aria-label", language === "de" ? "Zwei Spieler auf einem Gerät" : "Two players on one device");
    byId("two-player-duels").setAttribute("aria-label", language === "de" ? "Spaltenpunkte" : "Column scores");
    byId("two-player-help").textContent = t.help;
    byId("two-player-storage-status").textContent = storageMessage ? t[storageMessage] : "";
    byId("two-player-storage-status").hidden = storageMessage === "";
    for (const player of [1, 2]) {
      byId("two-player-label-" + player).textContent = t.player + " " + player;
      byId("two-player-board-" + player).setAttribute("aria-label", t.player + " " + player + " · " + t.board + ". " + t.direction);
      const message = feedback[player];
      byId("two-player-feedback-" + player).textContent = message.kind === "placed"
        ? `${message.value} ${t.placed} ${message.coordinate}.` : t[message.kind];
      for (let row = 1; row <= 3; row += 1) for (const col of TWO_PLAYER_COLUMNS) {
        const coordinate = col + row;
        const node = byId(cellId(player, coordinate));
        if (node) node.setAttribute("aria-label", entry?.player === player && entry.coordinate === coordinate ? `${t.player} ${player}, ${coordinate}: ${t.input}` : describe(player, coordinate, state["player" + player].board[row - 1][TWO_PLAYER_COLUMNS.indexOf(col)]));
      }
    }
    const duels = getTwoPlayerDuels(state);
    frontline.setAttribute("aria-label", duels.map((duel) =>
      `${t.column} ${duel.physical + 1}: ${t.player} 1 ${duel.player1.score}, ${t.player} 2 ${duel.player2.score}`
      + `; ${t[duel.player1.lit ? "lit" : "unlit"]} / ${t[duel.player2.lit ? "lit" : "unlit"]}`).join(". "));
    duels.forEach((duel, i) => {
      upperScores[i].textContent = duel.player1.score;
      lowerScores[i].textContent = duel.player2.score;
    });
    updateFrontline(duels);
  }
  // One shared keypad, outside the rotated grids. Only UI drafts live here.
  const keypad = append("div", "two-player-entry", root);
  keypad.id = "two-player-entry"; keypad.hidden = true;
  keypad.setAttribute("role", "group");
  const draft = append("p", "two-player-entry__draft", keypad);
  draft.id = "two-player-entry-draft";
  draft.setAttribute("role", "status"); draft.setAttribute("aria-atomic", "true");
  const keys = append("div", "two-player-entry__keys", keypad);
  for (let digit = 1; digit <= 6; digit += 1) {
    const button = append("button", "two-player-entry__digit", keys);
    button.type = "button"; button.dataset.digit = String(digit); button.textContent = digit;
  }
  function updateEntry() {
    keypad.hidden = entry === null || !active;
    if (entry) {
      const { player, coordinate, digits } = entry;
      const area = byId("two-player-board-" + player).parentNode;
      if (keypad.parentNode !== area) area.append(keypad);
      keypad.dataset.player = String(player);
      // Stay within the owner's board, clear of the header and score strip.
      // Move away from a selected outer/start row; middle-row overlap is minimal.
      keypad.dataset.edge = (player === 1) === (coordinate[1] !== "3") ? "top" : "bottom";
      keypad.setAttribute("aria-label", `${copy[language].player} ${player}, ${coordinate}: ${copy[language].input}`);
      keypad.setAttribute("aria-describedby", "two-player-feedback-" + player);
      draft.textContent = digits ? digits + " –" : "– –";
    } else draft.textContent = "– –";
    for (const player of [1, 2]) {
      for (const cell of byId("two-player-board-" + player).querySelectorAll("button[data-coordinate]")) {
        if (cell.disabled) continue;
        const selected = entry?.player === player && entry.coordinate === cell.dataset.coordinate;
        cell.setAttribute("aria-pressed", String(selected));
        cell.setAttribute("aria-expanded", String(selected));
      }
    }
  }
  function closeEntry(returnFocus = false) {
    const previous = entry; entry = null;
    updateEntry(); updateText();
    if (returnFocus && previous) byId(cellId(previous.player, previous.coordinate)).focus({ preventScroll: true });
  }
  keypad.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-digit]");
    if (!available() || !entry || keypad.hidden || !button || !keypad.contains(button) || !/^[1-6]$/.test(button.dataset.digit)) return;
    entry.digits += button.dataset.digit;
    if (entry.digits.length === 1) { updateEntry(); return; }
    const { player, coordinate, digits } = entry;
    let result;
    try { result = placeTwoPlayerNumber(state, player, coordinate, Number(digits)); }
    catch (error) {
      feedback[player] = { kind: error.message === "start" ? "first" : error.message === "board" ? "invalidBoard" : error.message };
      entry.digits = ""; updateEntry(); updateText(); return;
    }
    state = result;
    storageMessage = saveTwoPlayerGame(state, storage) ? "" : "save";
    feedback[player] = { kind: "placed", coordinate, value: Number(digits) };
    entry = null; render(); byId("two-player-board-" + player).focus({ preventScroll: true });
  });
  function createCell(player, coordinate) {
    const row = Number(coordinate[1]);
    const column = TWO_PLAYER_COLUMNS.indexOf(coordinate[0]);
    const record = state["player" + player].board[row - 1][column];
    const cell = document.createElement("button");
    cell.type = "button"; cell.id = cellId(player, coordinate);
    cell.className = "board-cell two-player-cell";
    cell.dataset.player = String(player); cell.dataset.coordinate = coordinate;
    cell.dataset.state = record?.status ?? "empty";
    cell.dataset.start = String(row === TWO_PLAYER_START_ROW);
    cell.disabled = record !== null;
    if (record === null) cell.setAttribute("aria-controls", "two-player-entry");
    if (record?.status === "frozen") {
      cell.classList.add("board-cell--frozen");
      const layer = append("span", "board-cell__ice-layer", cell);
      const image = append("img", "board-cell__ice", layer);
      image.src = "./assets/icecube.png"; image.alt = ""; image.width = 48; image.height = 48;
      image.setAttribute("aria-hidden", "true");
    }
    if (record?.status === "thawed") {
      const mark = append("span", "board-cell__marker", cell); mark.textContent = "0"; mark.setAttribute("aria-hidden", "true");
    }
    if (record !== null) {
      cell.classList.add("board-cell--occupied");
      const value = append("span", "board-cell__value", cell); value.textContent = record.value;
      if (getCellScoreMultiplier(record) === 2) {
        const multiplier = append("span", "street-marker", cell); multiplier.textContent = "2×"; multiplier.setAttribute("aria-hidden", "true");
      }
    }
    return cell;
  }
  function render() {
    for (const player of [1, 2]) {
      const grid = byId("two-player-board-" + player);
      const slots = [];
      for (let row = 1; row <= 3; row += 1) for (const col of TWO_PLAYER_COLUMNS) {
        const coordinate = col + row;
        const slot = document.createElement("div");
        slot.className = "two-player-cell-slot";
        slot.append(createCell(player, coordinate));
        if (row === TWO_PLAYER_START_ROW && col !== TWO_PLAYER_COLUMNS.at(-1)) {
          const sign = append("span", "two-player-comparison-sign", slot);
          sign.textContent = getTwoPlayerHorizontalDirection(player) === 1 ? "<" : ">";
          sign.setAttribute("aria-hidden", "true");
        }
        slots.push(slot);
      }
      grid.replaceChildren(...slots);
    }
    updateText(); updateEntry();
    if (active) {
      undo.disabled = state.undo === null;
      resetPanel.hidden = !resetting;
      snowman.hidden = resetting;
    }
  }
  for (const player of [1, 2]) byId("two-player-board-" + player).addEventListener("click", (event) => {
    if (!available()) return;
    const cell = event.target.closest("button[data-coordinate]");
    if (!cell || cell.disabled) return;
    if (entry?.player === player && entry.coordinate === cell.dataset.coordinate) return;
    resetting = false; entry = { player, coordinate: cell.dataset.coordinate, digits: "" };
    resetPanel.hidden = true; snowman.hidden = false;
    updateEntry(); updateText(); keys.children[0].focus({ preventScroll: true });
  });
  document.addEventListener("keydown", (event) => {
    if (!available() || event.key !== "Escape" || entry === null) return;
    event.preventDefault(); closeEntry(true);
  });
  for (const type of ["pointerdown", "click", "focusin"]) document.addEventListener(type, (event) => {
    if (!entry || keypad.contains(event.target)) return;
    const cell = event.target.closest?.("button[data-coordinate]");
    if (cell && !cell.disabled && byId("two-player-board-" + cell.dataset.player)?.contains(cell)) return;
    closeEntry();
  });
  undo.addEventListener("click", () => {
    if (!available() || state.undo === null) return;
    state = undoTwoPlayerMove(state); entry = null; resetting = false;
    feedback[1] = feedback[2] = { kind: "undone" };
    storageMessage = saveTwoPlayerGame(state, storage) ? "" : "save"; render();
  });
  snowman.addEventListener("click", () => {
    if (byId("new-game-menu")) return;
    if (!available()) return;
    entry = null; resetting = true; render(); byId("cancel-new-game").focus();
  });
  byId("cancel-new-game").addEventListener("click", () => {
    if (!available()) return;
    resetting = false; render(); snowman.focus({ preventScroll: true });
  });
  function resetGame() {
    if (!clearTwoPlayerGame(storage)) { storageMessage = "resetFailed"; updateText(); return false; }
    state = createTwoPlayerState(); entry = null; resetting = false; storageMessage = "";
    feedback[1] = feedback[2] = { kind: "reset" }; render();
    return true;
  }
  byId("confirm-new-game").addEventListener("click", () => {
    if (!available() || !resetting) return;
    if (resetGame()) byId("two-player-board-2").focus({ preventScroll: true });
  });
  document.addEventListener("ruleslanguagechange", (event) => { language = event.detail; updateText(); updateEntry(); });
  const Resize = document.defaultView?.ResizeObserver;
  if (Resize) new Resize(() => { if (active) updateFrontline(); }).observe(byId("two-player-board-2"));
  document.defaultView?.addEventListener?.("resize", () => { if (active) updateFrontline(); });
  render();
  return {
    getState: () => cloneTwoPlayerState(state),
    hasProgress: () => state.player1.board.some((row) => row.some((cell) => cell !== null)) || state.player2.board.some((row) => row.some((cell) => cell !== null)) || state.undo !== null,
    dismissDraft: () => { if (entry) closeEntry(); },
    resetGame,
    setActive(value) { active = value; entry = null; resetting = false; byId("two-player-help").hidden = !active; render(); },
  };
}
