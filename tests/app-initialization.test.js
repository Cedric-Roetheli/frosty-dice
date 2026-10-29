import { initializeApp } from "../js/app.js";
import { createGameState, freezeGameCell, placeGameNumber, unfreezeGameCell } from "../js/game.js";
import { SAVE_VERSION, STORAGE_KEY, loadGame, serializeGame } from "../js/storage.js";
import { boardFixture } from "./fixtures.js";
import { assert, assertDeepEqual, assertEqual } from "./assert.js";

// Only the DOM operations used by the coordinator; no browser or layout engine.
class AppTestElement {
  constructor(tag, document) {
    this.tagName = tag.toLowerCase();
    this.document = document;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.className = "";
    this.value = "";
    this.hidden = false;
    this.disabled = false;
    this.open = false;
    this.text = "";
    this.style = { setProperty(name, value) { this[name] = value; } };
  }
  get textContent() { return this.text + this.children.map((child) => child.textContent).join(""); }
  set textContent(value) { this.replaceChildren(); this.text = String(value); }
  get classList() {
    return { add: (...names) => { this.className = [...new Set([...this.className.split(" ").filter(Boolean), ...names])].join(" "); } };
  }
  append(...nodes) {
    for (const node of nodes) {
      if (node.tagName === "#fragment") { this.append(...[...node.children]); continue; }
      if (node.parentNode) node.parentNode.children = node.parentNode.children.filter((child) => child !== node);
      node.parentNode = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes) {
    this.children.forEach((child) => { child.parentNode = null; });
    this.children = [];
    this.text = "";
    this.append(...nodes);
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  getAttribute(name) {
    if (name.startsWith("data-")) return this.dataset[name.slice(5)] ?? null;
    return this.attributes[name] ?? null;
  }
  descendants() { return this.children.flatMap((child) => [child, ...child.descendants()]); }
  matches(selector) {
    if (selector.startsWith("#")) return this.id === selector.slice(1);
    const match = /^([a-z]+)(?:\[([a-z-]+)(?:=['"]([^'"]+)['"])?\])?$/.exec(selector);
    if (!match || this.tagName !== match[1]) return false;
    return !match[2] || (this.getAttribute(match[2]) !== null && (!match[3] || this.getAttribute(match[2]) === match[3]));
  }
  querySelectorAll(selector) { return this.descendants().filter((node) => node.matches(selector)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) ?? null; }
  addEventListener(type, handler) { (this.listeners[type] ??= []).push(handler); }
  showModal() { this.open = true; }
  close() { this.open = false; }
  emit(type, target = this, properties = {}) {
    const event = { target, ...properties, preventDefault() { this.defaultPrevented = true; } };
    for (const handler of this.listeners[type] ?? []) handler(event);
    return event;
  }
  focus(options) {
    const previous = this.document.activeElement;
    this.document.activeElement = this;
    this.lastFocusOptions = options;
    if (previous && previous !== this) previous.emit("blur", previous, { relatedTarget: this });
  }
}

export function appTestDocument() {
  let nextTimer = 0;
  const pendingTimers = new Map();
  const document = {
    defaultView: {
      setTimeout(callback, delay) { pendingTimers.set(++nextTimer, { callback, delay }); return nextTimer; },
      clearTimeout(id) { pendingTimers.delete(id); },
    },
    runTimers() {
      const callbacks = [...pendingTimers.values()];
      pendingTimers.clear();
      callbacks.forEach(({ callback }) => callback());
    },
    listeners: {},
    createElement(tag) { return new AppTestElement(tag, this); },
    createDocumentFragment() { return this.createElement("#fragment"); },
    getElementById(id) { return this.root.descendants().find((node) => node.id === id) ?? null; },
    addEventListener(type, handler) { (this.listeners[type] ??= []).push(handler); },
    emit(type, target = this.root, properties = {}) {
      const event = { target, ...properties, preventDefault() { this.defaultPrevented = true; } };
      for (const handler of this.listeners[type] ?? []) handler(event);
      return event;
    },
  };
  document.root = document.createElement("#root");
  function add(tag, id, parent = document.root) {
    const node = document.createElement(tag);
    node.id = id;
    parent.append(node);
    return node;
  }
  const messageArea = document.createElement("div");
  messageArea.className = "board-message";
  document.root.append(messageArea);
  add("p", "app-status", messageArea).className = "app-status";
  const board = add("table", "game-board");
  add("thead", "board-columns", board).className = "visually-hidden";
  add("tbody", "board-rows", board);
  for (const [tag, id] of [
    ["p", "storage-status"], ["strong", "current-score"],
    ["p", "street-bonus"], ["p", "goal-status"], ["button", "new-game"],
  ]) add(tag, id);
  const actions = add("div", "attack-ice-actions");
  const actionLabel = add("p", "attack-ice-label", actions);
  add("span", "attack-ice-cell", actionLabel);
  add("button", "toggle-attack-ice", actions);
  add("button", "cancel-attack-ice", actions);
  const undo = add("button", "undo-move");
  undo.setAttribute("aria-label", "Undo last move");
  undo.setAttribute("title", "Undo last move");
  const icon = document.createElement("span");
  icon.textContent = "↶";
  icon.setAttribute("aria-hidden", "true");
  undo.append(icon);
  const confirmation = add("div", "reset-confirmation");
  add("button", "cancel-new-game", confirmation);
  add("button", "confirm-new-game", confirmation);
  add("button", "open-challenge");
  const challenge = add("dialog", "challenge-dialog");
  const bidForm = add("form", "challenge-form", challenge);
  const note = add("div", "challenge-banknote", bidForm);
  const shake = add("div", "challenge-note-shake", note);
  const rotor = add("div", "challenge-note-rotor", shake);
  const bidFace = add("div", "challenge-bid-face", rotor);
  add("img", "challenge-bid-art", bidFace).src = "./assets/bid.png";
  add("input", "challenge-bid", bidFace).type = "number";
  const cover = add("button", "reveal-bid", rotor);
  cover.type = "button";
  add("img", "challenge-cover-art", cover).src = "./assets/bid_front.png";
  add("p", "bid-limit", bidForm);
  add("p", "bid-feedback", bidForm);
  add("button", "confirm-bid", bidForm);
  add("button", "close-challenge", bidForm);
  document.getElementById("app-status").textContent = "Loading board…";
  return document;
}

export function appTestStorage(serialized = null) {
  const values = new Map();
  if (serialized !== null) values.set(STORAGE_KEY, serialized);
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

function startAppTest(serialized = null) {
  const document = appTestDocument();
  const storage = appTestStorage(serialized);
  initializeApp(document, storage);
  return { document, storage };
}

function finishNoteFlip(document) {
  const rotor = document.getElementById("challenge-note-rotor");
  rotor.emit("transitionend", rotor, { propertyName: "transform" });
}

function finishNoteShake(document) {
  const shake = document.getElementById("challenge-note-shake");
  shake.emit("animationend", shake, { animationName: "frosty-dollar-shake" });
}

function startNoteTest({ reducedMotion = false, language = "en", largeBalance = false } = {}) {
  const document = appTestDocument();
  const listeners = [];
  const motion = { matches: reducedMotion, addEventListener(type, callback) {
    assertEqual(type, "change");
    listeners.push(callback);
  } };
  document.defaultView.matchMedia = (query) => {
    assertEqual(query, "(prefers-reduced-motion: reduce)");
    return motion;
  };
  const rulesImage = document.createElement("img");
  rulesImage.id = "rules-image";
  rulesImage.lang = language;
  document.root.append(rulesImage);
  const board = largeBalance
    ? boardFixture(...Array.from({ length: 7 }, (_, row) => [21, 22, 33, 44].map((value, column) => ["ABCD"[column] + (row + 1), value])).flat())
    : boardFixture(["A1", 23], ["B1", 24]);
  const storage = appTestStorage(serializeGame({ board, undo: null }));
  storage.setItem("frosty-dice.rules-language", language);
  let writes = 0;
  const save = storage.setItem;
  storage.setItem = (key, value) => { writes += 1; save(key, value); };
  initializeApp(document, storage);
  document.getElementById("open-challenge").emit("click");
  return {
    document, storage,
    get writes() { return writes; },
    changeMotion(value) { motion.matches = value; listeners.forEach((callback) => callback({ matches: value })); },
  };
}

function confirmNote(document, amount = 12) {
  document.getElementById("challenge-bid").value = String(amount);
  document.getElementById("challenge-form").emit("submit");
}

function assertCoveredNote(document) {
  const input = document.getElementById("challenge-bid");
  const face = document.getElementById("challenge-bid-face");
  const cover = document.getElementById("reveal-bid");
  assertEqual(document.getElementById("challenge-banknote").dataset.phase, "hidden");
  assertEqual(face.hidden, true);
  assertEqual(face.inert, true);
  assertEqual(face.getAttribute("aria-hidden"), "true");
  assertEqual(input.readOnly, true);
  assertEqual(input.disabled, true);
  assertEqual(input.tabIndex, -1);
  assertEqual(cover.hidden, false);
  assertEqual(cover.disabled, false);
  assertEqual(cover.type, "button");
  assertEqual(cover.querySelector("img").src, "./assets/bid_front.png");
  assertEqual(cover.querySelector("input"), null);
  assertEqual(document.getElementById("bid-limit").textContent, "");
}

function assertAppBoardReady(document) {
  assertEqual(document.getElementById("board-rows").children.length, 7);
  assertEqual(document.getElementById("board-rows").querySelectorAll("button[data-coordinate]").length, 28);
  assert(document.getElementById("app-status").textContent !== "Loading board…");
}

function assertFrozenCell(cell) {
  assertEqual(cell.dataset.state, "frozen");
  assert(cell.className.split(" ").includes("board-cell--frozen"));
  const ice = cell.querySelector("img");
  assert(ice !== null, "A currently frozen cell must show the ice cube");
  assertEqual(ice.src, "./assets/icecube.png");
  assertEqual(ice.alt, "");
  assertEqual(ice.width, 48);
  assertEqual(ice.height, 48);
  assertEqual(ice.getAttribute("aria-hidden"), "true");
  assert(cell.getAttribute("aria-label").includes("frozen"));
}

function assertGoalFlag(cell) {
  assertEqual(cell.dataset.coordinate, "D7");
  assertEqual(cell.dataset.state, "empty");
  assertEqual(cell.textContent, "");
  const flag = cell.querySelector("img");
  assert(flag !== null, "Empty D7 must show its flag");
  assertEqual(flag.className, "board-cell__flag");
  assertEqual(flag.src, "./assets/d7_flag.png");
  assertEqual(flag.alt, "");
  assertEqual(flag.width, 48);
  assertEqual(flag.height, 48);
  assertEqual(flag.getAttribute("aria-hidden"), "true");
  assert(cell.getAttribute("aria-label").includes("goal, empty"));
}

function assertNoGoalFlag(cell) {
  assert(cell.querySelectorAll("img").every((image) => image.className !== "board-cell__flag"));
}

function countBoardIceImages(document) {
  return document.getElementById("board-rows").querySelectorAll("img")
    .filter((image) => image.className === "board-cell__ice").length;
}

function getAppInput(document) {
  return document.getElementById("board-rows").querySelector("input[data-coordinate]");
}

function selectAppCell(document, coordinate) {
  const cell = document.getElementById("cell-" + coordinate);
  if (cell.tagName === "button" && !cell.disabled) cell.focus();
  document.getElementById("board-rows").emit("click", cell.querySelector("span") ?? cell);
}

function typeAppNumber(document, value) {
  const input = getAppInput(document);
  input.value = String(value);
  return input.emit("input");
}

function submitAppNumber(document, coordinate, value) {
  selectAppCell(document, coordinate);
  return typeAppNumber(document, value);
}

function assertNoMoveHints(document) {
  for (const cell of document.getElementById("board-rows").querySelectorAll("button")) {
    assert(!cell.className.includes("--legal"));
    assert(!cell.getAttribute("aria-label").includes("legal target"));
  }
  assertEqual(document.getElementById("board-rows").querySelectorAll("button[data-number]").length, 0);
}

function assertAppMultiplier(document, coordinate, expected) {
  const cell = document.getElementById("cell-" + coordinate);
  const markers = cell.querySelectorAll("span").filter((span) => span.className === "street-marker");
  assertEqual(markers.length, expected === null ? 0 : 1);
  if (expected !== null) {
    assertEqual(markers[0].textContent, expected);
    assertEqual(markers[0].getAttribute("aria-hidden"), "true");
    assert(cell.getAttribute("aria-label").includes("scores " + expected[0] + " times its value"));
  }
}

function applyAppAttackAction(document, coordinate) {
  const cell = document.getElementById("cell-" + coordinate);
  document.emit("pointerdown", cell.querySelector("span") ?? cell);
  selectAppCell(document, coordinate);
  const action = document.getElementById("toggle-attack-ice");
  document.emit("pointerdown", action);
  action.emit("click");
}

function assertAttackCell(cell, status = "normal") {
  assertEqual(cell.dataset.state, status);
  assertEqual(cell.dataset.attackIce, "true");
  assert(cell.className.includes("board-cell--attack-iced"));
  assertEqual(cell.disabled, false);
  const ice = cell.querySelector("img");
  assert(ice !== null);
  assertEqual(ice.src, "./assets/icecube2.png");
  assertEqual(ice.width, 48);
  assertEqual(ice.height, 48);
  assertEqual(ice.alt, "");
  assertEqual(ice.getAttribute("aria-hidden"), "true");
  assert(cell.getAttribute("aria-label").includes("Attack Ice"));
  assert(cell.getAttribute("aria-label").includes("cannot support placement"));
  assertEqual(cell.querySelectorAll("span").at(-1).textContent,
    String(cell.getAttribute("aria-label").split(", ").find((label) => /^[1-6]{2}$/.test(label))));
}

export function runAppInitializationTests() {
  const results = [];
  function test(name, action) {
    try { action(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, message: error.message }); }
  }

  test("Initialization needs no roll, external-number, Schnapszahl, or removal controls", () => {
    const { document, storage } = startAppTest();
    assertAppBoardReady(document);
    for (const id of ["own-roll-form", "next-roll", "take-failed-roll", "own-roll-count",
      "external-number-form", "number-options", "schnapszahl-panel", "removal-panel"]) {
      assertEqual(document.getElementById(id), null);
    }
    assertEqual(document.getElementById("current-score").textContent, "0");
    assertEqual(getAppInput(document), null);
    for (const id of ["number-entry-form", "number-input", "cancel-entry", "selected-cell"]) {
      assertEqual(document.getElementById(id), null);
    }
    assertEqual(storage.getItem(STORAGE_KEY), null);
    for (const cell of document.getElementById("board-rows").querySelectorAll("button")) {
      assertEqual(cell.disabled, false);
      assertEqual(cell.getAttribute("aria-pressed"), "false");
      assertEqual(cell.textContent, cell.dataset.coordinate === "A1" ? "Start" : "");
      if (cell.dataset.coordinate === "D7") assertGoalFlag(cell);
      else assertNoGoalFlag(cell);
      if (cell.dataset.coordinate === "A1") {
        assertEqual(cell.querySelector("span").className, "board-cell__hint");
        assertEqual(cell.querySelector("span").getAttribute("aria-hidden"), "true");
      }
      assert(cell.getAttribute("aria-label").includes(cell.dataset.coordinate));
    }
    const headers = document.getElementById("board-columns").querySelectorAll("th");
    assertDeepEqual(headers.map((heading) => heading.textContent), ["A", "B", "C", "D"]);
    assertEqual(document.getElementById("board-columns").className, "visually-hidden");
    assertEqual(document.getElementById("board-columns").children[0].children.length, 4);
    assertEqual(document.getElementById("board-rows").querySelectorAll("th").length, 0);
    for (const [index, column] of ["A", "B", "C", "D"].entries()) {
      assertEqual(headers[index].scope, "col");
      assertEqual(headers[index].getAttribute("aria-label"), "Column " + column);
      for (let row = 1; row <= 7; row += 1) {
        const cells = document.getElementById("board-rows").children[row - 1].children;
        assertEqual(cells.length, 4);
        assertEqual(cells[index].querySelector("button").dataset.coordinate, column + row);
      }
    }
    assertNoMoveHints(document);
  });

  test("Selecting columns without visible labels still submits and stores A/B/C/D coordinates", () => {
    const { document, storage } = startAppTest();
    const expectedValues = [16, 24, 36, 46];
    for (const [index, column] of ["A", "B", "C", "D"].entries()) {
      const button = document.getElementById("board-rows").children[0].children[index].querySelector("button");
      document.getElementById("board-rows").emit("click", button);
      assertEqual((getAppInput(document)?.dataset.coordinate ?? ""), column + "1");
      typeAppNumber(document, expectedValues[index]);
      assertDeepEqual(loadGame(storage).state.board[0][index], { value: expectedValues[index], status: "normal" });
    }
    assertEqual(document.getElementById("current-score").textContent, "122");
    const goal = document.getElementById("board-rows").children[6].children[3].querySelector("button");
    document.getElementById("board-rows").emit("click", goal);
    assertEqual((getAppInput(document)?.dataset.coordinate ?? ""), "D7");
    assert(goal.getAttribute("aria-label").startsWith("D7,"));
    assertDeepEqual(Object.keys(JSON.parse(storage.getItem(STORAGE_KEY)).state), ["board", "undo"]);
  });

  test("Contextual messages keep their above-board wrapper through errors, actions, and Undo", () => {
    const { document } = startAppTest();
    const status = document.getElementById("app-status");
    const area = status.parentNode;
    assertEqual(area.className, "board-message");
    assert(document.root.children.indexOf(area) < document.root.children.indexOf(document.getElementById("game-board")));
    assertEqual(status.textContent, "Tap an empty cell to enter a number.");
    submitAppNumber(document, "D7", 24);
    assertEqual(status.textContent, "Place your first number at A1.");
    assertEqual(status.hidden, false);
    assertEqual(document.getElementById("entry-feedback"), null);
    assertEqual(status.parentNode, area);
    document.runTimers();
    assertEqual(status.textContent, "Place your first number at A1.");
    submitAppNumber(document, "A1", 22);
    assert(status.textContent.includes("Placed 22 at A1."));
    selectAppCell(document, "A1");
    assertEqual(status.hidden, true);
    assertEqual(area.hidden, false);
    document.getElementById("cancel-attack-ice").emit("click");
    assertEqual(status.hidden, false);
    document.getElementById("undo-move").emit("click");
    assertEqual(status.textContent, "Last move undone.");
    assertEqual(status.parentNode, area);
    assertEqual(area.hidden, false);
  });

  test("Only A1 and D7 retain endpoint styling hooks while empty, entering, occupied, or iced", () => {
    function check(document) {
      for (const column of ["A", "B", "C", "D"]) {
        for (let row = 1; row <= 7; row += 1) {
          const coordinate = column + row;
          const classes = document.getElementById("cell-" + coordinate).className.split(" ");
          assertEqual(classes.includes("board-cell--start"), coordinate === "A1");
          assertEqual(classes.includes("board-cell--goal"), coordinate === "D7");
        }
      }
    }
    const boards = [
      createGameState().board,
      boardFixture(["A1", 16], ["D7", 66]),
      boardFixture(["A1", 16], ["D7", 31, "frozen"]),
      boardFixture(["A1", 16], ["D7", 31, "thawed"]),
    ];
    for (const [row, column] of [[0, 0], [6, 3]]) {
      const board = boardFixture(["A1", 22], ["D7", 66]);
      board[row][column].attackIce = true;
      boards.push(board);
    }
    for (const board of boards) {
      const { document } = startAppTest(serializeGame({ board, undo: null }));
      check(document);
    }
    const { document } = startAppTest();
    for (const coordinate of ["A1", "D7"]) {
      selectAppCell(document, coordinate);
      assertEqual(getAppInput(document).dataset.coordinate, coordinate);
      check(document);
      document.emit("keydown", document.root, { key: "Escape" });
      check(document);
    }
    assertGoalFlag(document.getElementById("cell-D7"));
  });

  test("Selecting any empty cell opens numeric entry and focuses it without validating the move", () => {
    const { document, storage } = startAppTest();
    selectAppCell(document, "D7"); // Selection and a first digit reveal no placement legality.
    const selected = document.getElementById("cell-D7");
    assertEqual(selected, getAppInput(document));
    assertEqual(selected.tagName, "input");
    assert(selected.className.includes("board-cell--selected"));
    assertEqual(selected.textContent, "");
    assertEqual(selected.getAttribute("aria-label"), "Number for D7");
    assertEqual(selected.getAttribute("inputmode"), "numeric");
    assertEqual(selected.getAttribute("enterkeyhint"), "done");
    assertEqual(selected.getAttribute("aria-describedby"), "number-help app-status");
    assertEqual(document.activeElement, selected);
    assertDeepEqual(selected.lastFocusOptions, { preventScroll: true });
    typeAppNumber(document, "1");
    assertEqual(selected.value, "1");
    assertEqual(document.getElementById("app-status").textContent, "Tap an empty cell to enter a number.");
    assertEqual(storage.getItem(STORAGE_KEY), null);
    assertEqual(document.getElementById("undo-move").disabled, true);
    assertEqual(document.getElementById("board-rows").querySelectorAll("button").length, 27);
    assertNoMoveHints(document);
  });

  test("The second digit automatically places, saves, updates score, and closes entry", () => {
    const { document, storage } = startAppTest();
    selectAppCell(document, "A1");
    typeAppNumber(document, "1");
    assertEqual(storage.getItem(STORAGE_KEY), null);
    typeAppNumber(document, "16"); // No submit event or extra control.
    assertDeepEqual(loadGame(storage).state, { board: boardFixture(["A1", 16]), undo: { board: boardFixture() } });
    assertDeepEqual(Object.keys(JSON.parse(storage.getItem(STORAGE_KEY)).state), ["board", "undo"]);
    assertEqual(document.getElementById("current-score").textContent, "16");
    assertEqual(document.getElementById("cell-A1").textContent, "16");
    assertEqual(document.getElementById("cell-A1").tagName, "button");
    assertEqual(getAppInput(document), null);
    assertEqual(document.activeElement, document.getElementById("game-board"));
    assertDeepEqual(document.activeElement.lastFocusOptions, { preventScroll: true });
  });

  test("Repeated-digit numbers use ordinary entry without roll counts or special actions", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 33);
    assertDeepEqual(JSON.parse(storage.getItem(STORAGE_KEY)).state, { board: boardFixture(["A1", 33]), undo: { board: boardFixture() } });
    assertEqual(document.getElementById("current-score").textContent, "66");
    assertEqual(getAppInput(document), null);
    assertEqual(document.getElementById("schnapszahl-panel"), null);
  });

