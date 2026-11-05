import { EXAMPLE_CHALLENGE, EXAMPLE_PLACEMENTS, getTutorialCamera, getTutorialScene, TUTORIAL_STEPS } from "./tutorial-scenes.js?v=tutorial-2";
import { getCellScoreMultiplier } from "./scoring.js?v=v3-multipliers-1";
import { formatFrostyDollars } from "./receipt.js?v=receipt-5";

const copy = {
  en: { how: "HOW TO PLAY", name: "Interactive How to Play", back: "BACK", next: "NEXT", play: "LET’S PLAY!", navigation: "Tutorial navigation", step: "Step", of: "of", player: "Player", start: "Start", empty: "empty", ice: "Attack Ice; cannot support placement", roll: "Four dice rolling", dice: "Four dice", unused: "The other two dice are available to the other players.", neighbors: "↑ ↓ ← → · × Diagonal\nNumber rules still apply to neighboring cells.", right: "✓ 12 < 24 < 46 · × 35 < 46\nThis example uses a connection from the left.", vertical: "46 above = 46 below", left: "✓ 35 < 46 · 35 ≠ 24\nOne valid connection is enough.", challenge: "Player A → Player B\nThe normal dice turn still follows.", secret: "Secret bid", confirmed: "Confirmed", tie: "Equal Bids? Bid again until a winner is determined.", waiting: "Both bids stay concealed until the reveal.", choose: "Choose exactly ONE action", freeze: "FREEZE", unfreeze: "UNFREEZE", freezeExample: "Freeze Player A’s B2", unfreezeExample: "Unfreeze Player B’s B2", then: "Then it’s time to roll!", board: "BOARD", receipt: "RECEIPT", view: "Example view", boardValue: "BOARD VALUE", spending: "CHALLENGE", balance: "BALANCE (SALDO)", later: "Later in the same game…", goal: "A1 → D7", target: "D7 reached", alternative: "12 ↔ 21" },
  de: { how: "SPIELANLEITUNG", name: "Interaktive Spielanleitung", back: "ZURÜCK", next: "WEITER", play: "JETZT SPIELEN!", navigation: "Navigation der Spielanleitung", step: "Schritt", of: "von", player: "Spieler", start: "Start", empty: "leer", ice: "Attack Ice; keine nutzbare Verbindung", roll: "Vier Würfel werden geworfen", dice: "Vier Würfel", unused: "Die übrigen zwei Würfel stehen allen Mitspielern zur Verfügung.", neighbors: "↑ ↓ ← → · × Diagonal\nAuch bei Nachbarfeldern gelten die Zahlenregeln.", right: "✓ 12 < 24 < 46 · × 35 < 46\nHier verbindet die linke Nachbarzahl.", vertical: "46 oben = 46 unten", left: "✓ 35 < 46 · 35 ≠ 24\nEine gültige Verbindung genügt.", challenge: "Spieler A → Spieler B\nDer normale Würfelzug folgt danach.", secret: "Verdecktes Gebot", confirmed: "Bestätigt", tie: "Gleiche Gebote? Bietet erneut, bis ein Gewinner feststeht.", waiting: "Beide Gebote bleiben bis zum Aufdecken verdeckt.", choose: "Genau EINE Aktion wählen", freeze: "EINFRIEREN", unfreeze: "AUFTAUEN", freezeExample: "B2 von Spieler A einfrieren", unfreezeExample: "B2 von Spieler B auftauen", then: "Danach wird gewürfelt!", board: "BRETT", receipt: "BELEG", view: "Beispielansicht", boardValue: "BRETTWERT", spending: "CHALLENGE", balance: "SALDO", later: "Später im selben Spiel…", goal: "A1 → D7", target: "D7 erreicht", alternative: "12 ↔ 21" },
};
const finalDice = [1, 2, 4, 6];

