import { initializeGameModes } from "../js/game-modes.js";
import { initializeRules, RULES_LANGUAGE_KEY } from "../js/rules.js";
import { createGameState, placeGameNumber, confirmGameBid } from "../js/game.js";
import { createTwoPlayerState, placeTwoPlayerNumber } from "../js/two-player-game.js";
import { GAME_MODE_KEY, serializeTwoPlayerGame, TWO_PLAYER_STORAGE_KEY } from "../js/two-player-storage.js";
import { serializeGame, STORAGE_KEY } from "../js/storage.js";
import { appTestStorage } from "./app-initialization.test.js";
import { rulesDocument } from "./rules.test.js";
import { digitalDiceFixture } from "./digital-dice.test.js";
import { assert, assertDeepEqual, assertEqual } from "./assert.js";

export function modeFixture({ classic, classicRaw, twoPlayer, preference, language = "en", storage: supplied, document: suppliedDocument, rulesReady = false } = {}) {
  const document = suppliedDocument ?? rulesDocument({ illustrated: false });
  const storage = supplied ?? appTestStorage(classicRaw ?? (classic ? serializeGame(classic) : null));
  if (twoPlayer) storage.setItem(TWO_PLAYER_STORAGE_KEY, serializeTwoPlayerGame(twoPlayer));
  if (preference !== undefined) storage.setItem(GAME_MODE_KEY, preference);
  storage.setItem(RULES_LANGUAGE_KEY, language);
  const add = (tag, id, parent = document.root) => {
    const element = document.createElement(tag); element.id = id; parent.append(element); return element;
  };
  const classicRoot = add("div", "classic-game");
  for (const id of ["game-board", "app-status", "storage-status", "street-bonus", "goal-status", "attack-ice-actions"]) classicRoot.append(document.getElementById(id));
  const switcher = add("div", "game-mode-switch"); switcher.setAttribute("role", "group");
  const trigger = add("button", "game-mode-trigger", switcher); trigger.type = "button";
  trigger.setAttribute("aria-haspopup", "menu"); trigger.setAttribute("aria-controls", "game-mode-options");
  add("span", "game-mode-label", trigger);
  const options = add("div", "game-mode-options", switcher); options.hidden = true; options.setAttribute("role", "menu");
  for (const [id, controls] of [["mode-2p", "two-player-game"], ["mode-3p-plus", "classic-game"]]) {
    const button = add("button", id, options); button.type = "button"; button.setAttribute("aria-controls", controls);
    button.setAttribute("role", "menuitemradio"); button.setAttribute("tabindex", "-1");
  }
  const controls = add("div", "header-controls"); controls.className = "game-stats";
  controls.append(switcher, document.getElementById("open-challenge"), document.getElementById("undo-move"), document.getElementById("open-receipt"));
  add("p", "mode-status");
  const root = add("section", "two-player-game"); root.hidden = true;
  for (const player of [1, 2]) {
    add("h2", "two-player-label-" + player, root);
    const area = add("div", "two-player-area-" + player, root); area.className = "two-player-board-area";
    const board = add("div", "two-player-board-" + player, area); board.dataset.player = String(player);
    add("p", "two-player-feedback-" + player, root);
  }
  add("svg", "two-player-duels", root);
  const rules = document.getElementById("rules");
  add("p", "two-player-help", rules).hidden = true;
  if (!document.getElementById("tutorial-toggle")) add("button", "tutorial-toggle", rules);
  add("p", "two-player-storage-status", root);
  const dialog = add("dialog", "mode-switch-dialog");
  add("h2", "mode-switch-heading", dialog); add("p", "mode-switch-detail", dialog);
  add("button", "cancel-mode-switch", dialog).type = "button";
  add("button", "confirm-mode-switch", dialog).type = "button";
  add("p", "reset-warning", document.getElementById("reset-confirmation")).textContent = "Start a new game? Your board and local save will be cleared.";
  document.getElementById("cancel-new-game").textContent = "Keep current game";
  document.getElementById("confirm-new-game").textContent = "Clear game and start again";
  if (!rulesReady) initializeRules(document, storage);
  const writes = [], removals = [];
  const save = storage.setItem.bind(storage), remove = storage.removeItem.bind(storage);
  storage.setItem = (key, value) => { writes.push([key, value]); save(key, value); };
  storage.removeItem = (key) => { removals.push(key); remove(key); };
  const controller = initializeGameModes(document, storage);
  return {
    document, storage, controller, writes, removals,
    node(id) { return document.getElementById(id); },
    click(id) { this.node(id).emit("click"); },
    change(mode, confirm = true) {
      if (options.hidden) this.click("game-mode-trigger");
      this.click(mode === "2p" ? "mode-2p" : "mode-3p-plus");
      if (confirm && dialog.open) this.click("confirm-mode-switch");
    },
    select(player, coordinate) {
      this.node("two-player-board-" + player).emit("click", this.node("two-player-" + player + "-" + coordinate));
      return this.node("two-player-entry");
    },
    digit(value) {
      const keypad = this.node("two-player-entry");
      keypad.emit("click", keypad.querySelector('button[data-digit="' + value + '"]'));
    },
    type(player, coordinate, value) {
      const keypad = this.select(player, coordinate);
      for (const digit of String(value)) this.digit(digit);
      return keypad;
    },
    placeClassic(coordinate, value) {
      this.node("board-rows").emit("click", this.node("cell-" + coordinate));
      const input = this.node("cell-" + coordinate); input.value = String(value); input.emit("input");
    },
    language(lang) { this.click("rules-language-" + lang); },
  };
}

