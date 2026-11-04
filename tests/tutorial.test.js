import { initializeTutorial } from "../js/tutorial.js";
import { boardFromPlacements, EXAMPLE_CHALLENGE, EXAMPLE_PLACEMENTS, FINAL_PLACEMENTS, getTutorialCamera, getTutorialScene, TUTORIAL_STEPS } from "../js/tutorial-scenes.js";
import { applyAttackIce, canApplyAttackIce, confirmGameBid, createEmptyBoard, createGameState, getCell, hasReachedGoal, isValidNumber, placeGameNumber, placeNumber, validatePlacement } from "../js/game.js";
import { getScoreBreakdown } from "../js/scoring.js";
import { STORAGE_KEY } from "../js/storage.js";
import { RULES_LANGUAGE_KEY } from "../js/rules.js";
import { digitalDiceFixture } from "./digital-dice.test.js";
import { assert, assertDeepEqual, assertEqual, assertThrows } from "./assert.js";

// The same Rules, live app, Digital Dice controller, and DOM double used by the
// existing integration tests. No browser, layout engine, or animation library.
function fixture(options = {}) {
  const real = digitalDiceFixture(options);
  const document = real.document;
  const add = (tag, id, parent = document.root) => {
    const element = document.createElement(tag);
    element.id = id;
    parent.append(element);
    return element;
  };
  const toggle = add("button", "tutorial-toggle");
  toggle.type = "button";
  toggle.setAttribute("aria-controls", "tutorial-panel");
  add("span", "tutorial-toggle-label", toggle);
  const panel = add("div", "tutorial-panel");
  const root = add("section", "interactive-tutorial", panel);
  add("h3", "tutorial-title", root);
  add("p", "tutorial-explanation", root);
  const stage = add("div", "tutorial-stage", root);
  let width = options.stageWidth ?? 284;
  stage.getBoundingClientRect = () => ({ width: panel.hidden ? 0 : width, height: panel.hidden ? 0 : 416 });
  add("figure", "tutorial-player-a", stage);
  add("figure", "tutorial-player-b", stage);
  add("div", "tutorial-dice", stage);
  const receipt = add("div", "tutorial-receipt", stage);
  for (const name of ["board-value", "spending", "balance"]) {
    add("dt", "tutorial-" + name + "-label", receipt);
    add("dd", "tutorial-" + name, receipt);
  }
  add("p", "tutorial-legend", stage);
  for (const [group, names] of [["ice-options", ["freeze", "unfreeze"]], ["final-views", ["show-board", "show-receipt"]]]) {
    const parent = add("div", "tutorial-" + group, root);
    for (const name of names) add("button", "tutorial-" + name, parent).type = "button";
  }
  const nav = add("nav", "tutorial-navigation", root);
  add("div", "tutorial-progress", nav);
  add("button", "tutorial-back", nav).type = "button";
  add("button", "tutorial-next", nav).type = "button";
  const motionListeners = new Set();
  const motion = { matches: options.reduced ?? false,
    addEventListener(type, callback) { motionListeners.add(callback); },
    removeEventListener(type, callback) { motionListeners.delete(callback); } };
  const tutorial = initializeTutorial(document, { motion, setTimeout: real.clock.setTimeout, clearTimeout: real.clock.clearTimeout });
  return { ...real, real, tutorial, toggle, tutorialPanel: panel, stage,
    node(id) { return document.getElementById(id); },
    click(name) { this.node("tutorial-" + name).emit("click"); },
    open() { toggle.emit("click"); },
    go(step) { tutorial.goToStep(step); },
    settle() { real.clock.advance(4000); },
    language(lang) { document.getElementById("rules-language-" + lang).emit("click"); },
    resizeStage(next) { width = next; real.resize(512); },
    reduce() { motion.matches = true; motionListeners.forEach((callback) => callback()); },
    cell(coordinate, player = "A") { return document.getElementById("tutorial-" + player + "-" + coordinate); },
  };
}
function occupied(board) { return board.flat().filter(Boolean).length; }
function childByClass(element, className) { return element.descendants().find((node) => node.className.split(" ").includes(className)); }
function shownValue(f, coordinate) { return childByClass(f.cell(coordinate), "tutorial-cell__value").textContent; }
function note(f, player, className) { return childByClass(f.node("tutorial-player-" + player.toLowerCase()), className); }