export function initializeTutorial(document, options = {}) {
  const view = document.defaultView;
  const byId = (id) => document.getElementById(id);
  const root = byId("interactive-tutorial");
  const panel = byId("tutorial-panel");
  const toggle = byId("tutorial-toggle");
  const stage = byId("tutorial-stage");
  const diceArea = byId("tutorial-dice");
  const motion = options.motion ?? view.matchMedia?.("(prefers-reduced-motion: reduce)") ?? { matches: false };
  const setTimer = options.setTimeout ?? view.setTimeout.bind(view);
  const clearTimer = options.clearTimeout ?? view.clearTimeout.bind(view);
  const timers = new Set();
  const unlisten = [];
  let generation = 0;
  let disposed = false;
  let expanded = false;
  let started = false;
  let step = 1;
  let action = "freeze";
  let receiptView = false;
  let language = byId("rules-language-de")?.getAttribute("aria-pressed") === "true" ? "de" : "en";
  let cameraBounds = { width: 284, height: 416 };
  let phase = settledPhase();

  function make(tag, className, parent) {
    const element = document.createElement(tag);
    element.className = className;
    parent?.append(element);
    return element;
  }
  function art(path, className, parent) {
    const image = make("img", className, parent);
    image.src = "./assets/" + path;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    return image;
  }
  function listen(target, event, handler) {
    target?.addEventListener?.(event, handler);
    unlisten.push(() => target?.removeEventListener?.(event, handler));
  }
  function cancel() { generation += 1; timers.forEach(clearTimer); timers.clear(); }
  function schedule(delay, callback, repaint = true) {
    const token = generation;
    const id = setTimer(() => {
      timers.delete(id);
      if (disposed || !expanded || token !== generation) return;
      callback();
      if (repaint) render();
    }, delay);
    timers.add(id);
  }
  function settledPhase() {
    return { placements: 3, added: true, ghost: false, focus: "", rolling: false, faces: [...finalDice], number: 12, entering: -1, confirmed: 2, revealStarted: true, revealed: true, effect: true, goal: true, instant: false };
  }

  function createBoard(player) {
    const figure = byId("tutorial-player-" + player.toLowerCase());
    const label = make("figcaption", "tutorial-player__label", figure);
    const viewport = make("div", "tutorial-viewport", figure);
    viewport.setAttribute("role", "img");
    const board = make("div", "tutorial-board", viewport);
    board.setAttribute("aria-hidden", "true");
    const cells = [];
    for (let row = 1; row <= 7; row += 1) for (const column of "ABCD") {
      const coordinate = column + row;
      const cell = make("div", "tutorial-cell", board);
      cell.dataset.coordinate = coordinate;
      cell.id = "tutorial-" + player + "-" + coordinate;
      const coordinateLabel = make("span", "tutorial-cell__coordinate", cell);
      coordinateLabel.textContent = coordinate;
      const ice = coordinate === "B2" ? art("icecube2.png", "tutorial-ice", cell) : null;
      const flag = coordinate === "D7" ? art("d7_flag.png", "tutorial-flag", cell) : null;
      const hint = make("span", "tutorial-cell__hint", cell);
      const value = make("span", "tutorial-cell__value", cell);
      const multiplier = make("span", "tutorial-cell__multiplier", cell);
      cells.push({ coordinate, cell, value, hint, flag, ice, multiplier });
    }
    const connections = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    connections.setAttribute("class", "tutorial-connections");
    connections.setAttribute("viewBox", "0 0 400 700");
    board.append(connections);
    const aside = make("div", "tutorial-player__aside", figure);
    const intro = make("p", "tutorial-challenge-intro", aside);
    const note = make("div", "tutorial-note", aside);
    note.setAttribute("role", "img");
    const rotor = make("div", "tutorial-note__rotor", note);
    const front = make("div", "tutorial-note__face", rotor);
    art("bid.png", "", front);
    const amount = make("span", "tutorial-note__amount", front);
    const cover = make("div", "tutorial-note__face tutorial-note__cover", rotor);
    art("bid_front.png", "", cover);
    const status = make("p", "tutorial-note__status", aside);
    return { figure, label, viewport, board, cells, connections, intro, note, front, cover, amount, status };
  }
  const boards = { A: createBoard("A"), B: createBoard("B") };
  const diceFaces = make("div", "tutorial-dice__faces", diceArea);
  const dice = finalDice.map((value) => {
    const die = make("span", "tutorial-die", diceFaces);
    return { die, image: art("digital_dice/dice_" + value + ".png", "", die) };
  });
  const number = make("p", "tutorial-number", diceArea);
  const dots = TUTORIAL_STEPS.map(() => {
    const dot = make("span", "", byId("tutorial-progress"));
    dot.setAttribute("aria-hidden", "true");
    return dot;
  });

  function drawConnection(svg, x1, y1, x2, y2, symbol, className = "") {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    for (const [name, value] of Object.entries({ x1, y1, x2, y2, class: className })) line.setAttribute(name, value);
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", (x1 + x2) / 2 + (x1 === x2 ? 16 : 0));
    text.setAttribute("y", (y1 + y2) / 2 + 8);
    text.textContent = symbol;
    svg.append(line, text);
  }
  function paintBoard(player, board) {
    const target = boards[player];
    const occupied = [];
    for (const entry of target.cells) {
      const { coordinate, cell, value, hint, flag, multiplier } = entry;
      let record = board[Number(coordinate[1]) - 1]["ABCD".indexOf(coordinate[0])];
      if (player === "A") {
        if (step === 4 && EXAMPLE_PLACEMENTS.slice(phase.placements, 3).some(([cell]) => cell === coordinate)) record = null;
        if ((step === 7 && coordinate === "C2" || step === 8 && coordinate === "B2") && !phase.added) record = null;
        if (step === 12 && coordinate === "D7" && !phase.goal) record = null;
      }
      const ghost = player === "A" && phase.ghost && ((step === 5 && coordinate === "A2") || (step === 6 && coordinate === "D1"));
      cell.dataset.occupied = String(record !== null);
      cell.dataset.attackIce = String(record?.attackIce === true);
      cell.dataset.attempt = String(ghost);
      cell.dataset.emphasis = String(player === "A" && phase.focus === coordinate);
      cell.dataset.connection = player === "A" && (step === 8 && ["B2", "C2"].includes(coordinate) || step === 6 && ["A1", "B1", "C1"].includes(coordinate)) ? "valid"
        : player === "A" && step === 5 && ["A1", "B1", "C1", "B2"].includes(coordinate) ? "neighbor" : "";
      cell.dataset.arriving = String(!motion.matches && player === "A" && ((step === 4 && phase.placements > 0 && EXAMPLE_PLACEMENTS[phase.placements - 1][0] === coordinate) || (step === 7 && coordinate === "C2" || step === 8 && coordinate === "B2") && phase.added));
      value.textContent = record?.value ?? (ghost ? step === 5 ? 24 : 35 : "");
      hint.textContent = coordinate === "A1" && record === null && !ghost ? copy[language].start : "";
      if (flag) flag.hidden = record !== null;
      const factor = getCellScoreMultiplier(record);
      multiplier.textContent = factor > 1 ? factor + "x" : "";
      if (record) occupied.push(coordinate + " " + record.value + (record.attackIce ? ", " + copy[language].ice : ""));
    }
    target.viewport.setAttribute("aria-label", copy[language].player + " " + player + ": " + (occupied.join("; ") || copy[language].empty));
    target.connections.replaceChildren();
    if (player !== "A") return;
    if (step === 5 && phase.ghost) drawConnection(target.connections, 125, 78, 75, 122, "×", "tutorial-invalid-line");
    if (step === 6) {
      drawConnection(target.connections, 50, 80, 150, 80, "<", "tutorial-valid-line");
      drawConnection(target.connections, 150, 80, 250, 80, "<", "tutorial-valid-line");
    }
    if (step === 7) drawConnection(target.connections, 250, 78, 250, 122, "=");
    if (step === 8) {
      drawConnection(target.connections, 150, 180, 250, 180, "<", "tutorial-valid-line");
      drawConnection(target.connections, 150, 78, 150, 122, "≠", "tutorial-neutral-line");
    }
  }
  function renderCamera() {
    const bounds = stage.getBoundingClientRect();
    if (bounds.width > 0 && bounds.height > 0) cameraBounds = bounds;
    for (const player of ["A", "B"]) {
      const camera = getTutorialCamera(step, cameraBounds.width, cameraBounds.height, player);
      const target = boards[player];
      target.viewport.style.width = camera.width + "px";
      target.viewport.style.height = camera.height + "px";
      target.board.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
    }
  }
  function paintDice() {
    const text = copy[language];
    diceArea.setAttribute("aria-label", phase.rolling ? text.roll : text.dice + ": " + finalDice.join(", "));
    dice.forEach(({ die, image }, index) => {
      image.src = "./assets/digital_dice/dice_" + phase.faces[index] + ".png";
      die.dataset.selected = String(step === 3 && index < 2);
      die.dataset.secondary = String(step === 3 && index >= 2);
    });
    number.textContent = step === 3 ? (phase.number === 12 ? "[1] [2] → 12" : "[2] [1] → 21") : "";
    if (step === 3) { const alternative = make("small", "", number); alternative.textContent = text.alternative; }
  }
  function legend(scene) {
    const t = copy[language];
    if (step === 1) return t.goal;
    if (step === 3) return t.unused;
    if (step === 4) return EXAMPLE_PLACEMENTS.slice(0, phase.placements).map(([cell, value]) => cell + " = " + value).join(" · ");
    if (step === 5) return t.neighbors;
    if (step === 6) return t.right;
    if (step === 7) return t.vertical;
    if (step === 8) return t.left;
    if (step === 9) return t.challenge;
    if (step === 10) return t.tie;
    if (step === 11) return phase.revealed ? t.player + " B: $50 > $30\n" + t.choose + " · " + (action === "freeze" ? t.freezeExample : t.unfreezeExample) + "\n" + t.then : t.waiting;
    if (step === 12) return phase.goal ? t.target + "\n" + formatFrostyDollars(scene.scoring.baseSum + scene.scoring.streetBonus) + " − $30 = " + formatFrostyDollars(scene.scoring.score) : t.later;
    return "";
  }
  function render() {
    const scene = getTutorialScene(step, action);
    const text = copy[language];
    const paired = step >= 9 && step <= 11;
    root.lang = language;
    root.setAttribute("aria-label", text.name);
    byId("tutorial-toggle-label").textContent = text.how;
    byId("tutorial-title").textContent = scene.title[language];
    byId("tutorial-explanation").textContent = scene.text[language];
    stage.dataset.step = String(step);
    stage.dataset.paired = String(paired);
    stage.dataset.instant = String(phase.instant || motion.matches);
    boards.A.figure.hidden = step === 2 || step === 3 || step === 12 && receiptView;
    boards.B.figure.hidden = !paired;
    diceArea.hidden = step !== 2 && step !== 3;
    byId("tutorial-receipt").hidden = step !== 12 || !receiptView;
    const baseline = step === 11 && !phase.effect ? getTutorialScene(10) : scene;
    paintBoard("A", baseline.boardA);
    paintBoard("B", baseline.boardB ?? getTutorialScene(9).boardB);
    for (const [index, player] of ["A", "B"].entries()) {
      const target = boards[player];
      target.label.textContent = paired ? text.player + " " + player : "";
      target.note.hidden = step === 9;
      target.intro.hidden = step !== 9;
      target.intro.textContent = player === "A" ? "A → B" : "Challenge";
      const entering = step === 10 && phase.entering === index;
      const reveal = entering || step === 11 && phase.revealStarted;
      const readable = entering || step === 11 && phase.revealed;
      target.note.dataset.reveal = String(reveal);
      target.amount.textContent = reveal ? formatFrostyDollars(EXAMPLE_CHALLENGE.bids[player]) : "";
      target.front.setAttribute("aria-hidden", String(!readable));
      target.cover.setAttribute("aria-hidden", String(readable));
      target.note.setAttribute("aria-label", readable ? text.player + " " + player + ": " + formatFrostyDollars(EXAMPLE_CHALLENGE.bids[player]) : text.secret);
      target.status.textContent = step === 10 ? phase.confirmed > index ? text.confirmed : text.secret : "";
    }
    paintDice();
    byId("tutorial-legend").textContent = legend(scene);
    byId("tutorial-ice-options").hidden = step !== 11;
    byId("tutorial-ice-options").setAttribute("aria-label", text.choose);
    for (const choice of ["freeze", "unfreeze"]) {
      const button = byId("tutorial-" + choice);
      button.textContent = text[choice];
      button.disabled = !phase.revealed;
      button.setAttribute("aria-pressed", String(action === choice));
    }
    byId("tutorial-final-views").hidden = step !== 12;
    byId("tutorial-final-views").setAttribute("aria-label", text.view);
    byId("tutorial-show-board").textContent = text.board;
    byId("tutorial-show-receipt").textContent = text.receipt;
    byId("tutorial-show-receipt").disabled = !phase.goal;
    byId("tutorial-show-board").setAttribute("aria-pressed", String(!receiptView));
    byId("tutorial-show-receipt").setAttribute("aria-pressed", String(receiptView));
    byId("tutorial-board-value-label").textContent = text.boardValue;
    byId("tutorial-spending-label").textContent = text.spending;
    byId("tutorial-balance-label").textContent = text.balance;
    byId("tutorial-board-value").textContent = formatFrostyDollars(scene.scoring.baseSum + scene.scoring.streetBonus);
    byId("tutorial-spending").textContent = "-" + formatFrostyDollars(scene.pointsSpent);
    byId("tutorial-balance").textContent = formatFrostyDollars(scene.scoring.score);
    byId("tutorial-back").textContent = text.back;
    byId("tutorial-back").disabled = step === 1;
    byId("tutorial-next").textContent = step === 12 ? text.play : text.next;
    byId("tutorial-navigation").setAttribute("aria-label", text.navigation);
    byId("tutorial-progress").setAttribute("aria-label", `${text.step} ${step} ${text.of} 12`);
    dots.forEach((dot, index) => { dot.dataset.current = String(index + 1 === step); });
    renderCamera();
  }

  function enter(target, animate) {
    if (disposed || !expanded || !Number.isInteger(target) || target < 1 || target > 12) return false;
    cancel();
    step = target;
    started = true;
    receiptView = false;
    phase = settledPhase();
    if (animate && !motion.matches) {
      if (step === 1) { phase.focus = "A1"; schedule(600, () => { phase.focus = "D7"; }); schedule(1100, () => { phase.focus = ""; }); }
      if (step === 2) {
        phase.rolling = true;
        let frame = 0;
        const cycle = () => {
          if (!phase.rolling) return;
          phase.faces = finalDice.map((_, index) => (frame + index) % 6 + 1);
          frame += 1;
          paintDice();
          schedule(80, cycle, false);
        };
        cycle();
        schedule(1000, () => { cancel(); phase.rolling = false; phase.faces = [...finalDice]; });
      }
      if (step === 3) { schedule(650, () => { phase.number = 21; }); schedule(1300, () => { phase.number = 12; }); }
      if (step === 4) { phase.placements = 0; [300, 850, 1400].forEach((delay, index) => schedule(delay, () => { phase.placements = index + 1; })); }
      if (step === 5 || step === 6) { schedule(350, () => { phase.ghost = true; }); schedule(1000, () => { phase.ghost = false; }); }
      if (step === 7 || step === 8) {
        phase.added = false;
        phase.focus = step === 7 ? "C1" : "B2";
        schedule(step === 7 ? 800 : 450, () => { phase.added = true; phase.focus = step === 7 ? "C2" : "B2"; });
        schedule(1200, () => { phase.focus = ""; });
      }
      if (step === 10) {
        phase.entering = 0; phase.confirmed = 0;
        schedule(450, () => { phase.entering = 1; });
        schedule(900, () => { phase.entering = -1; });
        schedule(1150, () => { phase.confirmed = 1; });
        schedule(1450, () => { phase.confirmed = 2; });
      }
      if (step === 11) {
        phase.revealStarted = false; phase.revealed = false; phase.effect = false;
        schedule(300, () => { phase.revealStarted = true; });
        schedule(1000, () => { phase.revealed = true; });
        schedule(1300, () => { phase.effect = true; });
      }
      if (step === 12) {
        phase.goal = false;
        schedule(600, () => { phase.goal = true; phase.focus = "D7"; });
        schedule(2000, () => { receiptView = true; });
      }
    }
    render();
    if (byId("tutorial-back").disabled && document.activeElement === byId("tutorial-back")) byId("tutorial-next").focus({ preventScroll: true });
    return true;
  }
  function goToStep(target) { return enter(target, target > step); }
  listen(toggle, "click", () => {
    if (disposed) return;
    expanded = !expanded;
    panel.hidden = !expanded;
    toggle.setAttribute("aria-expanded", String(expanded));
    if (expanded) { if (!started) enter(1, true); else render(); }
    else { cancel(); phase = settledPhase(); render(); if (panel.contains(document.activeElement)) toggle.focus({ preventScroll: true }); }
  });
  listen(byId("tutorial-back"), "click", () => { if (step > 1) goToStep(step - 1); });
  listen(byId("tutorial-next"), "click", () => {
    if (!expanded || disposed) return;
    if (step < 12) goToStep(step + 1);
    else {
      cancel(); phase = settledPhase(); render();
      const board = byId("game-board");
      board.scrollIntoView({ behavior: motion.matches ? "auto" : "smooth", block: "start" });
      board.focus({ preventScroll: true });
    }
  });
  for (const choice of ["freeze", "unfreeze"]) listen(byId("tutorial-" + choice), "click", () => {
    if (!expanded || disposed || step !== 11 || !phase.revealed) return;
    cancel(); action = choice;
    if (motion.matches) { phase.effect = true; render(); return; }
    phase.effect = false; phase.instant = true; render();
    schedule(40, () => { phase.instant = false; });
    schedule(80, () => { phase.effect = true; });
  });
  for (const [id, receipt] of [["tutorial-show-board", false], ["tutorial-show-receipt", true]]) listen(byId(id), "click", () => {
    if (expanded && !disposed && step === 12 && phase.goal) { cancel(); receiptView = receipt; render(); }
  });
  listen(document, "ruleslanguagechange", (event) => { language = event.detail; render(); });
  listen(view, "resize", renderCamera);
  listen(view, "pagehide", () => { cancel(); phase = settledPhase(); render(); });
  listen(motion, "change", () => { if (motion.matches) { cancel(); phase = settledPhase(); render(); } });
  panel.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
  render();
  return {
    goToStep,
    getState() { return { step, expanded, action, receiptView, language, phase: { ...phase, faces: [...phase.faces] }, scene: getTutorialScene(step, action) }; },
    destroy() { if (disposed) return; cancel(); disposed = true; panel.hidden = true; toggle.setAttribute("aria-expanded", "false"); unlisten.forEach((remove) => remove()); },
  };
}

if (typeof document !== "undefined") {
  const start = () => { if (document.getElementById("interactive-tutorial")) initializeTutorial(document); };
  if (document.readyState === "complete") start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
}