export async function runGameModesTests(sources) {
  const results = [];
  function test(name, action) { try { action(); results.push({ name, passed: true }); } catch (error) { results.push({ name, passed: false, message: error.message }); } }
  if (!sources) {
    try {
      sources = Object.fromEntries(await Promise.all(Object.entries({ html: "../index.html", twoPlayerCss: "../css/two-player.css", modes: "../js/game-modes.js", twoPlayerApp: "../js/two-player-app.js", css: "../css/style.css" }).map(async ([name, path]) => {
        const response = await fetch(path, { cache: "no-store" });
        if (!response.ok) throw new Error(path); return [name, await response.text()];
      })));
    } catch (error) { return [{ name: "Mode sources are available", passed: false, message: error.message }]; }
  }

  test("New users default to classic with intact controls and no startup writes or deletes", () => {
    const f = modeFixture();
    assertEqual(f.controller.getMode(), "3p-plus");
    assertEqual(f.node("classic-game").hidden, false); assertEqual(f.node("two-player-game").hidden, true);
    assertEqual(f.node("open-challenge").hidden, false); assertEqual(f.node("open-receipt").hidden, false);
    assertEqual(f.node("mode-3p-plus").getAttribute("aria-checked"), "true");
    assertDeepEqual(f.writes, []); assertDeepEqual(f.removals, []);
    assertEqual(f.storage.getItem(GAME_MODE_KEY), null);
  });

  test("The compact dropdown starts closed, names the active mode, and exposes two checked-state menu items", () => {
    const f = modeFixture();
    assertEqual(f.node("game-mode-label").textContent, "3P+");
    assertEqual(f.node("game-mode-trigger").getAttribute("aria-expanded"), "false");
    assertEqual(f.node("game-mode-trigger").getAttribute("aria-haspopup"), "menu");
    assertEqual(f.node("game-mode-trigger").getAttribute("aria-controls"), "game-mode-options");
    assertEqual(f.node("game-mode-options").hidden, true);
    assertEqual(f.node("mode-2p").textContent, "2 Players");
    assertEqual(f.node("mode-3p-plus").textContent, "3+ Players");
    assertEqual(f.node("mode-2p").getAttribute("role"), "menuitemradio");
    assertEqual(f.node("mode-3p-plus").getAttribute("aria-checked"), "true");
    f.node("game-mode-trigger").emit("click", f.node("game-mode-trigger"), { detail: 0 });
    assertEqual(f.node("game-mode-options").hidden, false);
    assertEqual(f.document.activeElement, f.node("mode-3p-plus"));
    f.click("game-mode-trigger");
    assertEqual(f.node("game-mode-options").hidden, true);
    assertDeepEqual(f.writes, []); assertDeepEqual(f.removals, []);
  });

  test("Choosing a mode closes the menu and updates its short label; choosing it again does not write", () => {
    const f = modeFixture(); f.change("2p");
    assertEqual(f.node("game-mode-label").textContent, "2P");
    assertEqual(f.node("game-mode-options").hidden, true);
    assertEqual(f.node("game-mode-trigger").getAttribute("aria-expanded"), "false");
    assertEqual(f.node("mode-2p").getAttribute("aria-checked"), "true");
    const count = f.writes.length;
    f.change("2p");
    assertEqual(f.writes.length, count);
    assertEqual(f.node("game-mode-options").hidden, true);
    assertEqual(f.document.activeElement, f.node("game-mode-trigger"));
  });

  test("Arrow keys, Home/End and Escape navigate the dropdown without changing the game", () => {
    const f = modeFixture();
    const trigger = f.node("game-mode-trigger"), menu = f.node("game-mode-options");
    assertEqual(trigger.emit("keydown", trigger, { key: "ArrowDown" }).defaultPrevented, true);
    assertEqual(f.document.activeElement, f.node("mode-2p"));
    menu.emit("keydown", f.document.activeElement, { key: "ArrowDown" });
    assertEqual(f.document.activeElement, f.node("mode-3p-plus"));
    menu.emit("keydown", f.document.activeElement, { key: "ArrowDown" });
    assertEqual(f.document.activeElement, f.node("mode-2p"));
    menu.emit("keydown", f.document.activeElement, { key: "End" });
    assertEqual(f.document.activeElement, f.node("mode-3p-plus"));
    menu.emit("keydown", f.document.activeElement, { key: "Home" });
    assertEqual(f.document.activeElement, f.node("mode-2p"));
    menu.emit("keydown", f.document.activeElement, { key: "ArrowUp" });
    assertEqual(f.document.activeElement, f.node("mode-3p-plus"));
    const escape = menu.emit("keydown", f.document.activeElement, { key: "Escape" });
    assertEqual(escape.defaultPrevented, true); assertEqual(escape.propagationStopped, true);
    assertEqual(menu.hidden, true); assertEqual(f.document.activeElement, trigger);
    trigger.emit("keydown", trigger, { key: "ArrowUp" });
    assertEqual(f.document.activeElement, f.node("mode-3p-plus"));
    trigger.emit("keydown", trigger, { key: "Escape" });
    assertEqual(menu.hidden, true);
    assertEqual(f.controller.getMode(), "3p-plus"); assertDeepEqual(f.writes, []);
  });

  test("Outside pointer, assistive clicks and keyboard focus close the menu without stealing focus or saving", () => {
    const f = modeFixture();
    f.click("game-mode-trigger");
    f.node("full-rules-link").focus();
    f.document.emit("pointerdown", f.node("full-rules-link"));
    assertEqual(f.node("game-mode-options").hidden, true);
    assertEqual(f.document.activeElement, f.node("full-rules-link"));
    f.click("game-mode-trigger");
    f.document.emit("click", f.node("full-rules-link"));
    assertEqual(f.node("game-mode-options").hidden, true);
    f.click("game-mode-trigger");
    f.node("open-challenge").focus();
    f.document.emit("focusin", f.node("open-challenge"));
    assertEqual(f.node("game-mode-options").hidden, true);
    assertEqual(f.document.activeElement, f.node("open-challenge"));
    assertDeepEqual(f.writes, []);
  });

  test("Dropdown selection closes before confirmation, and cancellation keeps the mode and returns focus to the trigger", () => {
    const classic = placeGameNumber(createGameState(), "A1", 22);
    const f = modeFixture({ classic }); f.change("2p", false);
    assertEqual(f.node("mode-switch-dialog").open, true);
    assertEqual(f.node("game-mode-options").hidden, true);
    assertEqual(f.node("game-mode-label").textContent, "3P+");
    f.click("cancel-mode-switch");
    assertEqual(f.node("game-mode-label").textContent, "3P+");
    assertEqual(f.document.activeElement, f.node("game-mode-trigger"));
    assertDeepEqual(f.controller.classic.getState(), classic);
    assertDeepEqual(f.writes, []);
  });

  test("Restored 2P mode starts with a closed, correctly labeled dropdown", () => {
    const f = modeFixture({ preference: "2p", language: "de" });
    assertEqual(f.node("game-mode-label").textContent, "2P");
    assertEqual(f.node("game-mode-options").hidden, true);
    assertEqual(f.node("mode-2p").textContent, "2 Spieler");
    assertEqual(f.node("mode-3p-plus").textContent, "3+ Spieler");
    assertEqual(f.node("game-mode-trigger").getAttribute("aria-label"), "Spielmodus: 2P");
  });

  test("The relocated instructions are mode-specific, translated, and outside the game/meadow component", () => {
    const f = modeFixture(); const help = f.node("two-player-help");
    assertEqual(help.parentNode, f.node("rules"));
    assertEqual(f.node("two-player-game").contains(help), false);
    assertEqual(help.hidden, true);
    f.change("2p"); assertEqual(help.hidden, false);
    assertEqual(help.textContent, "Start in any outer-row cell. Win more columns to win. White points count for both players. No Challenges or Streets. First full board: finish the current roll together.");
    f.type(1, "A3", 22); const before = f.storage.getItem(TWO_PLAYER_STORAGE_KEY);
    f.language("de");
    assertEqual(help.textContent, "Beginnt in einem beliebigen Feld der äusseren Reihe. Wer mehr Spalten gewinnt, gewinnt. Weisse Punkte zählen für beide. Keine Challenges oder Strassen. Erstes volles Brett: Beendet den aktuellen Wurf gemeinsam.");
    assertEqual(f.node("mode-2p").textContent, "2 Spieler");
    assertEqual(f.storage.getItem(TWO_PLAYER_STORAGE_KEY), before);
    f.change("3p-plus"); assertEqual(help.hidden, true);
  });

  test("Only boards and the scoring strip occupy the central gaps, with labels/feedback at the owner edges", () => {
    const html = sources.html;
    const frame = html.slice(html.indexOf('<div class="two-player-frame">'), html.indexOf('id="two-player-storage-status"'));
    const ids = [...frame.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
    assertDeepEqual(ids, ["two-player-label-1", "two-player-feedback-1", "two-player-board-1", "two-player-duels", "two-player-board-2", "two-player-feedback-2", "two-player-label-2"]);
    assert(sources.twoPlayerCss.includes('.two-player-frontline { display: block; width: 100%; height: 112px; margin: 6px 0;'));
    assert(sources.twoPlayerCss.includes('.two-player-label--top, .two-player-feedback--top { transform: rotate(180deg); }'));
    const rules = html.slice(html.indexOf('<section id="rules"'));
    assert(/<p id="two-player-help" class="two-player-help" hidden><\/p>\s*<button id="tutorial-toggle"/.test(rules));
    assertEqual((html.match(/id="two-player-help"/g) ?? []).length, 1);
    const helpStyle = sources.twoPlayerCss.match(/\.rules-illustration > \.two-player-help\s*\{([^}]+)\}/)?.[1];
    assert(helpStyle && !/position:|transform:/.test(helpStyle));
  });

  test("Existing classic saves are never reset, migrated on disk, or used to infer a mode", () => {
    const classic = placeGameNumber(createGameState(), "A1", 23);
    const f = modeFixture({ classic });
    assertEqual(f.controller.getMode(), "3p-plus");
    assertEqual(f.storage.getItem(STORAGE_KEY), serializeGame(classic));
    assertDeepEqual(f.controller.classic.getState(), classic);
    assertDeepEqual(f.writes, []);
    const raw = JSON.stringify({ version: 2, state: { board: Array.from({ length: 7 }, () => [null, null, null, null]) } });
    const migrated = modeFixture({ classicRaw: raw });
    assertEqual(migrated.storage.getItem(STORAGE_KEY), raw);
    assertDeepEqual(migrated.writes, []);
  });

  test("Empty-mode switching is immediate, persistent, and restores the selected mode on refresh", () => {
    const f = modeFixture(); f.change("2p");
    assertEqual(f.node("mode-switch-dialog").open, false);
    assertEqual(f.controller.getMode(), "2p");
    assertEqual(f.node("mode-2p").getAttribute("aria-checked"), "true");
    assertEqual(f.storage.getItem(GAME_MODE_KEY), "2p");
    assertEqual(f.node("classic-game").hidden, true);
    assertEqual(f.node("open-challenge").hidden, true); assertEqual(f.node("open-receipt").hidden, true);
    const restored = modeFixture({ storage: f.storage });
    assertEqual(restored.controller.getMode(), "2p");
    assertEqual(restored.node("two-player-game").hidden, false);
  });

  test("Meaningful classic progress requires confirmation; cancellation changes no saved state", () => {
    const classic = confirmGameBid(placeGameNumber(createGameState(), "A1", 22), 0);
    const f = modeFixture({ classic });
    const before = f.storage.getItem(STORAGE_KEY);
    f.change("2p", false);
    assertEqual(f.node("mode-switch-dialog").open, true);
    assertEqual(f.controller.getMode(), "3p-plus");
    assertEqual(f.document.activeElement, f.node("cancel-mode-switch"));
    assertDeepEqual(f.writes, []); assertDeepEqual(f.removals, []);
    f.click("cancel-mode-switch");
    assertEqual(f.controller.getMode(), "3p-plus");
    assertEqual(f.storage.getItem(STORAGE_KEY), before);
    assertEqual(f.storage.getItem(GAME_MODE_KEY), null);
    assertEqual(f.node("undo-move").disabled, false);
  });

  test("Confirmed switches keep separate authoritative games and preserve classic receipts, bids and Undo", () => {
    const classic = confirmGameBid(placeGameNumber(createGameState(), "A1", 22), 5);
    const f = modeFixture({ classic }); f.change("2p");
    f.type(2, "A3", 16); const two = f.storage.getItem(TWO_PLAYER_STORAGE_KEY);
    assertEqual(f.storage.getItem(STORAGE_KEY), serializeGame(classic));
    f.change("3p-plus");
    assertEqual(f.node("open-challenge").hidden, false); assertEqual(f.node("open-receipt").hidden, false);
    assertEqual(f.node("current-score").textContent, "39");
    assertDeepEqual(f.controller.classic.getState(), classic);
    assertEqual(f.storage.getItem(TWO_PLAYER_STORAGE_KEY), two);
    f.click("open-receipt");
    assertEqual(f.node("receipt-history").children[0].textContent, "1x Challenge #01-$5");
    f.click("close-receipt"); f.change("2p");
    assertEqual(f.controller.twoPlayer.getState().player2.board[2][0].value, 16);
  });

  test("Selecting 2P at startup does not clear an existing classic save or its Undo", () => {
    const classic = placeGameNumber(createGameState(), "A1", 23);
    const f = modeFixture({ classic, preference: "2p" });
    assertDeepEqual(f.controller.classic.getState(), classic);
    assertEqual(f.storage.getItem(STORAGE_KEY), serializeGame(classic));
    assertDeepEqual(f.writes, []); assertDeepEqual(f.removals, []);
  });

  test("Opening a receipt, tutorial-related page content, or a draft does not count as progress", () => {
    const f = modeFixture(); f.click("open-receipt"); f.click("close-receipt");
    f.node("board-rows").emit("click", f.node("cell-A1")); f.node("cell-A1").value = "2";
    f.change("2p");
    assertEqual(f.controller.getMode(), "2p"); assertEqual(f.node("mode-switch-dialog").open, false);
    assertEqual(f.storage.getItem(STORAGE_KEY), null);
  });

  test("An open classic modal prevents switching and a failed mode preference write keeps the active game", () => {
    const f = modeFixture(); f.click("open-challenge");
    assertEqual(f.controller.requestMode("2p"), false);
    f.click("close-challenge");
    f.storage.setItem = () => { throw new Error("Blocked"); };
    assertEqual(f.controller.requestMode("2p"), false);
    assertEqual(f.controller.getMode(), "3p-plus");
    assertEqual(f.node("classic-game").hidden, false);
    assert(f.node("mode-status").textContent.includes("kept"));
    assertEqual(f.node("mode-3p-plus").getAttribute("aria-checked"), "true");
  });

  test("Confirmation Escape/cancel and repeated taps cannot switch or save twice", () => {
    const f = modeFixture({ classic: placeGameNumber(createGameState(), "A1", 16) });
    f.change("2p", false);
    assertEqual(f.controller.requestMode("2p"), false);
    f.node("mode-switch-dialog").emit("cancel");
    assertEqual(f.controller.getMode(), "3p-plus");
    f.change("2p", false); f.click("confirm-mode-switch"); f.click("confirm-mode-switch");
    assertEqual(f.writes.filter(([key]) => key === GAME_MODE_KEY).length, 1);
    assertDeepEqual(f.removals, []);
  });

  test("A preference failure after confirmation preserves active mode, board, Undo, and saved bytes", () => {
    const game = placeGameNumber(createGameState(), "A1", 22);
    const f = modeFixture({ classic: game });
    f.change("2p", false);
    f.storage.setItem = () => { throw new Error("Quota exceeded"); };
    f.click("confirm-mode-switch");
    assertEqual(f.controller.getMode(), "3p-plus");
    assertEqual(f.node("mode-switch-dialog").open, false);
    assertDeepEqual(f.controller.classic.getState(), game);
    assertEqual(f.storage.getItem(STORAGE_KEY), serializeGame(game));
    assertEqual(f.node("undo-move").disabled, false);
    assertEqual(f.node("mode-3p-plus").getAttribute("aria-checked"), "true");
  });

  test("A real Digital Dice roll, collapse preference, and selections survive switching modes", () => {
    const dice = digitalDiceFixture({ expanded: true });
    const f = modeFixture({ document: dice.document, storage: dice.storage, rulesReady: true });
    dice.activate();
    assertEqual(dice.controller.getState().rolling, true);
    const pending = [...dice.clock.pending.keys()];
    f.change("2p"); dice.toggleDisclosure(); f.change("3p-plus");
    assertDeepEqual([...dice.clock.pending.keys()], pending);
    assertEqual(dice.controller.getState().rolling, true);
    dice.clock.advance(1600);
    assertEqual(dice.controller.getState().rolling, false);
    assertDeepEqual(dice.controller.getState().dice.map((die) => die.value), [2, 4, 4, 6]);
    dice.toggleDisclosure(); dice.select(0);
    const selected = dice.controller.getState();
    f.placeClassic("A1", 22); f.change("2p");
    assertDeepEqual(dice.controller.getState(), selected);
    assertEqual(dice.randomCalls, 4);
    assertDeepEqual(f.controller.twoPlayer.getState(), createTwoPlayerState());
    assertEqual(f.node("digital-dice").hidden, false);
  });

  test("The component renders 30 cells, eight starting-row signs and one continuous five-point Frontline", () => {
    const f = modeFixture({ preference: "2p" });
    for (const player of [1, 2]) {
      const board = f.node("two-player-board-" + player);
      assertEqual(board.querySelectorAll("button").length, 15);
      assertEqual(board.querySelectorAll("span").filter((node) => node.className === "two-player-comparison-sign").length, 4);
      assertDeepEqual(board.querySelectorAll("span").filter((node) => node.className === "two-player-comparison-sign").map((node) => node.textContent), Array(4).fill(player === 1 ? ">" : "<"));
      assertEqual(board.dataset.player, String(player));
    }
    const frontline = f.node("two-player-duels");
    assertEqual(frontline.tagName, "svg");
    assertEqual(frontline.querySelectorAll("path").length, 2);
    assertEqual(frontline.querySelectorAll("circle").length, 5);
    assertEqual(frontline.querySelectorAll("text").length, 10);
    assertEqual(frontline.querySelectorAll("polygon").length, 0);
    assert(frontline.querySelectorAll("circle").every((node) => node.dataset.control === "empty"));
    assert(f.node("two-player-help").textContent.includes("current roll"));
  });

  test("Frontline scores, points and ribbon follow placement, tie, Undo, and Reset", () => {
    const f = modeFixture({ preference: "2p" });
    const svg = f.node("two-player-duels"), circles = svg.querySelectorAll("circle");
    const scores = svg.querySelectorAll("text"), ribbon = svg.querySelectorAll("path")[0];
    assertEqual(Number(circles[0].getAttribute("cy")), 56);
    f.type(1, "E3", 24);
    assertEqual(Number(circles[0].getAttribute("cy")), 82);
    assertEqual(circles[0].dataset.control, "player1");
    assertEqual(scores[0].textContent, "24");
    assertEqual(scores[5].textContent, "0");
    const before = ribbon.getAttribute("d");
    f.type(2, "A3", 24);
    assertEqual(Number(circles[0].getAttribute("cy")), 56);
    assertEqual(circles[0].dataset.control, "tie");
    assertEqual(scores[5].textContent, "24");
    assert(before !== ribbon.getAttribute("d"));
    f.type(2, "A2", 24);
    assert(Math.abs(Number(circles[0].getAttribute("cy")) - (30 + 52 / 3)) < 0.001);
    assertEqual(circles[0].dataset.control, "player2");
    f.click("undo-move");
    assertEqual(Number(circles[0].getAttribute("cy")), 56);
    assertEqual(circles[0].dataset.control, "tie");
    f.click("new-game"); f.click("confirm-new-game");
    assert(circles.every((circle) => circle.dataset.control === "empty"));
    assert(scores.every((score) => score.textContent === "0"));
  });

  test("Frontline moves for 280ms and updates immediately with reduced motion", () => {
    const document = rulesDocument({ illustrated: false });
    const frames = new Map(); let nextId = 0;
    document.defaultView.requestAnimationFrame = (callback) => { frames.set(++nextId, callback); return nextId; };
    document.defaultView.cancelAnimationFrame = (id) => { frames.delete(id); };
    document.defaultView.matchMedia = () => ({ matches: false });
    const f = modeFixture({ document, preference: "2p" });
    const point = f.node("two-player-duels").querySelectorAll("circle")[0];
    f.type(1, "E3", 24);
    assertEqual(Number(point.getAttribute("cy")), 56);
    for (const time of [0, 140, 280]) {
      const pending = [...frames.values()]; frames.clear();
      pending.forEach((callback) => callback(time));
    }
    assertEqual(Number(point.getAttribute("cy")), 82);
    assertEqual(frames.size, 0);
    const reduced = rulesDocument({ illustrated: false });
    reduced.defaultView.requestAnimationFrame = () => { throw new Error("Reduced motion must not animate"); };
    reduced.defaultView.matchMedia = () => ({ matches: true });
    const instant = modeFixture({ document: reduced, preference: "2p" });
    instant.type(2, "A3", 24);
    assertEqual(Number(instant.node("two-player-duels").querySelectorAll("circle")[0].getAttribute("cy")), 30);
  });

  test("Frontline centers follow measured board width from 320px through 430px screens", () => {
    for (const viewport of [320, 375, 390, 430]) {
      const f = modeFixture({ preference: "2p" });
      const width = Math.min(viewport - 24, 448) - 10;
      f.node("two-player-board-2").clientWidth = width;
      f.controller.twoPlayer.setActive(true);
      const svg = f.node("two-player-duels");
      assertEqual(svg.getAttribute("viewBox"), `0 0 ${width} 112`);
      const cell = (width - 16) / 5;
      svg.querySelectorAll("circle").forEach((point, i) => {
        assertEqual(Number(point.getAttribute("cx")), (i + 0.5) * cell + 4 * i);
      });
      assert(svg.getAttribute("aria-label").includes("column"));
    }
  });

  test("Digit buttons place independently for either owner and uses original numbers with small repdigit multipliers", () => {
    const f = modeFixture({ preference: "2p" });
    f.type(2, "E3", 66);
    assertEqual(f.controller.twoPlayer.getState().player1.board.flat().filter(Boolean).length, 0);
    f.type(1, "A3", 22);
    assertEqual(f.node("two-player-1-A3").textContent, "222×");
    assertEqual(f.controller.twoPlayer.getState().player1.board[2][0].value, 22);
    assertEqual(f.controller.twoPlayer.getState().player2.board[2][4].value, 66);
    assertEqual(f.node("two-player-1-A3").disabled, true);
    const frontline = f.node("two-player-duels");
    assert(frontline.getAttribute("aria-label").includes("44"));
    assert(frontline.getAttribute("aria-label").includes("132"));
    assertEqual(frontline.querySelectorAll("circle")[0].dataset.control, "empty");
    assertEqual(frontline.querySelectorAll("circle")[4].dataset.control, "player2");
  });

  test("First digit is only a draft; the second places once without any native input", () => {
    const f = modeFixture({ preference: "2p" });
    const keypad = f.select(1, "C3");
    assertEqual(keypad.hidden, false);
    assertEqual(f.node("two-player-entry-draft").textContent, "– –");
    assertDeepEqual(keypad.querySelectorAll("button").map((button) => button.textContent), ["1", "2", "3", "4", "5", "6"]);
    assertEqual(f.node("two-player-game").querySelectorAll("input").length, 0);
    assertEqual(f.document.activeElement.tagName, "button");
    f.digit(2);
    assertEqual(f.node("two-player-entry-draft").textContent, "2 –");
    assertEqual(f.controller.twoPlayer.getState().player1.board[2][2], null);
    assertEqual(f.storage.getItem(TWO_PLAYER_STORAGE_KEY), null);
    assertEqual(f.node("undo-move").disabled, true);
    const staleSecond = keypad.querySelector('button[data-digit="4"]');
    f.digit(4); keypad.emit("click", staleSecond);
    assertEqual(f.controller.twoPlayer.getState().player1.board[2][2].value, 24);
    assertEqual(f.writes.filter(([key]) => key === TWO_PLAYER_STORAGE_KEY).length, 1);
    assertEqual(keypad.hidden, true);
    assertEqual(f.node("two-player-1-C3").tagName, "button");
    assertEqual(f.document.activeElement, f.node("two-player-board-1"));
  });

  test("Digit order and repetitions are preserved, including the legal 2P start value 66", () => {
    for (const value of [24, 42, 11, 22, 66]) {
      const f = modeFixture({ preference: "2p" }); f.type(2, "B3", value);
      assertEqual(f.controller.twoPlayer.getState().player2.board[2][1].value, value);
      assertEqual(f.node("two-player-entry").hidden, true);
    }
  });

  test("One shared keypad follows the owner and avoids the selected outer row", () => {
    const f = modeFixture({ preference: "2p" });
    const keypad = f.select(1, "B2");
    assertEqual(keypad.dataset.player, "1"); assertEqual(keypad.dataset.edge, "top");
    assertEqual(keypad.parentNode, f.node("two-player-board-1").parentNode);
    f.select(1, "B3"); assertEqual(keypad.dataset.edge, "bottom");
    f.select(2, "D2");
    assertEqual(keypad.dataset.player, "2"); assertEqual(keypad.dataset.edge, "bottom");
    assertEqual(keypad.parentNode, f.node("two-player-board-2").parentNode);
    f.select(2, "D3"); assertEqual(keypad.dataset.edge, "top");
    assertEqual(f.node("two-player-game").descendants().filter((node) => node.id === "two-player-entry").length, 1);
    assert(sources.twoPlayerCss.includes('.two-player-entry[data-player="1"] { transform: rotate(180deg); }'));
    assert(!sources.twoPlayerCss.includes('.two-player-entry[data-player="2"] { transform:'));
    assert(sources.twoPlayerCss.includes('.two-player-board-area { position: relative; min-width: 0; }'));
    assert(sources.twoPlayerCss.includes('.two-player-entry { position: absolute; left: 0; right: 0;'));
    assert(sources.twoPlayerCss.includes('grid-template-columns: repeat(6, minmax(0, 1fr))'));
    assert(!sources.twoPlayerApp.includes('createElement("input")'));
  });

  test("Rejected placements retain the target, clear digits, and preserve boards, save bytes, points and Undo", () => {
    const f = modeFixture({ preference: "2p" }); f.type(2, "A3", 16);
    const before = f.storage.getItem(TWO_PLAYER_STORAGE_KEY);
    const state = f.controller.twoPlayer.getState();
    const scores = f.node("two-player-duels").textContent;
    const writes = f.writes.length;
    for (const [cell, value] of [["B3", 12], ["A2", 24], ["B2", 35]]) {
      f.type(2, cell, value);
      assertEqual(f.node("two-player-2-" + cell).getAttribute("aria-pressed"), "true");
      assertDeepEqual(f.controller.twoPlayer.getState(), state);
      assertEqual(f.storage.getItem(TWO_PLAYER_STORAGE_KEY), before);
      assertEqual(f.node("two-player-duels").textContent, scores);
      assertEqual(f.node("undo-move").disabled, false);
      assertEqual(f.node("two-player-entry").hidden, false);
      assertEqual(f.node("two-player-entry-draft").textContent, "– –");
      assert(f.node("two-player-feedback-2").textContent.includes("neighbor"));
    }
    assertEqual(f.writes.length, writes);
    f.select(2, "B3"); f.digit(1); f.digit(2);
    f.digit(2); f.digit(4);
    assertEqual(f.controller.twoPlayer.getState().player2.board[2][1].value, 24);
    assertEqual(f.node("two-player-entry").hidden, true);
  });

  test("Invalid starting row keeps its existing feedback and can retry without creating history", () => {
    const f = modeFixture({ preference: "2p" }); f.type(1, "A1", 24);
    assert(f.node("two-player-feedback-1").textContent.includes("outer row"));
    assertEqual(f.node("two-player-entry-draft").textContent, "– –");
    assertEqual(f.node("two-player-entry").hidden, false);
    assertDeepEqual(f.controller.twoPlayer.getState(), createTwoPlayerState());
    assertDeepEqual(f.writes, []);
  });

  test("Changing cells or owners discards a partial entry without remounting tapped buttons", () => {
    const f = modeFixture({ preference: "2p" }); f.type(1, "A3", 1);
    const next = f.node("two-player-1-B3");
    f.document.emit("pointerdown", next);
    assertEqual(f.node("two-player-1-B3"), next);
    f.select(1, "B3"); f.document.emit("click", next);
    assertEqual(f.node("two-player-entry-draft").textContent, "– –");
    assertEqual(f.node("two-player-1-A3").getAttribute("aria-pressed"), "false");
    f.digit(2); f.select(2, "E3");
    assertEqual(f.node("two-player-entry-draft").textContent, "– –");
    assertEqual(f.node("two-player-entry").dataset.player, "2");
    f.digit(4); f.digit(2);
    assertEqual(f.controller.twoPlayer.getState().player2.board[2][4].value, 42);
    assertEqual(f.controller.twoPlayer.getState().player1.board.flat().filter(Boolean).length, 0);
  });

  test("Outside pointer, assistive click and keyboard focus dismiss without state changes or stealing focus", () => {
    for (const type of ["pointerdown", "click", "focusin"]) {
      const f = modeFixture({ preference: "2p" }); f.type(1, "A3", 1);
      const target = f.node("full-rules-link"); target.focus();
      f.document.emit(type, target);
      assertEqual(f.node("two-player-entry").hidden, true);
      assertEqual(f.node("two-player-entry-draft").textContent, "– –");
      assertEqual(f.document.activeElement, target);
      assertEqual(f.node("two-player-1-A3").getAttribute("aria-pressed"), "false");
      assertDeepEqual(f.controller.twoPlayer.getState(), createTwoPlayerState());
      assertDeepEqual(f.writes, []);
    }
  });

  test("Digit pointer/focus/click events do not invoke outside dismissal, and Escape returns to the empty target", () => {
    const f = modeFixture({ preference: "2p" }); const keypad = f.select(2, "C3");
    const digit = keypad.querySelector('button[data-digit="3"]');
    digit.focus(); f.document.emit("pointerdown", digit); f.document.emit("focusin", digit);
    keypad.emit("click", digit, { detail: 0 }); f.document.emit("click", digit);
    assertEqual(f.node("two-player-entry-draft").textContent, "3 –");
    assertEqual(f.node("two-player-entry").hidden, false);
    const escape = f.document.emit("keydown", digit, { key: "Escape" });
    assertEqual(escape.defaultPrevented, true);
    assertEqual(keypad.hidden, true);
    assertEqual(f.document.activeElement, f.node("two-player-2-C3"));
    assertDeepEqual(f.writes, []);
  });

  test("Undo and Reset dismiss drafts while preserving the established action path", () => {
    const f = modeFixture({ preference: "2p" }); f.type(2, "A3", 22);
    f.type(1, "C3", 2); f.click("undo-move");
    assertEqual(f.node("two-player-entry").hidden, true);
    assertDeepEqual(f.controller.twoPlayer.getState(), createTwoPlayerState());
    f.type(1, "B3", 3); f.click("new-game");
    assertEqual(f.node("two-player-entry").hidden, true);
    assertEqual(f.node("reset-confirmation").hidden, false);
    f.click("cancel-new-game"); assertEqual(f.node("two-player-entry").hidden, true);
    assertDeepEqual(f.writes.filter(([key]) => key === TWO_PLAYER_STORAGE_KEY).length, 2);
  });

  test("Mode changes discard unfinished keypad entry and preserve classic native input", () => {
    const f = modeFixture({ preference: "2p" }); f.type(2, "A3", 3);
    f.change("3p-plus");
    assertEqual(f.node("two-player-entry").hidden, true);
    const state = f.controller.twoPlayer.getState();
    f.node("board-rows").emit("click", f.node("cell-A1"));
    const input = f.node("cell-A1");
    assertEqual(input.tagName, "input"); assertEqual(input.getAttribute("inputmode"), "numeric");
    input.value = "24"; input.emit("input");
    assertEqual(f.controller.classic.getState().board[0][0].value, 24);
    assertDeepEqual(f.controller.twoPlayer.getState(), state);
    f.node("two-player-entry").emit("click", f.node("two-player-entry").querySelector('button[data-digit="2"]'));
    assertDeepEqual(f.controller.twoPlayer.getState(), state);
  });

  test("Prime freeze/thaw artwork and shared Undo follow the same UI path on independent boards", () => {
    const f = modeFixture({ preference: "2p" });
    f.type(1, "A3", 31); f.type(1, "B3", 23);
    const frozen = f.node("two-player-1-B3");
    assertEqual(frozen.dataset.state, "frozen");
    assertEqual(frozen.querySelector("img").src, "./assets/icecube.png");
    f.type(2, "E3", 23);
    f.type(1, "A2", 31);
    assertEqual(f.node("two-player-1-B3").dataset.state, "thawed");
    assertEqual(f.node("two-player-1-B3").querySelector("img"), null);
    assertEqual(f.node("two-player-1-A2").dataset.state, "frozen");
    f.click("undo-move");
    assertEqual(f.node("two-player-1-B3").dataset.state, "frozen");
    assertEqual(f.node("two-player-1-A2").dataset.state, "empty");
    assertEqual(f.controller.twoPlayer.getState().player2.board[2][4].value, 23);
    assertEqual(f.node("undo-move").disabled, true);
  });

  test("Hidden classic handlers cannot mutate classic state while 2P receives Undo and Reset", () => {
    const classic = placeGameNumber(createGameState(), "A1", 22);
    const f = modeFixture({ classic, preference: "2p" });
    f.type(1, "A3", 16); f.type(2, "E3", 24);
    f.click("open-challenge"); f.click("open-receipt");
    assertEqual(f.node("challenge-dialog").open, false); assertEqual(f.node("receipt-dialog").open, false);
    f.click("undo-move");
    assertEqual(f.controller.twoPlayer.getState().player2.board[2][4], null);
    assertDeepEqual(f.controller.classic.getState(), classic);
    f.click("new-game"); f.click("confirm-new-game");
    assertDeepEqual(f.controller.twoPlayer.getState(), createTwoPlayerState());
    assertDeepEqual(f.controller.classic.getState(), classic);
    assertEqual(f.storage.getItem(STORAGE_KEY), serializeGame(classic));
    assertEqual(f.storage.getItem(TWO_PLAYER_STORAGE_KEY), null);
  });

  test("2P Reset requires confirmation; cancel and failed clearing preserve both boards and Undo", () => {
    const f = modeFixture({ preference: "2p" }); f.type(1, "B3", 16); f.type(2, "D3", 24);
    const before = f.controller.twoPlayer.getState();
    f.click("confirm-new-game"); assertDeepEqual(f.controller.twoPlayer.getState(), before);
    f.click("new-game"); assertEqual(f.node("reset-confirmation").hidden, false);
    f.click("cancel-new-game"); assertDeepEqual(f.controller.twoPlayer.getState(), before);
    f.storage.removeItem = () => { throw new Error("Blocked"); };
    f.click("new-game"); f.click("confirm-new-game");
    assertDeepEqual(f.controller.twoPlayer.getState(), before);
    assertEqual(f.node("reset-confirmation").hidden, false);
    assert(f.node("two-player-storage-status").textContent.includes("kept"));
  });

  test("Classic Reset, placements and protection work normally after visiting 2P", () => {
    const f = modeFixture(); f.change("2p"); f.type(2, "A3", 16); const two = f.storage.getItem(TWO_PLAYER_STORAGE_KEY);
    f.change("3p-plus");
    f.placeClassic("A1", 66); assertEqual(f.node("cell-A1").dataset.state, "empty");
    f.placeClassic("A1", 22); assertEqual(f.node("current-score").textContent, "44");
    f.click("new-game"); f.click("confirm-new-game");
    assertEqual(f.storage.getItem(STORAGE_KEY), null);
    assertEqual(f.storage.getItem(TWO_PLAYER_STORAGE_KEY), two);
    assertEqual(f.node("reset-warning").textContent, "Start a new game? Your board and local save will be cleared.");
  });

  test("Language changes translate new UI without replacing numbers, drafts, Undo, or preference", () => {
    const f = modeFixture({ preference: "2p" }); f.type(1, "C3", 24);
    const before = f.storage.getItem(TWO_PLAYER_STORAGE_KEY);
    const input = f.type(2, "A3", "1");
    f.language("de");
    assertEqual(f.node("two-player-entry"), input); assertEqual(f.node("two-player-entry-draft").textContent, "1 –");
    assertEqual(f.node("two-player-label-1").textContent, "Spieler 1");
    assert(f.node("two-player-help").textContent.includes("Wurf"));
    assert(f.node("reset-warning").textContent.includes("Beide Bretter"));
    assertEqual(f.node("game-mode-switch").getAttribute("aria-label"), "Spielmodus");
    assertEqual(f.storage.getItem(TWO_PLAYER_STORAGE_KEY), before);
    f.change("3p-plus", false);
    assertEqual(f.node("mode-switch-heading").textContent, "Spielmodus wechseln?");
    assertEqual(f.node("cancel-mode-switch").textContent, "Abbrechen");
    f.click("cancel-mode-switch");
    assertEqual(f.storage.getItem(GAME_MODE_KEY), "2p");
  });

  test("Valid 2P ice and Undo restore on a fresh page and malformed saved data does not crash", () => {
    let game = placeTwoPlayerNumber(createTwoPlayerState(), 1, "A3", 31);
    game = placeTwoPlayerNumber(game, 1, "B3", 23);
    const f = modeFixture({ twoPlayer: game, preference: "2p" });
    assertDeepEqual(f.controller.twoPlayer.getState(), game);
    assertEqual(f.node("two-player-1-B3").dataset.state, "frozen");
    assertEqual(f.node("two-player-duels").querySelectorAll("circle")[4].dataset.control, "player1");
    assertEqual(f.node("undo-move").disabled, false);
    const bad = modeFixture({ preference: "2p" }); bad.storage.setItem(TWO_PLAYER_STORAGE_KEY, "bad-json");
    const restored = modeFixture({ storage: bad.storage });
    assertDeepEqual(restored.controller.twoPlayer.getState(), createTwoPlayerState());
    assertEqual(restored.storage.getItem(TWO_PLAYER_STORAGE_KEY), "bad-json");
    assert(restored.node("two-player-storage-status").textContent.includes("could not"));
  });

  test("Mode-confirmation dialogs block background placements and Undo in either mode", () => {
    const f = modeFixture({ classic: placeGameNumber(createGameState(), "A1", 16) });
    const classic = f.controller.classic.getState(); f.change("2p", false); f.click("undo-move");
    assertDeepEqual(f.controller.classic.getState(), classic); f.click("confirm-mode-switch");
    f.type(1, "A3", 16); const state = f.controller.twoPlayer.getState();
    f.change("3p-plus", false); f.click("undo-move");
    f.node("two-player-board-2").emit("click", f.node("two-player-2-B3"));
    assertDeepEqual(f.controller.twoPlayer.getState(), state);
    assertEqual(f.node("two-player-2-B3").tagName, "button");
  });

  test("Filled boards keep the other player interactive and expose no winner or turn-management UI", () => {
    let state = createTwoPlayerState();
    for (const row of [3, 2, 1]) for (const [col, value] of [66, 44, 36, 24, 12].entries()) state = placeTwoPlayerNumber(state, 1, "ABCDE"[col] + row, value);
    const f = modeFixture({ twoPlayer: state, preference: "2p" });
    assertEqual(f.node("two-player-board-2").querySelectorAll("button").filter((cell) => !cell.disabled).length, 15);
    f.type(2, "C3", 16); assertEqual(f.controller.twoPlayer.getState().player2.board[2][2].value, 16);
    assert(f.node("two-player-duels").textContent.includes("396"));
    assertEqual(f.node("mode-switch-dialog").open, false);
    assert(!/winner-dialog|next-turn|active-player|turn-counter/.test(sources.html));
  });

  test("Mode controls, opposing boards, Frontline geometry, and reduced motion are explicit in source", () => {
    assert(sources.html.includes('src="./js/game-modes.js?v=frontline-visual-1"'));
    assert(sources.html.includes('id="mode-2p" type="button" role="menuitemradio" aria-checked="false" aria-controls="two-player-game"'));
    assert(sources.html.includes('id="mode-3p-plus" type="button" role="menuitemradio" aria-checked="true" aria-controls="classic-game"'));
    assert(sources.html.includes('id="two-player-game" class="two-player-game" aria-label="Two players on one device" hidden'));
    assert(sources.html.includes('id="digital-dice"'));
    assert(sources.html.includes('id="interactive-tutorial"'));
    assert(sources.html.includes('href="./rules.html"'));
    assert(sources.twoPlayerCss.includes('.two-player-board[data-player="1"] { transform: rotate(180deg); }'));
    assert(!sources.twoPlayerCss.includes('.two-player-board[data-player="2"] { transform: rotate(180deg); }'));
    assert(sources.twoPlayerCss.includes('grid-template-columns: repeat(5, minmax(0, 1fr))'));
    assert(sources.twoPlayerCss.includes('min-height: 48px'));
    assert(sources.twoPlayerApp.includes('matchMedia?.("(prefers-reduced-motion: reduce)")'));
    assert(sources.twoPlayerCss.includes('.two-player-comparison-sign'));
    assert(sources.twoPlayerCss.includes('pointer-events: none'));
    assert(sources.twoPlayerCss.includes('.two-player-frontline__point[data-control="player1"] { fill: #78cff4;'));
    assert(sources.twoPlayerCss.includes('.two-player-frontline__point[data-control="player2"] { fill: #ec86b8;'));
    assert(sources.twoPlayerApp.includes('r: 7.5, class: "two-player-frontline__point"'));
    assert(sources.twoPlayerCss.includes('stroke-width: 2.25;'));
    assert(sources.twoPlayerCss.includes('drop-shadow(0 0 4.5px #78cff4)'));
    assert(!sources.twoPlayerCss.includes('.two-player-triangle'));
    assert(!/\.page-title\s*\{|100vw|scale\(/.test(sources.twoPlayerCss));
    assert(sources.css.includes('width: clamp(4.5rem, 24vw, 6rem)'));
    assert(/class="game-stats">\s*<div id="game-mode-switch"/.test(sources.html));
    assert(sources.twoPlayerCss.includes('.page-header .game-stats { position: relative; }'));
    assert(sources.twoPlayerCss.includes('right: calc(100% + 8px); top: 50%; transform: translateY(-50%)'));
    assert(!sources.twoPlayerCss.includes('min-height: 6rem'));
    assert(!sources.twoPlayerCss.includes('margin-top: 44px'));
    assert(sources.twoPlayerCss.includes('.game-mode-options { position: absolute; left: 0; right: auto;'));
    assert(sources.twoPlayerCss.includes('.game-mode-switch[data-mode="2p"] .game-mode-options { left: auto; right: 0; }'));
    for (const width of [320, 375, 390, 430, 1280]) {
      const content = Math.min(width - 24, 448);
      const cell = (content - 10 - 16) / 5;
      assert(cell >= 48);
      const triggerWidth = 64;
      const dropdownWidth = Math.min(160, width * 0.8);
      // Check popup bounds for the classic controls and the Undo-only 2P header.
      for (const [mode, controlsWidth] of [["3p-plus", 176], ["2p", 48]]) {
        const controlsLeft = content - controlsWidth;
        const triggerLeft = controlsLeft - 8 - triggerWidth;
        const triggerRight = triggerLeft + triggerWidth;
        assertEqual(controlsLeft - triggerRight, 8);
        assert(triggerLeft >= 0);
        const menuLeft = mode === "2p" ? triggerRight - dropdownWidth : triggerLeft;
        assert(menuLeft >= 0 && menuLeft + dropdownWidth <= content);
      }
      const maximumTextWidth = 3 * 24 * 0.65 * cell / 100;
      assert(maximumTextWidth < cell * 0.5);
    }
  });
  return results;
}
