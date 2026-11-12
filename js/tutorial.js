import { EXAMPLE_CHALLENGE, EXAMPLE_PLACEMENTS, getTutorialCamera, getTutorialScene, TUTORIAL_STEPS } from "./tutorial-scenes.js?v=two-player-1";
import { getTwoPlayerTutorialScene, getTwoPlayerTutorialStageCount, TWO_PLAYER_TUTORIAL_STEPS } from "./two-player-tutorial-scenes.js?v=two-player-tutorial-1";
import { createFrontlineGeometry, directionArrowGeometry, frontlineFraction } from "./two-player-frontline.js?v=frontline-guides-2";
import { getCellScoreMultiplier } from "./scoring.js?v=v3-multipliers-1";
import { formatFrostyDollars } from "./receipt.js?v=receipt-5";

const copy = {
  en: { how: "HOW TO PLAY", name: "Interactive How to Play", back: "BACK", next: "NEXT", play: "LET’S PLAY!", navigation: "Tutorial navigation", step: "Step", of: "of", player: "Player", start: "Start", empty: "empty", ice: "Attack Ice; cannot support placement", roll: "Four dice rolling", dice: "Four dice", unused: "The other two dice are available to the other players.", neighbors: "↑ ↓ ← → · × Diagonal\nNumber rules still apply to neighboring cells.", right: "✓ 12 < 24 < 46 · × 35 < 46\nThis example uses a connection from the left.", vertical: "46 above = 46 below", left: "✓ 35 < 46 · 35 ≠ 24\nOne valid connection is enough.", challenge: "Player A → Player B\nThe normal dice turn still follows.", secret: "Secret bid", confirmed: "Confirmed", tie: "Equal Bids? Bid again until a winner is determined.", waiting: "Both bids stay concealed until the reveal.", choose: "Choose exactly ONE action", freeze: "FREEZE", unfreeze: "UNFREEZE", freezeExample: "Freeze Player A’s B2", unfreezeExample: "Unfreeze Player B’s B2", then: "Then it’s time to roll!", board: "BOARD", receipt: "RECEIPT", view: "Example view", boardValue: "BOARD VALUE", spending: "CHALLENGE", balance: "BALANCE (SALDO)", later: "Later in the same game…", goal: "A1 → D7", target: "D7 reached", alternative: "12 ↔ 21" },
  de: { how: "SPIELANLEITUNG", name: "Interaktive Spielanleitung", back: "ZURÜCK", next: "WEITER", play: "JETZT SPIELEN!", navigation: "Navigation der Spielanleitung", step: "Schritt", of: "von", player: "Spieler", start: "Start", empty: "leer", ice: "Attack Ice; keine nutzbare Verbindung", roll: "Vier Würfel werden geworfen", dice: "Vier Würfel", unused: "Die übrigen zwei Würfel stehen allen Mitspielern zur Verfügung.", neighbors: "↑ ↓ ← → · × Diagonal\nAuch bei Nachbarfeldern gelten die Zahlenregeln.", right: "✓ 12 < 24 < 46 · × 35 < 46\nHier verbindet die linke Nachbarzahl.", vertical: "46 oben = 46 unten", left: "✓ 35 < 46 · 35 ≠ 24\nEine gültige Verbindung genügt.", challenge: "Spieler A → Spieler B\nDer normale Würfelzug folgt danach.", secret: "Verdecktes Gebot", confirmed: "Bestätigt", tie: "Gleiche Gebote? Bietet erneut, bis ein Gewinner feststeht.", waiting: "Beide Gebote bleiben bis zum Aufdecken verdeckt.", choose: "Genau EINE Aktion wählen", freeze: "EINFRIEREN", unfreeze: "AUFTAUEN", freezeExample: "B2 von Spieler A einfrieren", unfreezeExample: "B2 von Spieler B auftauen", then: "Danach wird gewürfelt!", board: "BRETT", receipt: "BELEG", view: "Beispielansicht", boardValue: "BRETTWERT", spending: "CHALLENGE", balance: "SALDO", later: "Später im selben Spiel…", goal: "A1 → D7", target: "D7 erreicht", alternative: "12 ↔ 21" },
};
const finalDice = [1, 2, 4, 6];
const twoCopy = {
  en: { pass: "If the active player passes, the opponent may choose from all four dice.",
    start: "Five starting cells", repdigit: "44 → 2× points", direction: "12 < 24 < 46 · 24 = 24\nOne valid neighbor is enough.",
    tie: "0:0 is unlit · a positive tie counts for both players.", winner: "Player 1 wins: 3–2", special: "No Challenges or Streets in 2P mode.",
    arrows: "Player 1 light-blue arrow and Player 2 pink arrow both point right.", leaders: ["unlit", "Player 1 leads", "Player 2 leads", "tie: both lead"] },
  de: { pass: "Passt der aktive Spieler, darf der Gegner aus allen vier Würfeln wählen.",
    start: "Fünf Startfelder", repdigit: "44 → 2× Punkte", direction: "12 < 24 < 46 · 24 = 24\nEin gültiger Nachbar genügt.",
    tie: "0:0 leuchtet nicht · ein positiver Gleichstand zählt für beide.", winner: "Spieler 1 gewinnt: 3–2", special: "Im 2P-Modus gibt es keine Challenges oder Streets.",
    arrows: "Der hellblaue Pfeil für Spieler 1 und der pinke für Spieler 2 zeigen beide nach rechts.", leaders: ["unbeleuchtet", "Spieler 1 führt", "Spieler 2 führt", "Gleichstand: beide führen"] },
};

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
  let mode = byId("two-player-game")?.hidden === false ? "2p" : "3p-plus";
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
  const twoDemo = make("div", "tutorial-two-player", stage);
  twoDemo.hidden = true;
  function miniBoard(player) {
    const labelClass = "tutorial-two-player__label" + (player === 1 ? " tutorial-two-player__label--top" : "");
    const label = player === 1 ? make("p", labelClass, twoDemo) : null;
    const board = make("div", "tutorial-two-player__board", twoDemo);
    const ownerLabel = label ?? make("p", labelClass, twoDemo);
    board.dataset.player = String(player);
    board.setAttribute("role", "img");
    const cells = [];
    for (let row = 1; row <= 3; row += 1) for (const col of "ABCDE") {
      const coordinate = col + row;
      const slot = make("div", "tutorial-two-player__slot", board);
      const cell = make("div", "tutorial-two-player__cell", slot);
      cell.dataset.coordinate = coordinate;
      const value = make("span", "tutorial-two-player__value", cell);
      const multiplier = make("span", "tutorial-two-player__multiplier", cell);
      if (row === 3 && col !== "E") {
        const sign = make("span", "tutorial-two-player__sign", slot);
        sign.textContent = player === 1 ? ">" : "<";
        sign.setAttribute("aria-hidden", "true");
      }
      cells.push({ coordinate, cell, value, multiplier });
    }
    return { label: ownerLabel, board, cells };
  }
  const mini1 = miniBoard(1);
  const miniFrontline = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  miniFrontline.setAttribute("class", "two-player-frontline tutorial-two-player__frontline");
  miniFrontline.setAttribute("role", "img");
  miniFrontline.setAttribute("viewBox", "0 0 206 112");
  twoDemo.append(miniFrontline);
  function miniSvg(tag, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    miniFrontline.append(node);
    return node;
  }
  const miniGuides = ["player1", "player2"].map((player) => ({
    shaft: miniSvg("line", { class: `two-player-frontline__guide two-player-frontline__guide--${player}`, "aria-hidden": "true" }),
    head: miniSvg("polygon", { class: `two-player-frontline__guide-head two-player-frontline__guide-head--${player}`, "aria-hidden": "true" }),
  }));
  const miniOutline = miniSvg("path", { class: "two-player-frontline__outline" });
  const miniCurve = miniSvg("path", { class: "two-player-frontline__curve" });
  const miniDots = Array.from({ length: 5 }, () => miniSvg("circle", { r: 7.5, class: "two-player-frontline__point" }));
  const miniUpperScores = Array.from({ length: 5 }, () => miniSvg("text", { y: 14, class: "two-player-frontline__score" }));
  const miniLowerScores = Array.from({ length: 5 }, () => miniSvg("text", { y: 98, class: "two-player-frontline__score" }));
  const mini2 = miniBoard(2);
  let dots = [];
  function setProgressDots() {
    const progress = byId("tutorial-progress");
    progress.replaceChildren();
    dots = Array.from({ length: mode === "2p" ? TWO_PLAYER_TUTORIAL_STEPS.length : TUTORIAL_STEPS.length }, () => {
      const dot = make("span", "", progress);
      dot.setAttribute("aria-hidden", "true");
      return dot;
    });
  }
  setProgressDots();

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
  function renderNavigation(total) {
    const text = copy[language];
    byId("tutorial-back").textContent = text.back;
    byId("tutorial-back").disabled = step === 1;
    byId("tutorial-next").textContent = step === total ? text.play : text.next;
    byId("tutorial-navigation").setAttribute("aria-label", text.navigation);
    byId("tutorial-progress").setAttribute("aria-label", `${text.step} ${step} ${text.of} ${total}`);
    dots.forEach((dot, index) => { dot.dataset.current = String(index + 1 === step); });
  }
  function paintMiniBoard(target, player, scene) {
    const board = scene.state["player" + player].board;
    const occupied = [];
    target.label.textContent = copy[language].player + " " + player;
    for (const { coordinate, cell, value, multiplier } of target.cells) {
      const record = board[Number(coordinate[1]) - 1]["ABCDE".indexOf(coordinate[0])];
      cell.dataset.occupied = String(record !== null);
      cell.dataset.start = String(step === 3 && coordinate[1] === "3" && scene.stage === 0);
      cell.dataset.emphasis = String(scene.highlights.some(([owner, selected]) => owner === player && selected === coordinate));
      value.textContent = record?.value ?? "";
      multiplier.textContent = record && getCellScoreMultiplier(record) > 1 ? "2×" : "";
      if (record) occupied.push(coordinate + " " + record.value);
    }
    target.board.setAttribute("aria-label", `${copy[language].player} ${player}: ${occupied.join("; ") || copy[language].empty}`);
  }
  function paintMiniFrontline(scene) {
    const width = 206;
    const geometry = createFrontlineGeometry(scene.duels, width, phase.visualFractions);
    miniFrontline.setAttribute("viewBox", `0 0 ${width} ${geometry.height}`);
    directionArrowGeometry(width).forEach((arrow, index) => {
      const { shaft, head } = miniGuides[index];
      shaft.setAttribute("x1", arrow.startX); shaft.setAttribute("x2", arrow.baseX + 1);
      shaft.setAttribute("y1", arrow.y); shaft.setAttribute("y2", arrow.y);
      head.setAttribute("points", arrow.head);
    });
    miniOutline.setAttribute("d", geometry.center);
    miniCurve.setAttribute("d", geometry.center);
    geometry.points.forEach((point, index) => {
      miniDots[index].setAttribute("cx", point.x); miniDots[index].setAttribute("cy", point.y);
      miniDots[index].dataset.control = point.control;
      miniUpperScores[index].setAttribute("x", point.x);
      miniUpperScores[index].setAttribute("transform", `rotate(180 ${point.x} 14)`);
      miniUpperScores[index].textContent = point.player1;
      miniLowerScores[index].setAttribute("x", point.x);
      miniLowerScores[index].textContent = point.player2;
    });
    miniFrontline.setAttribute("aria-label", twoCopy[language].arrows + " " + scene.duels.map((duel) => {
      const leader = duel.player1.lit ? duel.player2.lit ? 3 : 1 : duel.player2.lit ? 2 : 0;
      return `${language === "de" ? "Spalte" : "Column"} ${duel.physical + 1}: ${copy[language].player} 1 ${duel.player1.score}, ${copy[language].player} 2 ${duel.player2.score}; ${twoCopy[language].leaders[leader]}`;
    }).join(". "));
  }
  function paintTwoPlayerDice() {
    const text = copy[language];
    diceArea.setAttribute("aria-label", phase.rolling ? text.roll : text.dice + ": " + finalDice.join(", "));
    dice.forEach(({ die, image }, index) => {
      image.src = "./assets/digital_dice/dice_" + phase.faces[index] + ".png";
      die.dataset.selected = String(!phase.rolling && (index === 0 || index === 3));
      die.dataset.secondary = String(!phase.rolling && (index === 1 || index === 2));
    });
    number.textContent = phase.rolling ? "" : "[1] [6] → 16 / 61";
    if (!phase.rolling) {
      const other = make("small", "", number);
      other.textContent = "[2] [4] → 24 / 42";
    }
  }
  function renderTwoPlayer() {
    const scene = getTwoPlayerTutorialScene(step, phase.demo);
    const text = copy[language], example = twoCopy[language];
    root.lang = language;
    root.setAttribute("aria-label", text.name);
    byId("tutorial-toggle-label").textContent = text.how;
    byId("tutorial-title").textContent = scene.title[language];
    byId("tutorial-explanation").textContent = scene.text[language];
    stage.dataset.mode = "2p";
    stage.dataset.step = String(step);
    stage.dataset.paired = "false";
    stage.dataset.instant = String(phase.instant || motion.matches);
    boards.A.figure.hidden = true;
    boards.B.figure.hidden = true;
    twoDemo.hidden = step === 2;
    diceArea.hidden = step !== 2;
    byId("tutorial-receipt").hidden = true;
    byId("tutorial-ice-options").hidden = true;
    byId("tutorial-final-views").hidden = true;
    if (step === 2) paintTwoPlayerDice();
    else {
      paintMiniBoard(mini1, 1, scene);
      paintMiniBoard(mini2, 2, scene);
      paintMiniFrontline(scene);
    }
    byId("tutorial-legend").textContent = step === 2 ? example.pass
      : step === 3 ? (scene.stage === 0 ? example.start : example.repdigit)
      : step === 4 ? example.direction
      : step === 5 ? example.tie
      : step === 6 ? (scene.stage === 5 ? example.winner + "\n" : "") + example.special : "";
    renderNavigation(TWO_PLAYER_TUTORIAL_STEPS.length);
  }
  function render() {
    if (mode === "2p") { renderTwoPlayer(); return; }
    const scene = getTutorialScene(step, action);
    const text = copy[language];
    const paired = step >= 9 && step <= 11;
    root.lang = language;
    root.setAttribute("aria-label", text.name);
    stage.dataset.mode = "3p-plus";
    twoDemo.hidden = true;
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
    renderNavigation(TUTORIAL_STEPS.length);
    renderCamera();
  }

  function enter(target, animate) {
    const total = mode === "2p" ? TWO_PLAYER_TUTORIAL_STEPS.length : TUTORIAL_STEPS.length;
    if (disposed || !expanded || !Number.isInteger(target) || target < 1 || target > total) return false;
    cancel();
    step = target;
    started = true;
    receiptView = false;
    phase = settledPhase();
    if (mode === "2p") {
      phase.demo = getTwoPlayerTutorialStageCount(step) - 1;
      phase.visualFractions = null;
      if (animate && !motion.matches) {
        phase.demo = 0;
        if (step === 2) {
          phase.rolling = true;
          let frame = 0;
          const cycle = () => {
            if (!phase.rolling) return;
            phase.faces = finalDice.map((_, index) => (frame + index) % 6 + 1);
            frame += 1;
            paintTwoPlayerDice();
            schedule(80, cycle, false);
          };
          cycle();
          schedule(1000, () => { cancel(); phase.rolling = false; phase.faces = [...finalDice]; });
        }
        const delays = { 3: [400, 1000], 4: [300, 700, 1100, 1500],
          5: [350, 1000, 1700], 6: [300, 600, 900, 1200, 1500] }[step] ?? [];
        delays.forEach((delay, index) => schedule(delay, () => {
          const from = getTwoPlayerTutorialScene(step, phase.demo).duels.map((duel) => frontlineFraction(duel.player1.score, duel.player2.score));
          phase.demo = index + 1;
          const to = getTwoPlayerTutorialScene(step, phase.demo).duels.map((duel) => frontlineFraction(duel.player1.score, duel.player2.score));
          phase.visualFractions = from;
          for (let frame = 1; frame <= 7; frame += 1) schedule(frame * 40, () => {
            const eased = (frame / 7) ** 2 * (3 - 2 * frame / 7);
            phase.visualFractions = from.map((value, i) => value + (to[i] - value) * eased);
          });
        }));
      }
      render();
      if (byId("tutorial-back").disabled && document.activeElement === byId("tutorial-back")) byId("tutorial-next").focus({ preventScroll: true });
      return true;
    }
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
    if (step < (mode === "2p" ? TWO_PLAYER_TUTORIAL_STEPS.length : TUTORIAL_STEPS.length)) goToStep(step + 1);
    else {
      cancel(); phase = settledPhase(); render();
      const board = byId("two-player-game")?.hidden === false ? byId("two-player-board-2") : byId("game-board");
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
  listen(document, "gamemodechange", (event) => {
    if (event.detail !== "2p" && event.detail !== "3p-plus" || event.detail === mode) return;
    cancel();
    mode = event.detail;
    step = 1;
    started = false;
    action = "freeze";
    receiptView = false;
    phase = settledPhase();
    setProgressDots();
    if (expanded) enter(1, true);
    else render();
  });
  listen(view, "resize", () => { if (mode === "3p-plus") renderCamera(); });
  listen(view, "pagehide", () => { cancel(); phase = settledPhase(); render(); });
  listen(motion, "change", () => { if (motion.matches) { cancel(); phase = settledPhase(); render(); } });
  panel.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
  render();
  return {
    goToStep,
    getState() { return { mode, step, expanded, action, receiptView, language, phase: { ...phase, faces: [...phase.faces], visualFractions: phase.visualFractions ? [...phase.visualFractions] : null },
      scene: mode === "2p" ? getTwoPlayerTutorialScene(step, phase.demo) : getTutorialScene(step, action) }; },
    destroy() { if (disposed) return; cancel(); disposed = true; panel.hidden = true; toggle.setAttribute("aria-expanded", "false"); unlisten.forEach((remove) => remove()); },
  };
}

if (typeof document !== "undefined") {
  const start = () => { if (document.getElementById("interactive-tutorial")) initializeTutorial(document); };
  if (document.readyState === "complete") start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
}