  test("An illegal first placement restores the empty cell and displays its concise reason", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "B1", 16);
    assertEqual(storage.getItem(STORAGE_KEY), null);
    assertEqual(document.getElementById("cell-B1").dataset.state, "empty");
    assertEqual(document.getElementById("cell-B1").tagName, "button");
    assertEqual(document.getElementById("cell-B1").textContent, "");
    assertEqual(document.getElementById("current-score").textContent, "0");
    assertEqual(getAppInput(document), null);
    assertEqual(document.getElementById("app-status").textContent, "Place your first number at A1.");
    assertEqual(document.getElementById("app-status").hidden, false);
    assertEqual(document.getElementById("entry-feedback"), null);
    assertEqual(document.activeElement, document.getElementById("game-board"));
    assertNoMoveHints(document);
  });

  test("A rejected horizontal value can be retried by tapping the restored empty cell", () => {
    const serialized = serializeGame({ board: boardFixture(["A1", 16]) });
    const { document, storage } = startAppTest(serialized);
    submitAppNumber(document, "B1", 12);
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
    assertEqual(document.getElementById("app-status").textContent, "Must be greater than 16 to the left.");
    assertEqual(getAppInput(document), null);
    selectAppCell(document, "B1");
    assertEqual(document.getElementById("entry-feedback"), null);
    assertEqual(getAppInput(document).value, "");
    typeAppNumber(document, 24);
    assertDeepEqual(loadGame(storage).state.board[0][1], { value: 24, status: "normal" });
    assertEqual(document.getElementById("current-score").textContent, "40");
  });

  for (const [neighbor, existing, target, attempted, message] of [
    ["B1", 24, "A1", 26, "Must be smaller than 24 to the right."],
    ["A1", 16, "A2", 24, "Must match 16 above."],
    ["A2", 22, "A1", 24, "Must match 22 below."],
  ]) {
    test("Rejected placement explains the sole usable relationship at " + target + " via " + neighbor, () => {
      const serialized = serializeGame({ board: boardFixture([neighbor, existing]) });
      const { document, storage } = startAppTest(serialized);
      submitAppNumber(document, target, attempted);
      assertEqual(storage.getItem(STORAGE_KEY), serialized);
      assertEqual(document.getElementById("app-status").textContent, message);
      assertEqual(getAppInput(document), null);
      assertEqual(document.getElementById("cell-" + target).dataset.state, "empty");
    });
  }

  test("Conflicting neighbors produce a general error, and either valid connection still suffices", () => {
    const serialized = serializeGame({ board: boardFixture(["A1", 16], ["B1", 24], ["A2", 16]) });
    const { document, storage } = startAppTest(serialized);
    submitAppNumber(document, "B2", 12);
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
    assertEqual(document.getElementById("app-status").textContent, "This number doesn't fit next to any usable neighboring number.");
    submitAppNumber(document, "B2", 26); // Horizontal connection succeeds, vertical connection disagrees.
    assertDeepEqual(loadGame(storage).state.board[1][1], { value: 26, status: "normal" });
    assertEqual(document.getElementById("current-score").textContent, "82");
  });

  test("A cell without a usable neighbor is rejected only after submission", () => {
    const serialized = serializeGame({ board: boardFixture(["A1", 16]) });
    const { document, storage } = startAppTest(serialized);
    selectAppCell(document, "D7");
    assertEqual(document.getElementById("app-status").textContent, "Tap an empty cell to enter a number.");
    typeAppNumber(document, 16);
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
    assertEqual(document.getElementById("app-status").textContent, "This number doesn't fit next to any usable neighboring number.");
  });

  test("Invalid dice numbers never change the board or save", () => {
    const { document, storage } = startAppTest();
    for (const value of ["7", "8", "9", "10", "17", "28", "60", "70", "123", "0", "word", " 16", "1.6", "16 "]) {
      submitAppNumber(document, "A1", value);
      assertEqual(storage.getItem(STORAGE_KEY), null);
      assertEqual(document.getElementById("cell-A1").dataset.state, "empty");
      assertEqual(document.getElementById("cell-A1").textContent, "Start");
      assertEqual(getAppInput(document), null);
      assertEqual(document.getElementById("app-status").textContent, "Use two digits from 1–6.");
      assertEqual(document.getElementById("current-score").textContent, "0");
      assertEqual(document.getElementById("undo-move").disabled, true);
    }
  });

  for (const status of ["normal", "frozen", "thawed"]) {
    test("An occupied " + status + " cell cannot open number entry or be overwritten", () => {
      const serialized = serializeGame({ board: boardFixture(["A1", 16], ["B1", 31, status]) });
      const { document, storage } = startAppTest(serialized);
      const occupied = document.getElementById("cell-B1");
      assertEqual(occupied.disabled, status === "frozen");
      occupied.disabled = false; // Also guard a stale or modified button.
      selectAppCell(document, "B1");
      assertEqual(getAppInput(document), null);
      assertEqual(document.getElementById("attack-ice-actions").hidden, status === "frozen");
      if (status !== "frozen") assertEqual(document.getElementById("toggle-attack-ice").textContent, "Freeze");
      assertEqual(document.getElementById("cell-actions"), null);
      assertEqual(document.getElementById("edit-cell"), null);
      assertEqual(storage.getItem(STORAGE_KEY), serialized);
    });
  }

  test("Repeated input events and stale former-empty controls cannot place twice", () => {
    const { document, storage } = startAppTest();
    const oldButton = document.getElementById("cell-A1");
    selectAppCell(document, "A1");
    const oldInput = getAppInput(document);
    typeAppNumber(document, 16);
    const serialized = storage.getItem(STORAGE_KEY);
    oldInput.emit("input");
    oldInput.emit("compositionend");
    oldInput.emit("keydown", oldInput, { key: "Enter" });
    document.getElementById("board-rows").emit("click", oldButton);
    assertEqual(getAppInput(document), null);
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
  });

  test("Selecting another empty cell discards the old draft and selection", () => {
    const { document, storage } = startAppTest();
    selectAppCell(document, "B1");
    typeAppNumber(document, "1");
    selectAppCell(document, "A1"); // Native focus blurs the old input before the click.
    assertEqual(document.getElementById("cell-B1").getAttribute("aria-pressed"), "false");
    assertEqual(getAppInput(document).id, "cell-A1");
    assertEqual(getAppInput(document).value, "");
    assertEqual(document.getElementById("app-status").textContent, "Tap an empty cell to enter a number.");
    assertEqual(storage.getItem(STORAGE_KEY), null);
  });

  test("Tapping the selected cell again keeps its draft without attempting placement", () => {
    const { document, storage } = startAppTest();
    selectAppCell(document, "A1");
    typeAppNumber(document, "1");
    selectAppCell(document, "A1");
    assertEqual(getAppInput(document).value, "1");
    assertEqual(document.activeElement, getAppInput(document));
    assertDeepEqual(document.activeElement.lastFocusOptions, { preventScroll: true });
    assertEqual((getAppInput(document)?.dataset.coordinate ?? ""), "A1");
    assertEqual(document.getElementById("app-status").textContent, "Tap an empty cell to enter a number.");
    assertEqual(storage.getItem(STORAGE_KEY), null);
  });

  for (const cancelWith of ["blur", "outside tap", "Escape", "occupied-cell tap"]) {
    test(cancelWith + " safely cancels a draft without changing the board or freeze", () => {
      const serialized = serializeGame({ board: boardFixture(["A1", 23], ["B1", 31, "frozen"]) });
      const { document, storage } = startAppTest(serialized);
      selectAppCell(document, "A2");
      typeAppNumber(document, "2");
      if (cancelWith === "blur") document.getElementById("game-board").focus();
      else if (cancelWith === "Escape") document.emit("keydown", document.root, { key: "Escape" });
      else document.emit("pointerdown", cancelWith === "outside tap" ? document.root : document.getElementById("cell-B1"));
      if (cancelWith === "Escape") {
        assertEqual(document.activeElement, document.getElementById("cell-A2"));
        assertDeepEqual(document.activeElement.lastFocusOptions, { preventScroll: true });
      }
      assertEqual(getAppInput(document), null);
      assertEqual(document.getElementById("cell-A2").getAttribute("aria-pressed"), "false");
      assertFrozenCell(document.getElementById("cell-B1"));
      assertEqual(storage.getItem(STORAGE_KEY), serialized);
    });
  }

  test("Tapping inside entry keeps the draft; tapping another empty cell can select it", () => {
    const { document, storage } = startAppTest();
    selectAppCell(document, "A1");
    typeAppNumber(document, "1");
    document.emit("pointerdown", getAppInput(document));
    assertEqual(getAppInput(document).value, "1");
    assert(getAppInput(document) !== null);
    document.emit("pointerdown", document.getElementById("cell-B1"));
    selectAppCell(document, "B1");
    assertEqual((getAppInput(document)?.dataset.coordinate ?? ""), "B1");
    assertEqual(storage.getItem(STORAGE_KEY), null);
  });

  test("Cell-first input → save → render → restore moves the freeze for A1=23, B1=31, A2=23", () => {
    const { document, storage } = startAppTest();
    const expectedStages = [
      [["A1", 23]],
      [["A1", 23], ["B1", 31, "frozen"]],
      [["A1", 23], ["B1", 31, "thawed"], ["A2", 23, "frozen"]],
      [["A1", 23], ["B1", 31, "thawed"], ["A2", 23, "frozen"], ["C1", 46]],
    ];
    function verifyRenderedState(currentDocument, entries, score) {
      assertAppBoardReady(currentDocument);
      assertEqual(currentDocument.getElementById("current-score").textContent, String(score));
      assertEqual(countBoardIceImages(currentDocument),
        entries.filter((entry) => entry[2] === "frozen").length);
      for (const [coordinate, value, status = "normal"] of entries) {
        const cell = currentDocument.getElementById("cell-" + coordinate);
        assertEqual(cell.dataset.state, status);
        assertEqual(cell.dataset.frozen, String(status === "frozen"));
        assertEqual(cell.querySelectorAll("span").at(-1).textContent, String(value));
        assertEqual(cell.disabled, status === "frozen");
        if (status === "frozen") assertFrozenCell(cell);
        else assertEqual(cell.querySelector("img"), null);
        if (status === "thawed") {
          assert(cell.textContent.includes("Thawed"));
          assert(cell.getAttribute("aria-label").includes("usable placement neighbor"));
        }
      }
    }
    for (const [index, [coordinate, value]] of [["A1", 23], ["B1", 31], ["A2", 23], ["C1", 46]].entries()) {
      const before = storage.getItem(STORAGE_KEY);
      selectAppCell(document, coordinate);
      typeAppNumber(document, String(value)[0]);
      assert(storage.getItem(STORAGE_KEY) === before, "Selection and first digits must not save or change statuses");
      typeAppNumber(document, value);
      const entries = expectedStages[index];
      const expected = {
        board: boardFixture(...entries),
        undo: { board: boardFixture(...(expectedStages[index - 1] ?? [])) },
      };
      const serialized = storage.getItem(STORAGE_KEY);
      assertDeepEqual(JSON.parse(serialized), { version: SAVE_VERSION, state: expected });
      assertDeepEqual(loadGame(storage).state, expected);
      const score = index === 3 ? 69 : 23;
      verifyRenderedState(document, entries, score);
      document.getElementById("new-game").emit("click");
      document.getElementById("cancel-new-game").emit("click");
      verifyRenderedState(document, entries, score);
      assertEqual(storage.getItem(STORAGE_KEY), serialized);
      const reloadedDocument = appTestDocument();
      const reloadedStorage = appTestStorage(serialized);
      initializeApp(reloadedDocument, reloadedStorage);
      verifyRenderedState(reloadedDocument, entries, score);
      assertEqual(reloadedStorage.getItem(STORAGE_KEY), serialized);
      assertEqual(storage.getItem(STORAGE_KEY), serialized);
      if (index === 2) {
        submitAppNumber(reloadedDocument, "C1", 46); // B1 is the only placement neighbor.
        assertDeepEqual(loadGame(reloadedStorage).state.board[0][2], { value: 46, status: "normal" });
        assertEqual(reloadedDocument.getElementById("current-score").textContent, "69");
        assertEqual(storage.getItem(STORAGE_KEY), serialized);
      }
    }
  });

  test("An illegal placement cannot thaw the existing freeze", () => {
    const serialized = serializeGame({ board: boardFixture(["A1", 23], ["B1", 31, "frozen"]) });
    const { document, storage } = startAppTest(serialized);
    submitAppNumber(document, "C1", 41); // The frozen B1 cannot support the move.
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
    assertFrozenCell(document.getElementById("cell-B1"));
    assertEqual(document.getElementById("cell-C1").dataset.state, "empty");
    assertEqual(getAppInput(document), null);
  });

  test("Restored statuses preserve values, permanent zero points, and Street/goal displays", () => {
    const serialized = serializeGame({ board: boardFixture(
      ["A1", 11], ["B1", 12], ["C1", 13], ["D1", 14], ["B3", 31, "thawed"], ["C3", 41, "frozen"], ["D7", 46],
    ) });
    const { document, storage } = startAppTest(serialized);
    assertAppBoardReady(document);
    assertFrozenCell(document.getElementById("cell-C3"));
    const thawed = document.getElementById("cell-B3");
    assert(thawed.textContent.includes("31") && thawed.textContent.includes("Thawed"));
    assertEqual(thawed.querySelector("img"), null);
    assert(thawed.getAttribute("aria-label").includes("permanently 0 points"));
    assertEqual(document.getElementById("current-score").textContent, "168");
    assertEqual(document.getElementById("goal-status").hidden, false);
    assertEqual(document.getElementById("street-bonus").hidden, false);
    assert(document.getElementById("board-rows").children[0].className.includes("street"));
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
  });

  test("Completing a Street updates the score and row marker through the input flow", () => {
    const { document, storage } = startAppTest();
    for (const [coordinate, value, score] of [["A1", 11, 22], ["B1", 12, 34], ["C1", 13, 47], ["D1", 14, 122]]) {
      submitAppNumber(document, coordinate, value);
      assertEqual(document.getElementById("current-score").textContent, String(score));
    }
    assertEqual(document.getElementById("street-bonus").hidden, false);
    assert(document.getElementById("board-rows").children[0].className.includes("street"));
    assertEqual(document.getElementById("board-rows").children[0].children.length, 4);
    const lastCell = document.getElementById("cell-D1");
    const marker = lastCell.querySelectorAll("span").find((span) => span.className === "street-marker");
    assert(marker !== undefined);
    assertEqual(marker.textContent, "2x");
    assertEqual(marker.getAttribute("aria-hidden"), "true");
    assert(lastCell.getAttribute("aria-label").includes("Street, row value doubled"));
    assertEqual(lastCell.querySelectorAll("span").at(-1).textContent, "14");
    assertDeepEqual(loadGame(storage).state.board[0].map((cell) => cell.value), [11, 12, 13, 14]);
  });

  test("Normal repdigits use the existing corner marker while ordinary cells have none", () => {
    for (const [value, expectedMarker, expectedScore] of [[22, "2x", "44"], [66, "2x", "132"], [35, null, "35"]]) {
      const { document, storage } = startAppTest();
      submitAppNumber(document, "A1", value);
      assertAppMultiplier(document, "A1", expectedMarker);
      assertEqual(document.getElementById("current-score").textContent, expectedScore);
      assertEqual(document.getElementById("cell-A1").querySelectorAll("span").at(-1).textContent, String(value));
      assertDeepEqual(loadGame(storage).state.board[0][0], { value, status: "normal" });
    }
  });

  test("Street 22 uses one 4x marker, ordinary neighbors use 2x, and reload/Undo recompute them", () => {
    const { document, storage } = startAppTest();
    for (const [coordinate, value] of [["A1", 21], ["B1", 22], ["C1", 23], ["D1", 24]]) {
      submitAppNumber(document, coordinate, value);
    }
    assertEqual(document.getElementById("current-score").textContent, "224");
    for (const [coordinate, marker] of [["A1", "2x"], ["B1", "4x"], ["C1", "2x"], ["D1", "2x"]]) {
      assertAppMultiplier(document, coordinate, marker);
    }
    assertEqual(document.getElementById("cell-B1").querySelectorAll("span").at(-1).textContent, "22");
    const reloaded = startAppTest(storage.getItem(STORAGE_KEY));
    assertEqual(reloaded.document.getElementById("current-score").textContent, "224");
    assertAppMultiplier(reloaded.document, "B1", "4x");
    reloaded.document.getElementById("undo-move").emit("click");
    assertEqual(reloaded.document.getElementById("current-score").textContent, "88");
    assertAppMultiplier(reloaded.document, "B1", "2x");
    for (const coordinate of ["A1", "C1", "D1"]) assertAppMultiplier(reloaded.document, coordinate, null);
  });

  test("Ordinary 35 in a Street displays 2x and the row total includes exactly one 4x repdigit", () => {
    const { document } = startAppTest();
    for (const [coordinate, value] of [["A1", 33], ["B1", 34], ["C1", 35], ["D1", 36]]) {
      submitAppNumber(document, coordinate, value);
    }
    assertEqual(document.getElementById("current-score").textContent, "342");
    assertAppMultiplier(document, "A1", "4x");
    for (const coordinate of ["B1", "C1", "D1"]) assertAppMultiplier(document, coordinate, "2x");
  });

  test("Prime-frozen/thawed 11 never displays a scoring multiplier, including beneath Attack Ice", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 11);
    assertAppMultiplier(document, "A1", "2x");
    submitAppNumber(document, "A2", 11);
    assertFrozenCell(document.getElementById("cell-A2"));
    assertAppMultiplier(document, "A2", null);
    assertEqual(document.getElementById("current-score").textContent, "22");
    submitAppNumber(document, "B1", 13);
    assertEqual(document.getElementById("cell-A2").dataset.state, "thawed");
    assertAppMultiplier(document, "A2", null);
    assertAppMultiplier(document, "B1", null);
    applyAppAttackAction(document, "A2");
    assertAttackCell(document.getElementById("cell-A2"), "thawed");
    assertAppMultiplier(document, "A2", null);
    assertEqual(document.getElementById("current-score").textContent, "22");
    const reloaded = startAppTest(storage.getItem(STORAGE_KEY));
    assertAppMultiplier(reloaded.document, "A2", null);
    assertAppMultiplier(reloaded.document, "B1", null);
  });

  test("Attack Ice reduces a Street repdigit to 2x and removes Street multipliers from its whole row", () => {
    const { document, storage } = startAppTest();
    for (const [coordinate, value] of [["A1", 21], ["B1", 22], ["C1", 23], ["D1", 24]]) {
      submitAppNumber(document, coordinate, value);
    }
    applyAppAttackAction(document, "B1");
    assertAttackCell(document.getElementById("cell-B1"));
    assertAppMultiplier(document, "B1", "2x");
    for (const coordinate of ["A1", "C1", "D1"]) assertAppMultiplier(document, coordinate, null);
    assertEqual(document.getElementById("current-score").textContent, "112");
    const reloaded = startAppTest(storage.getItem(STORAGE_KEY));
    assertAppMultiplier(reloaded.document, "B1", "2x");
    assertEqual(reloaded.document.getElementById("current-score").textContent, "112");
    applyAppAttackAction(reloaded.document, "B1");
    assertAppMultiplier(reloaded.document, "B1", "4x");
    assertEqual(reloaded.document.getElementById("current-score").textContent, "224");
    reloaded.document.getElementById("undo-move").emit("click");
    assertAppMultiplier(reloaded.document, "B1", "2x");
    assertEqual(reloaded.document.getElementById("current-score").textContent, "112");
  });

  test("A boundary Street with repdigit 55 renders, saves, and restores through Attack Ice and Undo", () => {
    const { document, storage } = startAppTest();
    for (const [coordinate, value, score] of [["A1", 55, "110"], ["B1", 56, "166"], ["C1", 61, "227"], ["D1", 62, "578"]]) {
      submitAppNumber(document, coordinate, value);
      assertEqual(document.getElementById("current-score").textContent, score);
    }
    assertEqual(document.getElementById("street-bonus").textContent, "Street bonus +289 · 1 Street");
    assert(document.getElementById("board-rows").children[0].className.includes("street"));
    const reloaded = startAppTest(storage.getItem(STORAGE_KEY));
    assertEqual(reloaded.document.getElementById("current-score").textContent, "578");
    applyAppAttackAction(reloaded.document, "A1");
    assertEqual(reloaded.document.getElementById("current-score").textContent, "289");
    assertEqual(reloaded.document.getElementById("street-bonus").hidden, true);
    reloaded.document.getElementById("undo-move").emit("click");
    assertEqual(reloaded.document.getElementById("current-score").textContent, "578");
    assertEqual(reloaded.document.getElementById("street-bonus").hidden, false);
    document.getElementById("undo-move").emit("click");
    assertEqual(document.getElementById("current-score").textContent, "227");
    assertEqual(document.getElementById("street-bonus").hidden, true);
  });

  test("The Challenge UI can spend all 132 points from a normal 66 and Undo restores them", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 66);
    assertEqual(document.getElementById("current-score").textContent, "132");
    document.getElementById("open-challenge").emit("click");
    assertEqual(document.getElementById("bid-limit").textContent, "Available Score: 132");
    const input = document.getElementById("challenge-bid");
    assertEqual(input.max, "132");
    input.value = "133";
    document.getElementById("challenge-form").emit("submit");
    assertEqual(document.getElementById("bid-feedback").textContent, "Not enough points.");
    assertEqual(document.getElementById("current-score").textContent, "132");
    input.value = "132";
    document.getElementById("challenge-form").emit("submit");
    assertEqual(document.getElementById("current-score").textContent, "0");
    assertEqual(input.value, "132");
    assertEqual(input.readOnly, true);
    assertEqual(document.getElementById("challenge-dialog").open, true);
    const reloaded = startAppTest(storage.getItem(STORAGE_KEY));
    assertEqual(reloaded.document.getElementById("current-score").textContent, "0");
    reloaded.document.getElementById("undo-move").emit("click");
    assertEqual(reloaded.document.getElementById("current-score").textContent, "132");
    assertEqual(reloaded.document.getElementById("cell-A1").querySelectorAll("span").at(-1).textContent, "66");
  });

  test("A legal non-frozen D7 placement displays goal status without stopping entry", () => {
    const { document } = startAppTest(serializeGame({ board: boardFixture(["C7", 46]) }));
    assert(document.getElementById("goal-status").hidden);
    assertGoalFlag(document.getElementById("cell-D7"));
    submitAppNumber(document, "D7", 55);
    assertNoGoalFlag(document.getElementById("cell-D7"));
    assertEqual(document.getElementById("goal-status").hidden, false);
    selectAppCell(document, "D6");
    assert(getAppInput(document) !== null);
  });

  test("Moving the freeze away from D7 displays its thawed goal without giving it points", () => {
    let state = createGameState();
    for (let row = 1; row <= 7; row += 1) state = placeGameNumber(state, "A" + row, 12);
    for (const [coordinate, value] of [["B7", 24], ["C7", 41], ["D7", 53]]) {
      state = placeGameNumber(state, coordinate, value);
    }
    const { document, storage } = startAppTest(serializeGame(state));
    assert(document.getElementById("goal-status").hidden);
    assertFrozenCell(document.getElementById("cell-D7"));
    submitAppNumber(document, "B1", 13);
    submitAppNumber(document, "C1", 23);
    assertEqual(document.getElementById("goal-status").hidden, false);
    assert(document.getElementById("cell-D7").textContent.includes("Thawed"));
    assertEqual(document.getElementById("cell-D7").querySelector("img"), null);
    assertEqual(document.getElementById("current-score").textContent, "162");
    assertDeepEqual(loadGame(storage).state.board[6][3], { value: 53, status: "thawed" });
    assertEqual(document.getElementById("cell-C1").dataset.state, "frozen");
  });

  test("Old numeric saves and malformed data start safely without deleting the original record", () => {
    const board = Array.from({ length: 7 }, () => Array(4).fill(null));
    board[0][0] = 16;
    for (const serialized of ["{", JSON.stringify({ version: 1, state: { board, ownRollCount: 5 } }),
      JSON.stringify({ version: 2, state: { board } }), JSON.stringify({ version: 3, state: { board } })]) {
      const { document, storage } = startAppTest(serialized);
      assertAppBoardReady(document);
      assertEqual(document.getElementById("current-score").textContent, "0");
      assertEqual(getAppInput(document), null);
      assert(document.getElementById("storage-status").textContent.includes("could not be restored"));
      assertEqual(storage.getItem(STORAGE_KEY), serialized);
    }
  });

  test("Startup migrates one old freeze and safely falls back for ambiguous multiple freezes", () => {
    const board = Array.from({ length: 7 }, () => Array(4).fill(null));
    board[0][0] = { value: 23, frozen: false };
    board[0][1] = { value: 31, frozen: true };
    const serialized = JSON.stringify({ version: 2, state: { board } });
    const restored = startAppTest(serialized);
    assertAppBoardReady(restored.document);
    assertEqual(restored.document.getElementById("cell-B1").dataset.state, "frozen");
    assertEqual(restored.document.getElementById("current-score").textContent, "23");
    assertEqual(restored.storage.getItem(STORAGE_KEY), serialized);
    board[1][0] = { value: 23, frozen: true };
    const ambiguous = JSON.stringify({ version: 2, state: { board } });
    const fallback = startAppTest(ambiguous);
    assertAppBoardReady(fallback.document);
    assertEqual(fallback.document.getElementById("current-score").textContent, "0");
    assert(fallback.document.getElementById("storage-status").textContent.includes("could not be restored"));
    assertEqual(fallback.storage.getItem(STORAGE_KEY), ambiguous);
  });

  test("Mixed legacy/current cell encodings fall back visibly without deleting the saved record", () => {
    for (const version of [2, 3, SAVE_VERSION]) {
      const board = boardFixture(["A1", 23], ["B1", 31, "thawed"], ["A2", 23, "frozen"]);
      for (const row of board) {
        for (const cell of row) if (cell !== null) cell.frozen = cell.status === "frozen";
      }
      const serialized = JSON.stringify({ version, state: { board } });
      const { document, storage } = startAppTest(serialized);
      assertAppBoardReady(document);
      assertEqual(document.getElementById("current-score").textContent, "0");
      assertEqual(document.getElementById("cell-A1").dataset.state, "empty");
      assert(document.getElementById("storage-status").textContent.includes("could not be restored"));
      assertEqual(storage.getItem(STORAGE_KEY), serialized);
    }
  });

  test("Unavailable local storage still allows the board to initialize", () => {
    const document = appTestDocument();
    initializeApp(document, { getItem() { throw new Error("Unavailable"); } });
    assertAppBoardReady(document);
    assert(document.getElementById("storage-status").textContent.includes("unavailable"));
  });

  test("A save failure keeps the legal placement visible and reports unavailable saving", () => {
    const document = appTestDocument();
    initializeApp(document, { getItem() { return null; }, setItem() { throw new Error("Quota exceeded"); } });
    submitAppNumber(document, "A1", 16);
    assertEqual(document.getElementById("cell-A1").dataset.state, "normal");
    assertEqual(document.getElementById("current-score").textContent, "16");
    assert(document.getElementById("storage-status").textContent.includes("saving is unavailable"));
    assertEqual(getAppInput(document), null);
  });

  test("Reset requires confirmation and clears the save and transient entry state", () => {
    const serialized = serializeGame({ board: boardFixture(["A1", 23], ["B1", 31, "frozen"]) });
    const { document, storage } = startAppTest(serialized);
    const confirm = document.getElementById("confirm-new-game");
    confirm.emit("click");
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
    selectAppCell(document, "A2");
    typeAppNumber(document, "2");
    document.getElementById("new-game").emit("click");
    assertEqual(getAppInput(document), null);
    document.getElementById("cancel-new-game").emit("click");
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
    document.getElementById("new-game").emit("click");
    confirm.emit("click");
    assertAppBoardReady(document);
    assertEqual(storage.getItem(STORAGE_KEY), null);
    assertEqual(document.getElementById("current-score").textContent, "0");
    assertEqual(getAppInput(document), null);
    assertEqual(countBoardIceImages(document), 0);
    assertGoalFlag(document.getElementById("cell-D7"));
    for (const cell of document.getElementById("board-rows").querySelectorAll("button")) assert(!cell.disabled);
  });

  test("Selecting a cell dismisses a pending reset so its old confirmation cannot clear the game", () => {
    const serialized = serializeGame({ board: boardFixture(["A1", 16]) });
    const { document, storage } = startAppTest(serialized);
    document.getElementById("new-game").emit("click");
    selectAppCell(document, "B1");
    document.getElementById("confirm-new-game").emit("click");
    assertEqual(document.getElementById("reset-confirmation").hidden, true);
    assertEqual((getAppInput(document)?.dataset.coordinate ?? ""), "B1");
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
  });

  test("A reset storage failure keeps the current game and asks the player to retry or cancel", () => {
    const serialized = serializeGame({ board: boardFixture(["A1", 16]) });
    const storage = appTestStorage(serialized);
    storage.removeItem = () => { throw new Error("Unavailable"); };
    const document = appTestDocument();
    initializeApp(document, storage);
    document.getElementById("new-game").emit("click");
    document.getElementById("confirm-new-game").emit("click");
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
    assertEqual(document.getElementById("current-score").textContent, "16");
    assertEqual(document.getElementById("reset-confirmation").hidden, false);
    assert(document.getElementById("storage-status").textContent.includes("could not be cleared"));
  });

  test("Undo stays in the header, is labelled accessibly, and is initially unavailable", () => {
    const { document } = startAppTest();
    const undo = document.getElementById("undo-move");
    assert(undo.disabled);
    assertEqual(undo.getAttribute("aria-label"), "Undo last move");
    assertEqual(undo.getAttribute("title"), "Undo last move");
    assertEqual(undo.textContent, "↶");
  });

  test("A successful normal placement enables Undo, which restores and saves the empty state", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 16);
    assertEqual(document.getElementById("cell-A1").textContent, "16");
    assertEqual(document.getElementById("undo-move").disabled, false);
    document.getElementById("undo-move").emit("click");
    assertDeepEqual(loadGame(storage).state, createGameState());
    assertEqual(document.getElementById("cell-A1").dataset.state, "empty");
    assertEqual(document.getElementById("cell-A1").textContent, "Start");
    assertEqual(document.getElementById("current-score").textContent, "0");
    assertEqual(document.getElementById("undo-move").disabled, true);
    assertEqual(JSON.parse(storage.getItem(STORAGE_KEY)).state.undo, null);
    const saved = storage.getItem(STORAGE_KEY);
    document.getElementById("undo-move").emit("click");
    assertEqual(storage.getItem(STORAGE_KEY), saved);
  });

  test("The complete input/save/render/reload/Undo path restores B1 frozen and removes A2", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 23);
    submitAppNumber(document, "B1", 31);
    const before = loadGame(storage).state.board;
    submitAppNumber(document, "A2", 23);
    assertEqual(document.getElementById("cell-B1").dataset.state, "thawed");
    assertFrozenCell(document.getElementById("cell-A2"));
    const reloaded = appTestDocument();
    initializeApp(reloaded, storage);
    assertEqual(reloaded.getElementById("undo-move").disabled, false);
    reloaded.getElementById("undo-move").emit("click");
    assertDeepEqual(loadGame(storage).state, { board: before, undo: null });
    assertFrozenCell(reloaded.getElementById("cell-B1"));
    assertEqual(reloaded.getElementById("cell-A2").dataset.state, "empty");
    assertEqual(reloaded.getElementById("cell-A2").textContent, "");
    assertEqual(reloaded.getElementById("cell-A2").querySelector("img"), null);
    assertEqual(countBoardIceImages(reloaded), 1);
    assertEqual(reloaded.getElementById("current-score").textContent, "23");
    assertEqual(reloaded.getElementById("undo-move").disabled, true);
    const again = appTestDocument();
    initializeApp(again, storage);
    assertFrozenCell(again.getElementById("cell-B1"));
    assertEqual(again.getElementById("undo-move").disabled, true);
  });

  test("Illegal and invalid submissions preserve the previous available Undo snapshot", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 16);
    const saved = storage.getItem(STORAGE_KEY);
    for (const value of [12, 17]) {
      submitAppNumber(document, "B1", value);
      assertEqual(storage.getItem(STORAGE_KEY), saved);
      assertEqual(document.getElementById("undo-move").disabled, false);
    }
    document.getElementById("undo-move").emit("click");
    assertDeepEqual(loadGame(storage).state, createGameState());
  });

  test("Blur and outside taps leave an existing Undo snapshot available and unchanged", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 16);
    const saved = storage.getItem(STORAGE_KEY);
    for (const action of ["blur", "outside"]) {
      selectAppCell(document, "B1");
      typeAppNumber(document, "2");
      if (action === "blur") document.getElementById("game-board").focus();
      else document.emit("pointerdown", document.root);
      assertEqual(storage.getItem(STORAGE_KEY), saved);
      assertEqual(document.getElementById("undo-move").disabled, false);
    }
  });

  test("Undo clears rejected-entry feedback and restores the previous board", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 16);
    submitAppNumber(document, "B1", 12);
    document.emit("pointerdown", document.getElementById("undo-move"));
    document.getElementById("undo-move").emit("click");
    assertEqual(getAppInput(document), null);
    assertEqual(document.getElementById("app-status").textContent, "Last move undone.");
    assertDeepEqual(loadGame(storage).state, createGameState());
    for (const cell of document.getElementById("board-rows").querySelectorAll("button")) {
      assertEqual(cell.getAttribute("aria-pressed"), "false");
    }
  });

  test("An unavailable Undo tap does nothing, including leaving an open draft intact", () => {
    const { document, storage } = startAppTest();
    selectAppCell(document, "A1");
    typeAppNumber(document, "1");
    const undo = document.getElementById("undo-move");
    document.emit("pointerdown", undo.querySelector("span"));
    undo.emit("click");
    assertEqual((getAppInput(document)?.dataset.coordinate ?? ""), "A1");
    assertEqual(getAppInput(document).value, "1");
    assert(getAppInput(document) !== null);
    assertEqual(storage.getItem(STORAGE_KEY), null);
  });

  test("Undo removes a completed Street and restores the previous visible score and row state", () => {
    const { document, storage } = startAppTest();
    for (const [coordinate, value] of [["A1", 11], ["B1", 12], ["C1", 13], ["D1", 14]]) {
      submitAppNumber(document, coordinate, value);
    }
    assertEqual(document.getElementById("current-score").textContent, "122");
    assertEqual(document.getElementById("street-bonus").hidden, false);
    document.getElementById("undo-move").emit("click");
    assertEqual(document.getElementById("current-score").textContent, "47");
    assertEqual(document.getElementById("street-bonus").hidden, true);
    assert(!document.getElementById("board-rows").children[0].className.includes("street"));
    assertEqual(loadGame(storage).state.board[0][3], null);
  });

  test("Undo of the D7 placement removes visible goal feedback and restores the previous score", () => {
    const { document, storage } = startAppTest(serializeGame({ board: boardFixture(["C7", 46]) }));
    submitAppNumber(document, "D7", 55);
    assertEqual(document.getElementById("cell-D7").querySelectorAll("span").at(-1).textContent, "55");
    assertEqual(document.getElementById("goal-status").hidden, false);
    assertEqual(document.getElementById("current-score").textContent, "156");
    document.getElementById("undo-move").emit("click");
    assertGoalFlag(document.getElementById("cell-D7"));
    assertEqual(document.getElementById("goal-status").hidden, true);
    assertEqual(document.getElementById("current-score").textContent, "46");
    assertDeepEqual(loadGame(storage).state, { board: boardFixture(["C7", 46]), undo: null });
  });

  test("A new successful move replaces the sole snapshot and a move after Undo enables it again", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 16);
    submitAppNumber(document, "B1", 24);
    assertDeepEqual(loadGame(storage).state.undo, { board: boardFixture(["A1", 16]) });
    document.getElementById("undo-move").emit("click");
    assertEqual(document.getElementById("undo-move").disabled, true);
    submitAppNumber(document, "B1", 26);
    assertEqual(document.getElementById("undo-move").disabled, false);
    document.getElementById("undo-move").emit("click");
    assertDeepEqual(loadGame(storage).state, { board: boardFixture(["A1", 16]), undo: null });
  });

  test("Reset clears the available Undo and saved state after explicit confirmation", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 16);
    assertEqual(document.getElementById("undo-move").disabled, false);
    document.getElementById("new-game").emit("click");
    document.getElementById("cancel-new-game").emit("click");
    assertEqual(document.getElementById("undo-move").disabled, false);
    document.getElementById("new-game").emit("click");
    document.getElementById("confirm-new-game").emit("click");
    assertEqual(storage.getItem(STORAGE_KEY), null);
    assertEqual(document.getElementById("undo-move").disabled, true);
    document.getElementById("undo-move").emit("click");
    assertEqual(storage.getItem(STORAGE_KEY), null);
    assertEqual(document.getElementById("current-score").textContent, "0");
  });

  test("Old board-only saves restore without inventing Undo and malformed snapshots start safely", () => {
    const board = boardFixture(["A1", 23], ["B1", 31, "frozen"]);
    for (const version of [3, 4]) {
      const saved = JSON.stringify({ version, state: { board } });
      const { document, storage } = startAppTest(saved);
      assertAppBoardReady(document);
      assertFrozenCell(document.getElementById("cell-B1"));
      assertEqual(document.getElementById("undo-move").disabled, true);
      assertEqual(storage.getItem(STORAGE_KEY), saved);
    }
    const saved = JSON.stringify({ version: SAVE_VERSION, state: { board, undo: { board, undo: null } } });
    const { document, storage } = startAppTest(saved);
    assertAppBoardReady(document);
    assertEqual(document.getElementById("current-score").textContent, "0");
    assertEqual(document.getElementById("undo-move").disabled, true);
    assert(document.getElementById("storage-status").textContent.includes("could not be restored"));
    assertEqual(storage.getItem(STORAGE_KEY), saved);
  });

  test("Undo dismisses a pending reset confirmation so stale confirmation cannot erase the restored game", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 16);
    submitAppNumber(document, "B1", 24);
    document.getElementById("new-game").emit("click");
    document.getElementById("undo-move").emit("click");
    const saved = storage.getItem(STORAGE_KEY);
    document.getElementById("confirm-new-game").emit("click");
    assertEqual(document.getElementById("reset-confirmation").hidden, true);
    assertEqual(storage.getItem(STORAGE_KEY), saved);
    assertDeepEqual(loadGame(storage).state, { board: boardFixture(["A1", 16]), undo: null });
  });

  test("Occupied normal cells offer a transient Freeze action without number input or Edit", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 16);
    const before = storage.getItem(STORAGE_KEY);
    selectAppCell(document, "A1");
    assertEqual(getAppInput(document), null);
    assertEqual(document.getElementById("attack-ice-actions").hidden, false);
    assertEqual(document.getElementById("attack-ice-cell").textContent, "A1");
    assertEqual(document.getElementById("toggle-attack-ice").textContent, "Freeze");
    assertEqual(document.getElementById("toggle-attack-ice").getAttribute("aria-label"), "Freeze Attack Ice at A1");
    assertEqual(document.getElementById("edit-cell"), null);
    assertEqual(storage.getItem(STORAGE_KEY), before);
    assertNoMoveHints(document);
  });

  test("Freeze saves, shows the Attack asset, retains points, closes actions, and captures Undo", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 16);
    const before = loadGame(storage).state;
    applyAppAttackAction(document, "A1");
    assertDeepEqual(loadGame(storage).state, freezeGameCell(before, "A1"));
    assertAttackCell(document.getElementById("cell-A1"));
    assertEqual(document.getElementById("current-score").textContent, "16");
    assertEqual(document.getElementById("attack-ice-actions").hidden, true);
    assertEqual(getAppInput(document), null);
    assertEqual(document.getElementById("undo-move").disabled, false);
    assertEqual(document.activeElement, document.getElementById("game-board"));
    document.getElementById("undo-move").emit("click");
    assertDeepEqual(loadGame(storage).state, { board: before.board, undo: null });
    assertEqual(document.getElementById("cell-A1").querySelector("img"), null);
  });

  test("Attack-Iced cells offer Unfreeze and Undo after reload restores the exact overlay", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 16);
    applyAppAttackAction(document, "A1");
    const iced = loadGame(storage).state;
    selectAppCell(document, "A1");
    assertEqual(document.getElementById("toggle-attack-ice").textContent, "Unfreeze");
    assertEqual(document.getElementById("toggle-attack-ice").getAttribute("aria-label"), "Unfreeze Attack Ice at A1");
    document.getElementById("toggle-attack-ice").emit("click");
    assertDeepEqual(loadGame(storage).state, unfreezeGameCell(iced, "A1"));
    assertEqual(document.getElementById("cell-A1").querySelector("img"), null);
    const reloaded = appTestDocument();
    initializeApp(reloaded, storage);
    assertEqual(reloaded.getElementById("current-score").textContent, "16");
    reloaded.getElementById("undo-move").emit("click");
    assertDeepEqual(loadGame(storage).state, { board: iced.board, undo: null });
    assertAttackCell(reloaded.getElementById("cell-A1"));
  });

  test("Freeze on another occupied cell moves Attack Ice in one action and reload/Undo restores its location", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 16);
    submitAppNumber(document, "B1", 24);
    applyAppAttackAction(document, "A1");
    const before = loadGame(storage).state;
    applyAppAttackAction(document, "B1");
    assertDeepEqual(loadGame(storage).state, freezeGameCell(before, "B1"));
    assertEqual(document.getElementById("cell-A1").querySelector("img"), null);
    assertAttackCell(document.getElementById("cell-B1"));
    assertEqual(countBoardIceImages(document), 1);
    assertEqual(document.getElementById("current-score").textContent, "40");
    const reloaded = appTestDocument();
    initializeApp(reloaded, storage);
    assertAttackCell(reloaded.getElementById("cell-B1"));
    reloaded.getElementById("undo-move").emit("click");
    assertDeepEqual(loadGame(storage).state, { board: before.board, undo: null });
    assertAttackCell(reloaded.getElementById("cell-A1"));
    assertEqual(reloaded.getElementById("cell-B1").querySelector("img"), null);
  });

  test("Prime-frozen cells remain disabled and never offer Freeze, including a stale forced click", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 23);
    submitAppNumber(document, "B1", 31);
    const before = storage.getItem(STORAGE_KEY);
    const cell = document.getElementById("cell-B1");
    assert(cell.disabled);
    assertFrozenCell(cell);
    cell.disabled = false;
    selectAppCell(document, "B1");
    assertEqual(document.getElementById("attack-ice-actions").hidden, true);
    document.getElementById("toggle-attack-ice").emit("click");
    assertEqual(storage.getItem(STORAGE_KEY), before);
    assertFrozenCell(document.getElementById("cell-B1"));
  });

  test("The actual 23/31/23 app path preserves Prime history under Attack Ice and blocks/restores thawed support", () => {
    const { document, storage } = startAppTest();
    for (const [coordinate, value] of [["A1", 23], ["B1", 31], ["A2", 23]]) {
      submitAppNumber(document, coordinate, value);
    }
    const underlying = loadGame(storage).state;
    applyAppAttackAction(document, "B1");
    assertDeepEqual(loadGame(storage).state, freezeGameCell(underlying, "B1"));
    assertAttackCell(document.getElementById("cell-B1"), "thawed");
    assert(document.getElementById("cell-B1").textContent.includes("Thawed"));
    assert(!document.getElementById("cell-B1").getAttribute("aria-label").includes("usable placement neighbor"));
    assertFrozenCell(document.getElementById("cell-A2"));
    assertEqual(document.getElementById("current-score").textContent, "23");
    const saved = storage.getItem(STORAGE_KEY);
    submitAppNumber(document, "C1", 46);
    assertEqual(storage.getItem(STORAGE_KEY), saved);
    assertEqual(document.getElementById("cell-C1").dataset.state, "empty");
    const reloaded = appTestDocument();
    initializeApp(reloaded, storage);
    assertAttackCell(reloaded.getElementById("cell-B1"), "thawed");
    assertFrozenCell(reloaded.getElementById("cell-A2"));
    applyAppAttackAction(reloaded, "B1");
    assertDeepEqual(loadGame(storage).state.board, underlying.board);
    assertEqual(reloaded.getElementById("current-score").textContent, "23");
    submitAppNumber(reloaded, "C1", 46);
    assertEqual(reloaded.getElementById("current-score").textContent, "69");
    assertEqual(loadGame(storage).state.board[0][1].status, "thawed");
    assertFrozenCell(reloaded.getElementById("cell-A2"));
  });

  test("Attack-blocked placement still succeeds through a separate usable OR neighbor in the app", () => {
    const { document, storage } = startAppTest();
    for (const [coordinate, value] of [["A1", 16], ["B1", 24], ["A2", 16]]) submitAppNumber(document, coordinate, value);
    applyAppAttackAction(document, "B1");
    submitAppNumber(document, "B2", 26);
    assertDeepEqual(loadGame(storage).state.board[1][1], { value: 26, status: "normal" });
    assertAttackCell(document.getElementById("cell-B1"));
    assertEqual(document.getElementById("current-score").textContent, "82");
    assertNoMoveHints(document);
  });

  test("Freeze/Unfreeze visibly suppresses/restores a Street and Undo restores the prior row", () => {
    const { document } = startAppTest();
    for (const [coordinate, value] of [["A1", 11], ["B1", 12], ["C1", 13], ["D1", 14]]) submitAppNumber(document, coordinate, value);
    applyAppAttackAction(document, "B1");
    assertEqual(document.getElementById("current-score").textContent, "61");
    assertEqual(document.getElementById("street-bonus").hidden, true);
    assert(!document.getElementById("board-rows").children[0].className.includes("street"));
    applyAppAttackAction(document, "B1");
    assertEqual(document.getElementById("current-score").textContent, "122");
    assertEqual(document.getElementById("street-bonus").hidden, false);
    assert(document.getElementById("board-rows").children[0].className.includes("street"));
    document.getElementById("undo-move").emit("click");
    assertEqual(document.getElementById("current-score").textContent, "61");
    assertAttackCell(document.getElementById("cell-B1"));
  });

  for (const status of ["normal", "thawed"]) {
    test("Attack Ice suppresses/restores " + status + " D7 feedback without changing its base points", () => {
      const { document } = startAppTest(serializeGame({ board: boardFixture(["D7", 53, status]), undo: null }));
      assertEqual(document.getElementById("goal-status").hidden, false);
      applyAppAttackAction(document, "D7");
      assertEqual(document.getElementById("goal-status").hidden, true);
      assertEqual(document.getElementById("current-score").textContent, status === "normal" ? "53" : "0");
      applyAppAttackAction(document, "D7");
      assertEqual(document.getElementById("goal-status").hidden, false);
      assertEqual(document.getElementById("current-score").textContent, status === "normal" ? "53" : "0");
      document.getElementById("undo-move").emit("click");
      assertEqual(document.getElementById("goal-status").hidden, true);
      assertAttackCell(document.getElementById("cell-D7"), status);
    });
  }

  test("Context Cancel, outside tap, Escape, and switching to an empty cell do not save or change Undo", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 16);
    const saved = storage.getItem(STORAGE_KEY);
    for (const action of ["Cancel", "outside", "Escape", "empty cell"]) {
      selectAppCell(document, "A1");
      assertEqual(document.getElementById("attack-ice-actions").hidden, false);
      if (action === "Cancel") document.getElementById("cancel-attack-ice").emit("click");
      else if (action === "outside") document.emit("pointerdown", document.root);
      else if (action === "Escape") document.emit("keydown", document.root, { key: "Escape" });
      else {
        document.emit("pointerdown", document.getElementById("cell-B1"));
        selectAppCell(document, "B1");
        assert(getAppInput(document) !== null);
        assertEqual(getAppInput(document).value, "");
      }
      assertEqual(document.getElementById("attack-ice-actions").hidden, true);
      assertEqual(document.getElementById("cell-A1").getAttribute("aria-pressed"), "false");
      assertEqual(storage.getItem(STORAGE_KEY), saved);
      assertEqual(document.getElementById("undo-move").disabled, false);
    }
  });

  test("Opening occupied actions discards a draft and safely dismisses reset confirmation", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 16);
    submitAppNumber(document, "B1", 12);
    selectAppCell(document, "B1");
    typeAppNumber(document, "1");
    const saved = storage.getItem(STORAGE_KEY);
    const occupied = document.getElementById("cell-A1");
    document.emit("pointerdown", occupied);
    selectAppCell(document, "A1");
    assertEqual(document.getElementById("app-status").hidden, true);
    assertEqual(getAppInput(document), null);
    assertEqual(document.getElementById("attack-ice-actions").hidden, false);
    document.getElementById("new-game").emit("click");
    assertEqual(document.getElementById("attack-ice-actions").hidden, true);
    selectAppCell(document, "A1");
    document.getElementById("confirm-new-game").emit("click");
    assertEqual(storage.getItem(STORAGE_KEY), saved);
    assertEqual(document.getElementById("reset-confirmation").hidden, true);
    assertEqual(document.getElementById("attack-ice-actions").hidden, false);
  });

  test("Repeated action taps do not toggle twice; Undo clears context and remains one-step", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 16);
    applyAppAttackAction(document, "A1");
    const saved = storage.getItem(STORAGE_KEY);
    document.getElementById("toggle-attack-ice").emit("click");
    assertEqual(storage.getItem(STORAGE_KEY), saved);
    selectAppCell(document, "A1");
    document.emit("pointerdown", document.getElementById("undo-move"));
    document.getElementById("undo-move").emit("click");
    assertEqual(document.getElementById("attack-ice-actions").hidden, true);
    const undone = storage.getItem(STORAGE_KEY);
    document.getElementById("toggle-attack-ice").emit("click");
    document.getElementById("undo-move").emit("click");
    assertEqual(storage.getItem(STORAGE_KEY), undone);
  });

  test("Confirmed Reset clears Attack Ice, Prime history, Undo, and its contextual panel", () => {
    const { document, storage } = startAppTest();
    for (const [coordinate, value] of [["A1", 23], ["B1", 31], ["A2", 23]]) submitAppNumber(document, coordinate, value);
    applyAppAttackAction(document, "B1");
    selectAppCell(document, "B1");
    document.getElementById("new-game").emit("click");
    document.getElementById("confirm-new-game").emit("click");
    assertEqual(storage.getItem(STORAGE_KEY), null);
    assertEqual(document.getElementById("attack-ice-actions").hidden, true);
    assertEqual(countBoardIceImages(document), 0);
    assertGoalFlag(document.getElementById("cell-D7"));
    assertEqual(document.getElementById("current-score").textContent, "0");
    assertEqual(document.getElementById("undo-move").disabled, true);
  });

  test("An Attack save failure keeps the action visible, keeps Undo, and reports storage failure", () => {
    const document = appTestDocument();
    const initial = serializeGame({ board: boardFixture(["A1", 16]), undo: null });
    initializeApp(document, { getItem() { return initial; }, setItem() { throw new Error("Quota exceeded"); } });
    applyAppAttackAction(document, "A1");
    assertAttackCell(document.getElementById("cell-A1"));
    assertEqual(document.getElementById("current-score").textContent, "16");
    assertEqual(document.getElementById("undo-move").disabled, false);
    assert(document.getElementById("storage-status").textContent.includes("saving is unavailable"));
  });

  test("Version 5 loads with Undo intact and the next Freeze writes the current version", () => {
    const state = placeGameNumber(placeGameNumber(createGameState(), "A1", 23), "B1", 31);
    const saved = JSON.stringify({ version: 5, state });
    const { document, storage } = startAppTest(saved);
    assertFrozenCell(document.getElementById("cell-B1"));
    assertEqual(storage.getItem(STORAGE_KEY), saved);
    assertEqual(document.getElementById("undo-move").disabled, false);
    applyAppAttackAction(document, "A1");
    assertEqual(JSON.parse(storage.getItem(STORAGE_KEY)).version, SAVE_VERSION);
    assertAttackCell(document.getElementById("cell-A1"));
    assertFrozenCell(document.getElementById("cell-B1"));
  });

  test("Attack Ice remains manual without Edit, roll, player, or permission controls", () => {
    const { document } = startAppTest();
    assertEqual(document.getElementById("attack-ice-actions").hidden, true);
    for (const id of ["edit-cell", "edit-number", "player-select", "opponents", "own-roll-form", "permissions"]) {
      assertEqual(document.getElementById(id), null);
    }
  });

  test("Opening, typing, and cancelling Challenge never spend or replace Undo", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 46);
    const saved = storage.getItem(STORAGE_KEY);
    document.getElementById("open-challenge").emit("click");
    assertEqual(document.getElementById("challenge-dialog").open, true);
    assertEqual(document.activeElement, document.getElementById("challenge-bid"));
    assertEqual(document.getElementById("bid-limit").textContent, "Available Score: 46");
    document.getElementById("challenge-bid").value = "12";
    document.getElementById("challenge-bid").emit("input");
    assertEqual(storage.getItem(STORAGE_KEY), saved);
    document.getElementById("close-challenge").emit("click");
    assertEqual(document.getElementById("challenge-dialog").open, false);
    assertEqual(document.activeElement, document.getElementById("open-challenge"));
    assertEqual(document.getElementById("current-score").textContent, "46");
    assertEqual(storage.getItem(STORAGE_KEY), saved);
    document.getElementById("undo-move").emit("click");
    assertEqual(document.getElementById("cell-A1").textContent, "Start");
  });

  test("Invalid bids leave score, board, saved data, and existing Undo untouched", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 46);
    const saved = storage.getItem(STORAGE_KEY);
    document.getElementById("open-challenge").emit("click");
    for (const value of ["", "47", "-1", "1.5", "12.0", "word", "1e1", " 12", "12\n"]) {
      document.getElementById("challenge-bid").value = value;
      const event = document.getElementById("challenge-form").emit("submit");
      assert(event.defaultPrevented);
      assertEqual(storage.getItem(STORAGE_KEY), saved);
      assertEqual(document.getElementById("current-score").textContent, "46");
      assertEqual(document.getElementById("challenge-bid").readOnly, false);
      assertEqual(document.getElementById("challenge-banknote").dataset.phase, "editing");
      assertEqual(document.getElementById("reveal-bid").hidden, true);
      assertEqual(document.getElementById("challenge-bid").getAttribute("aria-invalid"), "true");
      assert(document.getElementById("bid-feedback").textContent.length > 0);
      assertEqual(document.getElementById("challenge-dialog").open, true);
    }
  });

  test("Confirm spends exactly once, updates Score, locks the bid, begins concealing it, and stays open", () => {
    const { document, storage } = startAppTest(serializeGame({ board: boardFixture(["A1", 23], ["B1", 24]), undo: null }));
    document.getElementById("open-challenge").emit("click");
    const input = document.getElementById("challenge-bid");
    input.value = "12";
    document.getElementById("challenge-form").emit("submit");
    assertEqual(document.getElementById("current-score").textContent, "35");
    assertEqual(input.value, "12");
    assertEqual(input.readOnly, true);
    assertEqual(document.getElementById("challenge-banknote").dataset.phase, "flipping-to-hidden");
    assertEqual(document.getElementById("bid-limit").textContent, "");
    assertEqual(document.getElementById("confirm-bid").disabled, true);
    assertEqual(document.getElementById("challenge-dialog").open, true);
    assertEqual(document.activeElement, document.getElementById("close-challenge"));
    const saved = storage.getItem(STORAGE_KEY);
    for (let tap = 0; tap < 3; tap += 1) document.getElementById("challenge-form").emit("submit");
    assertEqual(storage.getItem(STORAGE_KEY), saved);
    assertEqual(loadGame(storage).state.pointsSpent, 12);
    assertDeepEqual(loadGame(storage).state.board, boardFixture(["A1", 23], ["B1", 24]));
    assertEqual(document.getElementById("attack-ice-actions").hidden, true);
  });

  test("Close after confirmation never refunds and reopening starts a new bid", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 46);
    document.getElementById("open-challenge").emit("click");
    document.getElementById("challenge-bid").value = "12";
    document.getElementById("challenge-form").emit("submit");
    const saved = storage.getItem(STORAGE_KEY);
    document.getElementById("close-challenge").emit("click");
    assertEqual(document.getElementById("current-score").textContent, "34");
    assertEqual(storage.getItem(STORAGE_KEY), saved);
    document.getElementById("open-challenge").emit("click");
    assertEqual(document.getElementById("challenge-bid").value, "");
    assertEqual(document.getElementById("challenge-bid").readOnly, false);
    assertEqual(document.getElementById("confirm-bid").disabled, false);
    assertEqual(document.getElementById("bid-limit").textContent, "Available Score: 34");
    document.getElementById("challenge-bid").value = "34";
    document.getElementById("challenge-form").emit("submit");
    assertEqual(document.getElementById("current-score").textContent, "0");
    assertEqual(loadGame(storage).state.pointsSpent, 46);
  });

  test("A zero bid is accepted and replaces the previous single-step Undo", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 46);
    document.getElementById("open-challenge").emit("click");
    document.getElementById("challenge-bid").value = "0";
    document.getElementById("challenge-form").emit("submit");
    assertEqual(document.getElementById("challenge-bid").readOnly, true);
    assertEqual(document.getElementById("current-score").textContent, "46");
    document.getElementById("close-challenge").emit("click");
    document.getElementById("undo-move").emit("click");
    assertEqual(document.getElementById("cell-A1").textContent, "46");
    assertEqual(loadGame(storage).state.undo, null);
    assertEqual(document.getElementById("undo-move").disabled, true);
  });

  test("Undo is unavailable through the modal and restores the pre-bid score after closing", () => {
    const { document, storage } = startAppTest();
    for (const [coordinate, value] of [["A1", 23], ["B1", 31], ["A2", 23]]) submitAppNumber(document, coordinate, value);
    applyAppAttackAction(document, "B1");
    const boardBefore = loadGame(storage).state.board;
    document.getElementById("open-challenge").emit("click");
    document.getElementById("challenge-bid").value = "12";
    document.getElementById("challenge-form").emit("submit");
    finishNoteFlip(document);
    document.getElementById("reveal-bid").emit("click");
    finishNoteShake(document);
    finishNoteFlip(document);
    assertEqual(document.getElementById("challenge-banknote").dataset.phase, "revealed");
    const saved = storage.getItem(STORAGE_KEY);
    document.getElementById("undo-move").emit("click");
    document.getElementById("new-game").emit("click");
    selectAppCell(document, "C1");
    assertEqual(storage.getItem(STORAGE_KEY), saved);
    assertEqual(document.getElementById("challenge-dialog").open, true);
    document.getElementById("close-challenge").emit("click");
    document.getElementById("undo-move").emit("click");
    assertEqual(document.getElementById("current-score").textContent, "23");
    assertDeepEqual(loadGame(storage).state.board, boardBefore);
    assertEqual(loadGame(storage).state.pointsSpent, 0);
    assertEqual(loadGame(storage).state.undo, null);
  });

  test("Reload restores reduced Score and bid Undo but never an open modal or draft", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 46);
    document.getElementById("open-challenge").emit("click");
    document.getElementById("challenge-bid").value = "12";
    document.getElementById("challenge-form").emit("submit");
    const restored = startAppTest(storage.getItem(STORAGE_KEY));
    assertEqual(restored.document.getElementById("current-score").textContent, "34");
    assertEqual(restored.document.getElementById("challenge-dialog").open, false);
    assertEqual(restored.document.getElementById("challenge-bid").value, "");
    assertEqual(restored.document.getElementById("challenge-banknote").dataset.phase, "editing");
    assertEqual(restored.document.getElementById("reveal-bid").hidden, true);
    restored.document.getElementById("undo-move").emit("click");
    assertEqual(restored.document.getElementById("current-score").textContent, "46");
  });

  test("Escape and native dialog cancellation close without accidental confirmation or refund", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 46);
    const saved = storage.getItem(STORAGE_KEY);
    document.getElementById("open-challenge").emit("click");
    document.getElementById("challenge-bid").value = "12";
    document.emit("keydown", document.getElementById("challenge-bid"), { key: "Escape" });
    assertEqual(storage.getItem(STORAGE_KEY), saved);
    assertEqual(document.getElementById("challenge-dialog").open, false);
    document.getElementById("open-challenge").emit("click");
    document.getElementById("challenge-bid").value = "12";
    document.getElementById("challenge-dialog").emit("click"); // Dimmed background does nothing.
    assertEqual(storage.getItem(STORAGE_KEY), saved);
    document.getElementById("challenge-form").emit("submit");
    const confirmed = storage.getItem(STORAGE_KEY);
    assert(document.getElementById("challenge-dialog").emit("cancel").defaultPrevented);
    assertEqual(document.getElementById("challenge-dialog").open, false);
    assertEqual(storage.getItem(STORAGE_KEY), confirmed);
  });

  test("Challenge discards only UI drafts, and confirmed reset clears all point spending", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 46);
    selectAppCell(document, "A2");
    typeAppNumber(document, "4");
    const saved = storage.getItem(STORAGE_KEY);
    document.getElementById("open-challenge").emit("click");
    assertEqual(getAppInput(document), null);
    assertEqual(document.getElementById("cell-A2").textContent, "");
    assertEqual(storage.getItem(STORAGE_KEY), saved);
    document.getElementById("challenge-bid").value = "12";
    document.getElementById("challenge-form").emit("submit");
    document.getElementById("close-challenge").emit("click");
    submitAppNumber(document, "A2", 46);
    assertEqual(document.getElementById("current-score").textContent, "80");
    document.getElementById("new-game").emit("click");
    document.getElementById("confirm-new-game").emit("click");
    assertEqual(storage.getItem(STORAGE_KEY), null);
    assertEqual(document.getElementById("current-score").textContent, "0");
  });

  test("A bid save failure preserves the visible action and Undo with a storage warning", () => {
    const document = appTestDocument();
    const initial = serializeGame({ board: boardFixture(["A1", 46]), undo: null });
    initializeApp(document, { getItem() { return initial; }, setItem() { throw new Error("Quota exceeded"); } });
    document.getElementById("open-challenge").emit("click");
    document.getElementById("challenge-bid").value = "12";
    document.getElementById("challenge-form").emit("submit");
    assertEqual(document.getElementById("current-score").textContent, "34");
    assertEqual(document.getElementById("challenge-bid").readOnly, true);
    assertEqual(document.getElementById("undo-move").disabled, false);
    assert(document.getElementById("storage-status").textContent.includes("saving is unavailable"));
  });

  test("Opening Frosty Dollar shows the editable bid face in its stable frame", () => {
    const { document, writes } = startNoteTest();
    const note = document.getElementById("challenge-banknote");
    const input = document.getElementById("challenge-bid");
    assertEqual(note.dataset.phase, "editing");
    assertEqual(note.style["--bid-flip-duration"], "500ms");
    assertEqual(note.style["--bid-reveal-duration"], "700ms");
    assertEqual(note.style["--bid-shake-duration"], "1200ms");
    assertEqual(document.getElementById("challenge-bid-face").querySelector("img").src, "./assets/bid.png");
    assertEqual(document.getElementById("challenge-bid-face").hidden, false);
    assertEqual(input.disabled, false);
    assertEqual(input.readOnly, false);
    assertEqual(input.value, "");
    assertEqual(document.activeElement, input);
    assertEqual(document.getElementById("reveal-bid").hidden, true);
    assertEqual(writes, 0);
  });

  test("Confirmation conceals the amount and the hidden note never reveals on a timeout", () => {
    const test = startNoteTest();
    const { document, storage } = test;
    confirmNote(document);
    assertEqual(document.getElementById("challenge-banknote").dataset.phase, "flipping-to-hidden");
    const cover = document.getElementById("reveal-bid");
    cover.emit("click");
    assertEqual(document.getElementById("challenge-banknote").dataset.phase, "flipping-to-hidden");
    finishNoteFlip(document);
    assertCoveredNote(document);
    assertEqual(document.getElementById("bid-feedback").textContent, "Tap to reveal");
    assertEqual(document.activeElement, cover);
    const saved = storage.getItem(STORAGE_KEY);
    document.runTimers();
    assertCoveredNote(document);
    assertEqual(storage.getItem(STORAGE_KEY), saved);
    assertEqual(test.writes, 1);
  });

  test("Reveal shakes first, then flips once, without spending or replacing Undo", () => {
    const test = startNoteTest();
    const { document, storage } = test;
    confirmNote(document);
    finishNoteFlip(document);
    const saved = storage.getItem(STORAGE_KEY);
    const note = document.getElementById("challenge-banknote");
    const rotor = document.getElementById("challenge-note-rotor");
    const shake = document.getElementById("challenge-note-shake");
    const cover = document.getElementById("reveal-bid");
    cover.emit("click");
    assertEqual(note.dataset.phase, "shaking");
    assertEqual(document.getElementById("challenge-bid-face").hidden, true);
    for (let tap = 0; tap < 3; tap += 1) cover.emit("click");
    finishNoteFlip(document); // A different CSS event must not skip the shake.
    shake.emit("animationend", shake, { animationName: "unrelated" });
    assertEqual(note.dataset.phase, "shaking");
    finishNoteShake(document);
    assertEqual(note.dataset.phase, "flipping-to-revealed");
    rotor.emit("transitionend", document.getElementById("challenge-bid"), { propertyName: "transform" });
    rotor.emit("transitionend", rotor, { propertyName: "opacity" });
    assertEqual(note.dataset.phase, "flipping-to-revealed");
    finishNoteFlip(document);
    assertEqual(note.dataset.phase, "revealed");
    assertEqual(document.getElementById("challenge-bid-face").hidden, false);
    assertEqual(document.getElementById("challenge-bid-face").inert, false);
    assertEqual(document.getElementById("challenge-bid").disabled, false);
    assertEqual(document.getElementById("challenge-bid").readOnly, true);
    assertEqual(document.getElementById("challenge-bid").value, "12");
    assertEqual(cover.hidden, true);
    assertEqual(document.activeElement, document.getElementById("close-challenge"));
    for (let tap = 0; tap < 3; tap += 1) {
      cover.emit("click");
      document.getElementById("challenge-form").emit("submit");
    }
    document.runTimers();
    assertEqual(note.dataset.phase, "revealed");
    assertEqual(storage.getItem(STORAGE_KEY), saved);
    assertEqual(test.writes, 1);
    assertEqual(document.getElementById("current-score").textContent, "35");
  });

  test("The covered note's native keyboard-originated click uses the same one-shot reveal", () => {
    const { document } = startNoteTest();
    confirmNote(document);
    finishNoteFlip(document);
    const cover = document.getElementById("reveal-bid");
    assertEqual(cover.type, "button"); // Native buttons provide Enter/Space activation.
    cover.focus();
    cover.emit("click", cover, { detail: 0 });
    cover.emit("click", cover, { detail: 0 });
    assertEqual(document.getElementById("challenge-banknote").dataset.phase, "shaking");
    finishNoteShake(document);
    finishNoteFlip(document);
    assertEqual(document.getElementById("challenge-banknote").dataset.phase, "revealed");
  });

  test("Amounts 0, 12, 100, and 1000 stay locked through concealment and reveal", () => {
    for (const amount of [0, 12, 100, 1000]) {
      const test = startNoteTest({ largeBalance: true });
      const { document, storage } = test;
      confirmNote(document, amount);
      finishNoteFlip(document);
      assertCoveredNote(document);
      assertEqual(document.getElementById("challenge-bid").value, String(amount));
      assert(!document.getElementById("bid-feedback").textContent.includes(String(amount)));
      const saved = storage.getItem(STORAGE_KEY);
      document.getElementById("challenge-bid").value = "9999"; // A stale input cannot alter the locked reveal.
      document.getElementById("reveal-bid").emit("click");
      finishNoteShake(document);
      finishNoteFlip(document);
      assertEqual(document.getElementById("challenge-bid").value, String(amount));
      assertEqual(document.getElementById("current-score").textContent,
        new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(1533 - amount));
      assertEqual(storage.getItem(STORAGE_KEY), saved);
      assertEqual(test.writes, 1);
    }
  });

  test("Closing at every visual phase cancels animation work without refunding; reopening is fresh", () => {
    for (const phase of ["editing", "flipping-to-hidden", "hidden", "shaking", "flipping-to-revealed", "revealed"]) {
      const test = startNoteTest();
      const { document, storage } = test;
      const initial = storage.getItem(STORAGE_KEY);
      document.getElementById("challenge-bid").value = "12";
      if (phase !== "editing") confirmNote(document);
      if (["hidden", "shaking", "flipping-to-revealed", "revealed"].includes(phase)) finishNoteFlip(document);
      if (["shaking", "flipping-to-revealed", "revealed"].includes(phase)) document.getElementById("reveal-bid").emit("click");
      if (["flipping-to-revealed", "revealed"].includes(phase)) finishNoteShake(document);
      if (phase === "revealed") finishNoteFlip(document);
      assertEqual(document.getElementById("challenge-banknote").dataset.phase, phase);
      const saved = storage.getItem(STORAGE_KEY);
      document.getElementById("close-challenge").emit("click");
      assertEqual(document.getElementById("current-score").textContent, phase === "editing" ? "47" : "35");
      assertEqual(storage.getItem(STORAGE_KEY), phase === "editing" ? initial : saved);
      document.getElementById("open-challenge").emit("click");
      document.runTimers();
      assertEqual(document.getElementById("challenge-banknote").dataset.phase, "editing");
      assertEqual(document.getElementById("challenge-bid").value, "");
      assertEqual(document.getElementById("challenge-bid").disabled, false);
      assertEqual(document.getElementById("challenge-bid").readOnly, false);
      assertEqual(document.getElementById("confirm-bid").disabled, false);
      assertEqual(document.getElementById("reveal-bid").hidden, true);
      assertEqual(document.activeElement, document.getElementById("challenge-bid"));
    }
  });

  test("Late callbacks from a closed note cannot finish a new bid's animation", () => {
    const { document, storage } = startNoteTest();
    const callbacks = [];
    const schedule = document.defaultView.setTimeout;
    document.defaultView.setTimeout = (callback, delay) => { callbacks.push(callback); return schedule(callback, delay); };
    confirmNote(document);
    const oldCallback = callbacks[0];
    document.getElementById("close-challenge").emit("click");
    document.getElementById("open-challenge").emit("click");
    confirmNote(document, 7);
    oldCallback();
    assertEqual(document.getElementById("challenge-banknote").dataset.phase, "flipping-to-hidden");
    finishNoteFlip(document);
    assertCoveredNote(document);
    assertEqual(loadGame(storage).state.pointsSpent, 19);
    assertEqual(document.getElementById("challenge-bid").value, "7");
  });

  test("Missing CSS completion events still finish each requested phase without auto-reveal", () => {
    const { document, storage } = startNoteTest();
    const delays = [];
    const schedule = document.defaultView.setTimeout;
    document.defaultView.setTimeout = (callback, delay) => { delays.push(delay); return schedule(callback, delay); };
    confirmNote(document);
    assertEqual(delays.at(-1), 600); // Confirm: unchanged 500ms plus the fallback buffer.
    document.runTimers();
    assertCoveredNote(document);
    const saved = storage.getItem(STORAGE_KEY);
    document.runTimers();
    assertCoveredNote(document);
    document.getElementById("reveal-bid").emit("click");
    assertEqual(delays.at(-1), 1300); // 400ms anticipation + 800ms buildup + buffer.
    document.runTimers();
    assertEqual(document.getElementById("challenge-banknote").dataset.phase, "flipping-to-revealed");
    assertEqual(delays.at(-1), 800); // Reveal: 700ms plus the fallback buffer.
    document.runTimers();
    assertEqual(document.getElementById("challenge-banknote").dataset.phase, "revealed");
    assertEqual(storage.getItem(STORAGE_KEY), saved);
  });

  test("Reduced motion conceals immediately and still needs explicit reveal without a shake", () => {
    const test = startNoteTest({ reducedMotion: true });
    const { document, storage } = test;
    confirmNote(document);
    assertCoveredNote(document);
    const saved = storage.getItem(STORAGE_KEY);
    document.runTimers();
    assertCoveredNote(document);
    document.getElementById("reveal-bid").emit("click");
    assertEqual(document.getElementById("challenge-banknote").dataset.phase, "revealed");
    assertEqual(document.getElementById("challenge-bid").value, "12");
    assertEqual(document.getElementById("challenge-bid").readOnly, true);
    assertEqual(storage.getItem(STORAGE_KEY), saved);
    assertEqual(test.writes, 1);
  });

  test("Enabling reduced motion mid-animation never reveals an unrequested hidden bid", () => {
    const test = startNoteTest();
    const { document } = test;
    confirmNote(document);
    test.changeMotion(true);
    assertCoveredNote(document);
    document.runTimers();
    assertCoveredNote(document);
    test.changeMotion(false);
    document.getElementById("reveal-bid").emit("click");
    assertEqual(document.getElementById("challenge-banknote").dataset.phase, "shaking");
    test.changeMotion(true);
    assertEqual(document.getElementById("challenge-banknote").dataset.phase, "revealed");
    document.runTimers();
    assertEqual(document.getElementById("challenge-banknote").dataset.phase, "revealed");
  });

  test("Reveal instructions use the existing Rules language without changing its preference", () => {
    for (const [language, label] of [["en", "Tap to reveal"], ["de", "Zum Aufdecken tippen"]]) {
      const { document, storage } = startNoteTest({ language, reducedMotion: true });
      confirmNote(document);
      assertCoveredNote(document);
      assertEqual(document.getElementById("reveal-bid").getAttribute("aria-label"), label);
      assertEqual(document.getElementById("bid-feedback").textContent, label);
      assertEqual(storage.getItem("frosty-dice.rules-language"), language);
    }
  });


  test("Blur preserves the next keyboard focus target and restores Start without saving", () => {
    const { document, storage } = startAppTest();
    selectAppCell(document, "A1");
    typeAppNumber(document, "2");
    const next = document.getElementById("cell-B1");
    next.focus();
    assertEqual(document.activeElement, next);
    assertEqual(document.getElementById("cell-B1"), next);
    assertEqual(document.getElementById("cell-A1").textContent, "Start");
    assertEqual(getAppInput(document), null);
    assertEqual(storage.getItem(STORAGE_KEY), null);
  });

  for (const coordinate of ["A1", "D7"]) {
    test("Cancellation and rejection restore the empty " + coordinate + " hint", () => {
      const initial = coordinate === "A1" ? serializeGame({ board: boardFixture(["B1", 24]) }) : null;
      const { document, storage } = startAppTest(initial);
      const assertHint = () => coordinate === "A1"
        ? assertEqual(document.getElementById("cell-A1").textContent, "Start")
        : assertGoalFlag(document.getElementById("cell-D7"));
      assertHint();
      selectAppCell(document, coordinate);
      assertEqual(document.getElementById("cell-" + coordinate).textContent, "");
      assertNoGoalFlag(document.getElementById("cell-" + coordinate));
      typeAppNumber(document, "3");
      document.emit("keydown", document.root, { key: "Escape" });
      assertHint();
      submitAppNumber(document, coordinate, 66);
      assertEqual(getAppInput(document), null);
      assertHint();
      assertEqual(storage.getItem(STORAGE_KEY), initial);
    });
  }

  test("Deleting the first digit leaves an empty draft without attempting or saving", () => {
    const { document, storage } = startAppTest();
    selectAppCell(document, "A1");
    typeAppNumber(document, "3");
    typeAppNumber(document, "");
    assertEqual(getAppInput(document).value, "");
    assertEqual(document.getElementById("app-status").textContent, "Tap an empty cell to enter a number.");
    assertEqual(storage.getItem(STORAGE_KEY), null);
    assertEqual(document.getElementById("undo-move").disabled, true);
  });

  test("Enter rejects an incomplete number without creating a placement or Undo", () => {
    const { document, storage } = startAppTest();
    selectAppCell(document, "A1");
    typeAppNumber(document, "1");
    const input = getAppInput(document);
    assert(input.emit("keydown", input, { key: "Enter" }).defaultPrevented);
    assertEqual(getAppInput(document), null);
    assertEqual(document.getElementById("cell-A1").textContent, "Start");
    assertEqual(document.getElementById("app-status").textContent, "Use two digits from 1–6.");
    assertEqual(storage.getItem(STORAGE_KEY), null);
    assertEqual(document.getElementById("undo-move").disabled, true);
  });

  test("Composition finishes before auto-placement and duplicate composition events cannot place twice", () => {
    const { document, storage } = startAppTest();
    selectAppCell(document, "A1");
    const input = getAppInput(document);
    input.value = "16";
    input.emit("input", input, { isComposing: true });
    assertEqual(storage.getItem(STORAGE_KEY), null);
    input.emit("keydown", input, { key: "Enter", isComposing: true });
    assertEqual(storage.getItem(STORAGE_KEY), null);
    input.emit("compositionend");
    const saved = storage.getItem(STORAGE_KEY);
    assertDeepEqual(loadGame(storage).state.board, boardFixture(["A1", 16]));
    input.emit("input");
    assertEqual(storage.getItem(STORAGE_KEY), saved);
  });

  test("Success and errors replace each other in one status without changing rejected board state or Undo", () => {
    const { document, storage } = startAppTest();
    const status = document.getElementById("app-status");
    const area = status.parentNode;
    submitAppNumber(document, "A1", 15);
    submitAppNumber(document, "B1", 24);
    assertEqual(status.textContent, "Placed 24 at B1.");
    const saved = storage.getItem(STORAGE_KEY);
    const state = loadGame(storage).state;
    submitAppNumber(document, "B2", 35);
    assertEqual(status.textContent, "Must match 24 above.");
    assertEqual(status.hidden, false);
    assertEqual(status.className, "app-status");
    assertEqual(status.parentNode, area);
    assertEqual(document.getElementById("entry-feedback"), null);
    assertEqual(document.getElementById("cell-B2").dataset.state, "empty");
    assertEqual(getAppInput(document), null);
    assertEqual(storage.getItem(STORAGE_KEY), saved);
    assertDeepEqual(loadGame(storage).state, state);
    assertEqual(document.getElementById("current-score").textContent, "39");
    assertEqual(document.getElementById("undo-move").disabled, false);
    submitAppNumber(document, "B2", 24);
    assertEqual(status.textContent, "Placed 24 at B2.");
    assertEqual(status.className, "app-status");
    assertEqual(status.parentNode, area);
    document.runTimers();
    assertEqual(status.textContent, "Placed 24 at B2.");
    assertDeepEqual(loadGame(storage).state.board[1][1], { value: 24, status: "normal" });
  });

  test("Undo discards a one-digit inline draft while restoring its existing snapshot", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 16);
    selectAppCell(document, "B1");
    const oldInput = getAppInput(document);
    typeAppNumber(document, "2");
    document.getElementById("undo-move").emit("click");
    assertEqual(getAppInput(document), null);
    assertDeepEqual(loadGame(storage).state, createGameState());
    oldInput.value = "24";
    oldInput.emit("input");
    assertDeepEqual(loadGame(storage).state, createGameState());
  });

  test("D7 flag returns after blur, outside tap, illegal placement, or malformed input without saving", () => {
    const initial = serializeGame({ board: boardFixture(["C7", 46]), undo: null });
    for (const action of ["blur", "outside tap", "illegal", "malformed"]) {
      const { document, storage } = startAppTest(initial);
      assertGoalFlag(document.getElementById("cell-D7"));
      selectAppCell(document, "D7");
      assertEqual(getAppInput(document).dataset.coordinate, "D7");
      assertNoGoalFlag(getAppInput(document));
      typeAppNumber(document, "5");
      if (action === "blur") document.getElementById("game-board").focus();
      else if (action === "outside tap") document.emit("pointerdown", document.root);
      else typeAppNumber(document, action === "illegal" ? "24" : "70");
      assertGoalFlag(document.getElementById("cell-D7"));
      assertEqual(getAppInput(document), null);
      assertEqual(document.getElementById("undo-move").disabled, true);
      assertEqual(storage.getItem(STORAGE_KEY), initial);
    }
  });

  test("Occupied D7 never shows the flag across normal, Prime Ice, Attack Ice, and Street states", () => {
    const normal = boardFixture(["D7", 22]);
    const attack = boardFixture(["D7", 22]);
    attack[6][3].attackIce = true;
    const street = boardFixture(["A7", 41], ["B7", 42], ["C7", 43], ["D7", 44]);
    for (const [board, value, multiplier, ice] of [
      [normal, "22", "2x", null],
      [boardFixture(["D7", 53, "frozen"]), "53", null, "./assets/icecube.png"],
      [boardFixture(["D7", 53, "thawed"]), "53", null, null],
      [attack, "22", "2x", "./assets/icecube2.png"],
      [street, "44", "4x", null],
    ]) {
      const { document } = startAppTest(serializeGame({ board, undo: null }));
      const cell = document.getElementById("cell-D7");
      assertNoGoalFlag(cell);
      assertEqual(cell.querySelectorAll("span").at(-1).textContent, value);
      assertAppMultiplier(document, "D7", multiplier);
      assertEqual(cell.querySelector("img")?.src ?? null, ice);
    }
  });

  test("Confirmed Reset restores the D7 flag from an occupied goal without adding flag state", () => {
    const { document, storage } = startAppTest(serializeGame({ board: boardFixture(["D7", 22]), undo: null }));
    assertNoGoalFlag(document.getElementById("cell-D7"));
    document.getElementById("new-game").emit("click");
    assertNoGoalFlag(document.getElementById("cell-D7"));
    document.getElementById("confirm-new-game").emit("click");
    assertGoalFlag(document.getElementById("cell-D7"));
    assertEqual(storage.getItem(STORAGE_KEY), null);
    assertEqual(document.getElementById("goal-status").hidden, true);
  });

  return results;
}