export async function runTutorialTests(sources) {
  const results = [];
  function test(name, action) {
    try { action(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, message: error.message }); }
  }
  if (!sources) {
    try {
      sources = Object.fromEntries(await Promise.all(Object.entries({ html: "../index.html", tutorial: "../js/tutorial.js", tutorialScenes: "../js/tutorial-scenes.js", tutorialCss: "../css/tutorial.css" }).map(async ([name, url]) => {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error("Cannot load " + url);
        return [name, await response.text()];
      })));
    } catch (error) { return [{ name: "Tutorial sources are available", passed: false, message: error.message }]; }
  }

  test("Exactly twelve declarative bilingual steps start at the goal and end at the finish", () => {
    assertEqual(TUTORIAL_STEPS.length, 12);
    assertDeepEqual(TUTORIAL_STEPS.map((scene) => scene.id), Array.from({ length: 12 }, (_, i) => i + 1));
    assertEqual(TUTORIAL_STEPS[0].title.en, "The Goal");
    assertEqual(TUTORIAL_STEPS[11].title.de, "Das Ziel");
    assertEqual(TUTORIAL_STEPS[11].text.en, "The player who reaches D7 first wins! If two players reach D7 at the same time, the player with more Frosty Dollars wins.");
    assertEqual(TUTORIAL_STEPS[11].text.de, "Wer D7 zuerst erreicht, gewinnt! Erreichen zwei Spieler D7 gleichzeitig, gewinnt der Spieler mit mehr Frosty Dollars.");
    for (const scene of TUTORIAL_STEPS) for (const language of ["en", "de"]) {
      assert(scene.title[language].length > 0);
      assert(scene.text[language].length > 0);
    }
    assertThrows(() => getTutorialScene(0));
    assertThrows(() => getTutorialScene(13));
    assertThrows(() => getTutorialScene(8, "both"));
  });

  test("Every required placement passes the current engine; B2 connects through its right neighbor", () => {
    let board = createEmptyBoard();
    for (const [coordinate, value] of EXAMPLE_PLACEMENTS) {
      assert(validatePlacement(board, coordinate, value).legal, coordinate);
      board = placeNumber(board, coordinate, value);
    }
    assertEqual(getCell(board, "B1").value, 24);
    assertEqual(getCell(board, "C2").value, 46);
    assertEqual(getCell(board, "B2").value, 35);
    assertEqual(occupied(board), 5);
    const before = getTutorialScene(7).boardA;
    assertEqual(validatePlacement(before, "B2", 35).legal, true);
    assertEqual(validatePlacement(getTutorialScene(6).boardA, "D1", 35).legal, false);
    assertEqual(validatePlacement(getTutorialScene(5).boardA, "A2", 24).legal, false);
  });

  test("Step 4/7/8 snapshots reconstruct exactly 3/4/5 placements and are independent copies", () => {
    for (const [step, count] of [[4, 3], [7, 4], [8, 5]]) {
      const scene = getTutorialScene(step);
      assertEqual(occupied(scene.boardA), count);
      assertDeepEqual(scene.boardA, boardFromPlacements(EXAMPLE_PLACEMENTS.slice(0, count)));
      scene.boardA[0][0].value = 66;
      scene.boardA[0][1] = null;
      assertEqual(getCell(getTutorialScene(step).boardA, "A1").value, 12);
      assertEqual(occupied(getTutorialScene(step).boardA), count);
    }
  });

  test("Both final Challenge branches have a legal 28-cell continuation, goal, and consistent receipt", () => {
    for (const action of EXAMPLE_CHALLENGE.actions) {
      let board = getTutorialScene(11, action).boardA;
      for (const [coordinate, value] of FINAL_PLACEMENTS) {
        assert(isValidNumber(value));
        assert(validatePlacement(board, coordinate, value).legal, action + " " + coordinate);
        board = placeNumber(board, coordinate, value);
      }
      const scene = getTutorialScene(12, action);
      assertDeepEqual(scene.boardA, board);
      assertEqual(occupied(board), 28);
      assertEqual(hasReachedGoal(board), true);
      assertEqual(board.flat().every((cell) => cell.status === "normal"), true);
      assertDeepEqual(scene.scoring, { baseSum: 1114, streetBonus: 0, streetRows: [], score: 1084 });
      assertEqual(scene.pointsSpent, 30);
    }
  });

  test("Challenge data has unequal affordable bids, no tie winner, one action, and a later normal turn", () => {
    assertDeepEqual(EXAMPLE_CHALLENGE.bids, { A: 30, B: 50 });
    assertEqual(EXAMPLE_CHALLENGE.winner, "B");
    assert(EXAMPLE_CHALLENGE.bids.B > EXAMPLE_CHALLENGE.bids.A);
    assertEqual(EXAMPLE_CHALLENGE.beforeDice, true);
    assertEqual(EXAMPLE_CHALLENGE.tieWinner, null);
    assertEqual(EXAMPLE_CHALLENGE.tieAction, "bid-again");
    const scene = getTutorialScene(10);
    assert(scene.scoring.score >= 0);
    assert(getScoreBreakdown(scene.boardB, scene.opponentSpent).score >= 0);
    for (const coordinate of ["A1", "B1", "C1", "D1"]) {
      assertEqual(canApplyAttackIce(scene.boardA, coordinate), false);
      assertThrows(() => applyAttackIce(scene.boardA, coordinate), "first row");
    }
    const freeze = getTutorialScene(11, "freeze");
    const unfreeze = getTutorialScene(11, "unfreeze");
    assertEqual(getCell(freeze.boardA, "B2").attackIce, true);
    assertEqual(getCell(freeze.boardB, "B2").attackIce, true);
    assertEqual(!!getCell(unfreeze.boardA, "B2").attackIce, false);
    assertEqual(!!getCell(unfreeze.boardB, "B2").attackIce, false);
    assertEqual(getScoreBreakdown(freeze.boardA).score, getScoreBreakdown(unfreeze.boardA).score);
  });

  test("Camera keeps full boards at steps 1/12, stable upper views at 4–8, and physical peripheral clipping", () => {
    for (const screen of [320, 375, 390, 430, 1280]) {
      const width = Math.min((screen - 24) * 0.96, 512);
      const full = getTutorialCamera(1, width, 416);
      assertEqual(full.columns, 4);
      assertEqual(full.rows, 7);
      assertDeepEqual(getTutorialCamera(12, width, 416), full);
      assert(full.width <= width && full.height <= 344);
      const upper = getTutorialCamera(4, width, 416);
      for (const step of [5, 6, 7, 8]) assertDeepEqual(getTutorialCamera(step, width, 416), upper);
      assertEqual(upper.rows, 2.45);
      assertEqual(upper.columns, 4);
      assert(Math.abs(upper.height / upper.scale - 245) < 0.0001);
      assert(200 * upper.scale < upper.height && 300 * upper.scale > upper.height);
      assert(upper.width <= width);
      for (const step of [9, 10, 11]) for (const player of ["A", "B"]) {
        const camera = getTutorialCamera(step, width, 416, player);
        assertEqual(camera.rows, 2.45);
        assertEqual(camera.columns, 2.45);
        assert(camera.width + (width - 12) * 0.8 / 1.8 + 12 <= width + 0.0001);
        assert(camera.height + 24 <= 172);
        const b2Left = 100 * camera.scale + camera.x;
        assert(b2Left >= 0 && b2Left + 100 * camera.scale <= camera.width);
      }
    }
  });

  test("Tutorial initially stays collapsed with a semantic disclosure, no timers, and twelve progress dots", () => {
    const f = fixture();
    assertEqual(f.tutorialPanel.hidden, true);
    assertEqual(f.toggle.type, "button");
    assertEqual(f.toggle.getAttribute("aria-expanded"), "false");
    assertEqual(f.toggle.getAttribute("aria-controls"), "tutorial-panel");
    assertEqual(f.tutorial.getState().step, 1);
    assertEqual(f.clock.pending.size, 0);
    assertEqual(f.node("tutorial-progress").children.length, 12);
    assertEqual(f.node("tutorial-back").disabled, true);
    assertEqual(f.tutorial.goToStep(4), false);
    f.toggle.focus();
    f.toggle.emit("click", f.toggle, { detail: 0 });
    assertEqual(f.toggle.getAttribute("aria-expanded"), "true");
    assertEqual(f.tutorialPanel.hidden, false);
    assertEqual(f.tutorial.getState().step, 1);
  });

  test("Next/Back boundaries and repeated navigation reconstruct rather than accumulate placements", () => {
    const f = fixture({ reduced: true });
    f.open();
    f.click("back");
    assertEqual(f.tutorial.getState().step, 1);
    f.click("next");
    assertEqual(f.tutorial.getState().step, 2);
    assertEqual(f.tutorial.goToStep(13), false);
    for (let pass = 0; pass < 3; pass += 1) {
      f.go(8); assertEqual(shownValue(f, "B2"), "35");
      f.click("back"); assertEqual(shownValue(f, "B2"), ""); assertEqual(shownValue(f, "C2"), "46");
      f.click("back"); assertEqual(shownValue(f, "C2"), "");
      f.go(4); assertEqual(occupied(f.tutorial.getState().scene.boardA), 3);
    }
    f.node("tutorial-back").focus();
    f.go(1);
    assertEqual(f.document.activeElement, f.node("tutorial-next"));
  });

  test("Step 4 places A1, B1, C1 in sequence without automatic step progression", () => {
    const f = fixture(); f.open(); f.go(4);
    assertEqual(shownValue(f, "A1"), "");
    f.clock.advance(300);
    assertEqual(shownValue(f, "A1"), "12"); assertEqual(shownValue(f, "B1"), "");
    f.clock.advance(550);
    assertEqual(shownValue(f, "B1"), "24"); assertEqual(shownValue(f, "C1"), "");
    f.clock.advance(550);
    assertEqual(shownValue(f, "C1"), "46");
    f.settle();
    assertEqual(f.tutorial.getState().step, 4);
    assertEqual(f.clock.pending.size, 0);
  });

  test("Diagonal and smaller-right attempts stay visual only and disappear after rejection", () => {
    const f = fixture(); f.open();
    for (const [step, coordinate, value] of [[5, "A2", "24"], [6, "D1", "35"]]) {
      f.go(step);
      f.clock.advance(350);
      assertEqual(shownValue(f, coordinate), value);
      assertEqual(f.cell(coordinate).dataset.attempt, "true");
      assertEqual(getCell(f.tutorial.getState().scene.boardA, coordinate), null);
      f.clock.advance(650);
      assertEqual(shownValue(f, coordinate), "");
      assertEqual(occupied(f.tutorial.getState().scene.boardA), 3);
    }
  });

  test("Vertical equality and horizontal OR connections are displayed with symbols as well as color", () => {
    const f = fixture(); f.open(); f.go(7);
    assertEqual(shownValue(f, "C2"), "");
    f.clock.advance(800);
    assertEqual(shownValue(f, "C2"), "46");
    assert(f.node("tutorial-player-a").textContent.includes("="));
    f.go(8); f.clock.advance(450);
    assertEqual(shownValue(f, "B2"), "35");
    assert(f.node("tutorial-player-a").textContent.includes("≠"));
    assert(f.node("tutorial-player-a").textContent.includes("<"));
    assert(f.node("tutorial-legend").textContent.includes("One valid connection"));
  });

  test("Demonstration dice settle deterministically and chosen order can form 12 or 21", () => {
    const f = fixture(); f.open(); f.go(2);
    assertEqual(f.tutorial.getState().phase.rolling, true);
    f.clock.advance(1000);
    assertDeepEqual(f.tutorial.getState().phase.faces, [1, 2, 4, 6]);
    assertEqual(f.clock.pending.size, 0);
    assertEqual(f.real.randomCalls, 0);
    f.go(3);
    assertEqual(f.tutorial.getState().phase.number, 12);
    f.clock.advance(650);
    assertEqual(f.tutorial.getState().phase.number, 21);
    f.clock.advance(650);
    assertEqual(f.tutorial.getState().phase.number, 12);
    const faces = f.node("tutorial-dice").descendants().filter((node) => node.className === "tutorial-die");
    assertDeepEqual(faces.map((node) => node.dataset.selected), ["true", "true", "false", "false"]);
  });

  test("Rapid navigation cancels pending work and generation guards reject already-queued callbacks", () => {
    const f = fixture(); f.open(); f.go(4);
    const stale = [...f.clock.pending.values()].map((entry) => entry.callback);
    f.go(5); f.go(8); f.go(3);
    const state = f.tutorial.getState();
    stale.forEach((callback) => callback());
    assertDeepEqual(f.tutorial.getState(), state);
    f.settle();
    assertEqual(f.tutorial.getState().step, 3);
    assertEqual(occupied(f.tutorial.getState().scene.boardA), 0);
    assertEqual(f.clock.pending.size, 0);
  });

  test("Collapsing cancels and settles animations, preserves step, and returns focus without rebuilding boards", () => {
    const f = fixture(); f.open(); f.go(7);
    const original = f.cell("C2");
    f.node("tutorial-next").focus();
    f.open();
    assertEqual(f.tutorialPanel.hidden, true);
    assertEqual(f.clock.pending.size, 0);
    assertEqual(f.document.activeElement, f.toggle);
    f.open();
    assertEqual(f.tutorial.getState().step, 7);
    assertEqual(f.cell("C2"), original);
    assertEqual(shownValue(f, "C2"), "46");
    assertEqual(f.clock.pending.size, 0);
    assertEqual(f.node("tutorial-progress").getAttribute("aria-label"), "Step 7 of 12");
  });

  test("Step 10 enters both example bids, conceals them, then confirms without exposing the amounts", () => {
    const f = fixture(); f.open(); f.go(10);
    assertEqual(note(f, "A", "tutorial-note__amount").textContent, "$30");
    assertEqual(note(f, "B", "tutorial-note__amount").textContent, "");
    f.clock.advance(450);
    assertEqual(note(f, "A", "tutorial-note__amount").textContent, "");
    assertEqual(note(f, "B", "tutorial-note__amount").textContent, "$50");
    f.clock.advance(450);
    for (const player of ["A", "B"]) {
      assertEqual(note(f, player, "tutorial-note__amount").textContent, "");
      assertEqual(note(f, player, "tutorial-note").dataset.reveal, "false");
      assertEqual(note(f, player, "tutorial-note__face").getAttribute("aria-hidden"), "true");
    }
    f.clock.advance(550);
    assertEqual(f.tutorial.getState().phase.confirmed, 2);
    assertEqual(note(f, "A", "tutorial-note__status").textContent, "Confirmed");
    assertEqual(note(f, "B", "tutorial-note__status").textContent, "Confirmed");
    assertEqual(f.node("tutorial-legend").textContent, "Equal Bids? Bid again until a winner is determined.");
    f.language("de");
    assertEqual(f.node("tutorial-legend").textContent, "Gleiche Gebote? Bietet erneut, bis ein Gewinner feststeht.");
    assertEqual(f.tutorial.getState().step, 10);
  });

  test("Step 11 reveals bids before enabling alternatives; Freeze and Unfreeze remain exclusive", () => {
    const f = fixture(); f.open(); f.go(11);
    assertEqual(note(f, "A", "tutorial-note").dataset.reveal, "false");
    assertEqual(f.node("tutorial-unfreeze").disabled, true);
    f.clock.advance(300);
    assertEqual(note(f, "A", "tutorial-note__amount").textContent, "$30");
    assertEqual(note(f, "B", "tutorial-note__amount").textContent, "$50");
    assertEqual(note(f, "A", "tutorial-note__face").getAttribute("aria-hidden"), "true");
    f.clock.advance(700);
    assertEqual(f.node("tutorial-unfreeze").disabled, false);
    assertEqual(note(f, "A", "tutorial-note__face").getAttribute("aria-hidden"), "false");
    f.clock.advance(300);
    assertEqual(f.cell("B2").dataset.attackIce, "true");
    f.click("unfreeze"); f.clock.advance(80);
    assertEqual(f.cell("B2").dataset.attackIce, "false");
    assertEqual(f.cell("B2", "B").dataset.attackIce, "false");
    assertEqual(f.node("tutorial-unfreeze").getAttribute("aria-pressed"), "true");
    f.click("freeze"); f.clock.advance(80);
    assertEqual(f.cell("B2").dataset.attackIce, "true");
    assertEqual(f.cell("B2", "B").dataset.attackIce, "true");
    assert(f.node("tutorial-legend").textContent.includes("exactly ONE"));
    assert(f.node("tutorial-legend").textContent.includes("Then it’s time to roll!"));
  });

  test("Step 12 shows the full board, finishes D7, then shows one consistent fixed receipt", () => {
    const f = fixture(); f.open(); f.go(12);
    assertEqual(shownValue(f, "D7"), "");
    assertEqual(f.node("tutorial-receipt").hidden, true);
    f.clock.advance(600);
    assertEqual(shownValue(f, "D7"), "56");
    assertEqual(f.node("tutorial-show-receipt").disabled, false);
    f.clock.advance(1400);
    assertEqual(f.node("tutorial-receipt").hidden, false);
    assertEqual(f.node("tutorial-player-a").hidden, true);
    assertEqual(f.node("tutorial-board-value").textContent, "$1,114");
    assertEqual(f.node("tutorial-spending").textContent, "-$30");
    assertEqual(f.node("tutorial-balance").textContent, "$1,084");
    f.click("show-board");
    assertEqual(f.node("tutorial-player-a").hidden, false);
    assertEqual(f.node("tutorial-receipt").hidden, true);
    f.click("show-receipt");
    assertEqual(f.node("tutorial-receipt").hidden, false);
    assertEqual(f.node("tutorial-next").textContent, "LET’S PLAY!");
  });

  test("Language switching preserves current progress, active animation, and Digital Dice behavior", () => {
    const f = fixture(); f.open(); f.go(4); f.clock.advance(300);
    const pending = [...f.clock.pending.keys()];
    f.language("de");
    assertEqual(f.tutorial.getState().step, 4);
    assertEqual(f.tutorial.getState().phase.placements, 1);
    assertDeepEqual([...f.clock.pending.keys()], pending);
    assertEqual(f.node("tutorial-title").textContent, "Zahlen platzieren");
    assertEqual(f.node("tutorial-toggle-label").textContent, "SPIELANLEITUNG");
    assertEqual(f.node("tutorial-next").textContent, "WEITER");
    assertEqual(f.node("tutorial-back").textContent, "ZURÜCK");
    assertEqual(f.node("tutorial-progress").getAttribute("aria-label"), "Schritt 4 von 12");
    assertEqual(f.node("digital-dice-toggle-label").textContent, "DIGITALE WÜRFEL");
    assertEqual(f.node("full-rules-link").textContent, "ALLE REGELN");
    f.settle(); assertEqual(shownValue(f, "C1"), "46");
    f.go(11); f.settle();
    assertEqual(childByClass(f.node("tutorial-player-b"), "tutorial-player__label").textContent, "Spieler B");
    f.go(12); f.settle();
    assertEqual(f.node("tutorial-next").textContent, "JETZT SPIELEN!");
    f.language("en");
    assertEqual(f.node("tutorial-next").textContent, "LET’S PLAY!");
    assertEqual(f.storage.getItem(RULES_LANGUAGE_KEY), "en");
  });

  test("A page restored from Rules updates tutorial and dice language while preserving progress and selections", () => {
    const f = fixture(); f.real.activate(); f.clock.advance(1600); f.real.select(0);
    f.open(); f.go(8); f.settle();
    const before = f.tutorial.getState();
    const dice = f.real.controller.getState();
    f.storage.setItem(RULES_LANGUAGE_KEY, "de");
    f.document.defaultView.dispatchEvent({ type: "pageshow", persisted: true });
    assertEqual(f.tutorial.getState().language, "de");
    assertEqual(f.tutorial.getState().step, before.step);
    assertDeepEqual(f.tutorial.getState().scene.boardA, before.scene.boardA);
    assertEqual(f.node("tutorial-title").textContent, "Nach links");
    assertEqual(f.node("full-rules-link").textContent, "ALLE REGELN");
    assertEqual(f.node("digital-dice-toggle-label").textContent, "DIGITALE WÜRFEL");
    assertDeepEqual(f.real.controller.getState(), dice);
  });

  test("A restored German preference applies before first expansion without changing disclosure state", () => {
    const f = fixture({ language: "de" });
    assertEqual(f.tutorialPanel.hidden, true);
    assertEqual(f.node("tutorial-toggle-label").textContent, "SPIELANLEITUNG");
    f.open();
    assertEqual(f.node("tutorial-title").textContent, "Das Spielziel");
    assertEqual(f.node("interactive-tutorial").lang, "de");
  });

  test("Reduced motion settles all twelve scenes without timers or rapid dice cycling", () => {
    const f = fixture({ reduced: true }); f.open();
    for (let step = 1; step <= 12; step += 1) {
      f.go(step);
      assertEqual(f.clock.pending.size, 0);
      assertEqual(f.stage.dataset.instant, "true");
      assertEqual(f.tutorial.getState().phase.rolling, false);
    }
    assertEqual(shownValue(f, "D7"), "56");
    f.click("show-receipt"); assertEqual(f.node("tutorial-receipt").hidden, false);
    f.click("next");
    assertDeepEqual(f.node("game-board").lastScrollOptions, { behavior: "auto", block: "start" });
  });

  test("Changing to reduced motion and pagehide cancel pending animation and retain current scene", () => {
    const f = fixture(); f.open(); f.go(2); f.reduce();
    assertEqual(f.clock.pending.size, 0);
    assertDeepEqual(f.tutorial.getState().phase.faces, [1, 2, 4, 6]);
    const g = fixture(); g.open(); g.go(4); g.real.pagehide();
    assertEqual(g.clock.pending.size, 0);
    assertEqual(g.tutorial.getState().step, 4);
    assertEqual(shownValue(g, "C1"), "46");
  });

  test("Resize recalculates only the camera and preserves current state and pending animation", () => {
    const f = fixture(); f.open(); f.go(8);
    const state = f.tutorial.getState();
    const pending = [...f.clock.pending.keys()];
    const viewport = childByClass(f.node("tutorial-player-a"), "tutorial-viewport");
    const before = viewport.style.width;
    f.resizeStage(350);
    assert(before !== viewport.style.width);
    assertDeepEqual(f.tutorial.getState(), state);
    assertDeepEqual([...f.clock.pending.keys()], pending);
  });

  test("Tutorial is independent of real board, balance, expenses, Undo, save, open receipt, and selected dice", () => {
    let game = placeGameNumber(createGameState(), "A1", 22);
    game = placeGameNumber(game, "B1", 24);
    game = confirmGameBid(game, 5);
    const f = fixture({ game, reduced: true });
    f.real.activate(); f.real.select(0); f.real.select(1);
    f.node("open-receipt").emit("click");
    const saved = f.storage.getItem(STORAGE_KEY);
    const digital = f.real.controller.getState();
    const receipt = f.node("receipt-dialog").textContent;
    const receiptArt = f.node("receipt-art").src;
    const score = f.node("current-score").textContent;
    const undo = f.node("undo-move").disabled;
    const board = f.node("board-rows").textContent;
    f.open();
    for (let step = 1; step <= 12; step += 1) f.go(step);
    f.go(11); f.click("unfreeze"); f.go(12); f.click("show-receipt"); f.language("de"); f.click("next");
    assertEqual(f.storage.getItem(STORAGE_KEY), saved);
    assertDeepEqual(f.real.controller.getState(), digital);
    assertEqual(f.node("receipt-dialog").open, true);
    assertEqual(f.node("receipt-dialog").textContent, receipt);
    assertEqual(f.node("receipt-art").src, receiptArt);
    assertEqual(f.node("current-score").textContent, score);
    assertEqual(f.node("undo-move").disabled, undo);
    assertEqual(f.node("board-rows").textContent, board);
    assertEqual(f.document.activeElement, f.node("game-board"));
    assertEqual(f.tutorial.getState().step, 12);
  });

  test("Cancelling or destroying the tutorial never interrupts a real Digital Dice roll", () => {
    const f = fixture(); f.real.activate();
    assertEqual(f.real.controller.getState().rolling, true);
    const actualTimers = [...f.clock.pending.keys()];
    f.open(); f.go(4); f.go(2); f.open();
    assertDeepEqual([...f.clock.pending.keys()], actualTimers);
    f.open(); f.go(11); f.tutorial.destroy();
    assertDeepEqual([...f.clock.pending.keys()], actualTimers);
    f.clock.advance(2000);
    assertEqual(f.real.controller.getState().rolling, false);
    assertDeepEqual(f.real.controller.getState().dice.map((die) => die.value), [2, 4, 4, 6]);
    assertEqual(f.real.randomCalls, 4);
    f.toggle.emit("click");
    assertEqual(f.tutorialPanel.hidden, true);
    assertEqual(f.tutorial.goToStep(3), false);
  });

  test("Semantic HTML, isolated styling, reduced motion, fixed receipt, and no surprise-mechanic copy", () => {
    assert(sources.html.includes('href="./css/tutorial.css?v=tutorial-1"'));
    assert(sources.html.includes('src="./js/tutorial.js?v=rules-page-1"'));
    for (const [toggle, panel] of [["tutorial-toggle", "tutorial-panel"]]) {
      const button = sources.html.match(new RegExp('<button id="' + toggle + '"[^>]*>'))?.[0];
      assert(button.includes('type="button"'));
      assert(button.includes('aria-expanded="false"'));
      assert(button.includes('aria-controls="' + panel + '"'));
      assert(sources.html.includes('id="' + panel + '" hidden'));
    }
    assert(!sources.html.includes('id="full-rules-toggle"'));
    assert(!sources.html.includes('id="rules-image"'));
    assert(!sources.html.includes('id="open-additional-rules"'));
    assert(!sources.html.includes('id="additional-rules-dialog"'));
    assert(sources.html.includes('id="full-rules-link" class="rules-page-link" href="./rules.html"'));
    assert(sources.tutorialCss.includes('.tutorial-viewport { position: relative; overflow: hidden;'));
    assert(sources.tutorialCss.includes("transform 400ms"));
    assert(sources.tutorialCss.includes("prefers-reduced-motion: reduce"));
    assert(sources.tutorialCss.includes("backface-visibility: hidden"));
    const preview = sources.html.match(/id="tutorial-receipt"[\s\S]*?<\/dl>/)?.[0];
    assert(preview.includes('src="./assets/receipt.png"'));
    for (const source of [sources.tutorial, sources.tutorialScenes]) {
      assert(!/Math\.random|localStorage|initializeApp|initializeDigitalDice|initializeReceipt/.test(source));
      assert(!/Prime Ice|prime number|Primzahl|challenger|defender/i.test(source));
    }
  });

  return results;
}
