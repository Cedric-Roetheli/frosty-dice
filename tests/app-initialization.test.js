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
    this.text = "";
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
  emit(type, target = this, properties = {}) {
    const event = { target, ...properties, preventDefault() { this.defaultPrevented = true; } };
    for (const handler of this.listeners[type] ?? []) handler(event);
    return event;
  }
  focus() { this.document.activeElement = this; }
}

function appTestDocument() {
  const document = {
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
  const board = add("table", "game-board");
  add("thead", "board-columns", board);
  add("tbody", "board-rows", board);
  for (const [tag, id] of [
    ["p", "app-status"], ["p", "storage-status"], ["strong", "current-score"],
    ["p", "street-bonus"], ["p", "goal-status"], ["button", "new-game"],
  ]) add(tag, id);
  const form = add("form", "number-entry-form");
  const label = add("label", "number-label", form);
  add("span", "selected-cell", label);
  add("input", "number-input", form);
  add("button", "cancel-entry", form);
  add("p", "entry-feedback", form);
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
  document.getElementById("app-status").textContent = "Loading board…";
  return document;
}

function appTestStorage(serialized = null) {
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

function selectAppCell(document, coordinate) {
  const cell = document.getElementById("cell-" + coordinate);
  document.getElementById("board-rows").emit("click", cell.querySelector("span") ?? cell);
}

function typeAppNumber(document, value) {
  const input = document.getElementById("number-input");
  input.value = String(value);
  input.emit("input");
}

function submitAppNumber(document, coordinate, value) {
  selectAppCell(document, coordinate);
  typeAppNumber(document, value);
  return document.getElementById("number-entry-form").emit("submit");
}

function assertNoMoveHints(document) {
  for (const cell of document.getElementById("board-rows").querySelectorAll("button")) {
    assert(!cell.className.includes("--legal"));
    assert(!cell.getAttribute("aria-label").includes("legal target"));
  }
  assertEqual(document.getElementById("board-rows").querySelectorAll("button[data-number]").length, 0);
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
    assertEqual(document.getElementById("number-entry-form").hidden, true);
    assertEqual(storage.getItem(STORAGE_KEY), null);
    for (const cell of document.getElementById("board-rows").querySelectorAll("button")) {
      assertEqual(cell.disabled, false);
      assertEqual(cell.getAttribute("aria-pressed"), "false");
      assertEqual(cell.textContent, "");
      assert(cell.getAttribute("aria-label").includes(cell.dataset.coordinate));
    }
    assertDeepEqual(document.getElementById("board-columns").querySelectorAll("th").map((heading) => heading.textContent), ["A", "B", "C", "D"]);
    assertDeepEqual(document.getElementById("board-rows").querySelectorAll("th").map((heading) => heading.textContent), ["1", "2", "3", "4", "5", "6", "7"]);
    assertNoMoveHints(document);
  });

  test("Selecting any empty cell opens numeric entry and focuses it without validating the move", () => {
    const { document, storage } = startAppTest();
    selectAppCell(document, "D7"); // Illegal on an empty board, but selection must reveal no legality.
    const selected = document.getElementById("cell-D7");
    assertEqual(selected.getAttribute("aria-pressed"), "true");
    assert(selected.className.includes("--selected"));
    assertEqual(selected.textContent, "");
    assertEqual(document.getElementById("selected-cell").textContent, "D7");
    assertEqual(document.getElementById("number-entry-form").hidden, false);
    assertEqual(document.activeElement, document.getElementById("number-input"));
    typeAppNumber(document, 16);
    assertEqual(document.getElementById("entry-feedback").hidden, true);
    assertEqual(storage.getItem(STORAGE_KEY), null);
    assertNoMoveHints(document);
    for (const cell of document.getElementById("board-rows").querySelectorAll("button")) {
      assertEqual(cell.disabled, false);
    }
  });

  test("Legal submission saves only the board, updates score, and closes entry", () => {
    const { document, storage } = startAppTest();
    const event = submitAppNumber(document, "A1", 16);
    assert(event.defaultPrevented);
    assertDeepEqual(loadGame(storage).state, { board: boardFixture(["A1", 16]), undo: { board: boardFixture() } });
    assertDeepEqual(Object.keys(JSON.parse(storage.getItem(STORAGE_KEY)).state), ["board", "undo"]);
    assertEqual(document.getElementById("current-score").textContent, "16");
    assertEqual(document.getElementById("cell-A1").disabled, false);
    assertEqual(document.getElementById("number-entry-form").hidden, true);
    assertEqual(document.getElementById("number-input").value, "");
    assertEqual(document.getElementById("selected-cell").textContent, "");
    assertEqual(document.activeElement, document.getElementById("game-board"));
  });

  test("Repeated-digit numbers use ordinary entry without roll counts or special actions", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 33);
    assertDeepEqual(JSON.parse(storage.getItem(STORAGE_KEY)).state, { board: boardFixture(["A1", 33]), undo: { board: boardFixture() } });
    assertEqual(document.getElementById("current-score").textContent, "33");
    assertEqual(document.getElementById("number-entry-form").hidden, true);
    assertEqual(document.getElementById("schnapszahl-panel"), null);
  });

  test("An illegal first placement leaves the board unchanged and keeps the selected cell editable", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "B1", 16);
    assertEqual(storage.getItem(STORAGE_KEY), null);
    assertEqual(document.getElementById("cell-B1").dataset.state, "empty");
    assertEqual(document.getElementById("current-score").textContent, "0");
    assertEqual(document.getElementById("selected-cell").textContent, "B1");
    assertEqual(document.getElementById("number-entry-form").hidden, false);
    assertEqual(document.getElementById("number-input").value, "16");
    assertEqual(document.getElementById("entry-feedback").textContent, "Place your first number at A1.");
    assertNoMoveHints(document);
  });

  test("A rejected horizontal value can be corrected without reselecting the cell", () => {
    const serialized = serializeGame({ board: boardFixture(["A1", 16]) });
    const { document, storage } = startAppTest(serialized);
    submitAppNumber(document, "B1", 12);
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
    assertEqual(document.getElementById("entry-feedback").textContent, "Must be greater than 16 to the left.");
    assertEqual(document.getElementById("number-input").getAttribute("aria-invalid"), "true");
    typeAppNumber(document, 24);
    assertEqual(document.getElementById("number-input").getAttribute("aria-invalid"), null);
    assertEqual(document.getElementById("entry-feedback").hidden, true);
    document.getElementById("number-entry-form").emit("submit");
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
      assertEqual(document.getElementById("entry-feedback").textContent, message);
      assertEqual(document.getElementById("selected-cell").textContent, target);
    });
  }

  test("Conflicting neighbors produce a general error, and either valid connection still suffices", () => {
    const serialized = serializeGame({ board: boardFixture(["A1", 16], ["B1", 24], ["A2", 16]) });
    const { document, storage } = startAppTest(serialized);
    submitAppNumber(document, "B2", 12);
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
    assertEqual(document.getElementById("entry-feedback").textContent, "This number doesn't fit next to any usable neighboring number.");
    typeAppNumber(document, 26); // Horizontal connection succeeds, vertical connection disagrees.
    document.getElementById("number-entry-form").emit("submit");
    assertDeepEqual(loadGame(storage).state.board[1][1], { value: 26, status: "normal" });
    assertEqual(document.getElementById("current-score").textContent, "82");
  });

  test("A cell without a usable neighbor is rejected only after submission", () => {
    const serialized = serializeGame({ board: boardFixture(["A1", 16]) });
    const { document, storage } = startAppTest(serialized);
    selectAppCell(document, "D7");
    assertEqual(document.getElementById("entry-feedback").hidden, true);
    typeAppNumber(document, 16);
    document.getElementById("number-entry-form").emit("submit");
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
    assertEqual(document.getElementById("entry-feedback").textContent, "This number doesn't fit next to any usable neighboring number.");
  });

  test("Invalid dice numbers never change the board or save", () => {
    const { document, storage } = startAppTest();
    selectAppCell(document, "A1");
    for (const value of ["7", "10", "17", "28", "60", "70", "123", "0", "word", "", " 16"]) {
      typeAppNumber(document, value);
      document.getElementById("number-entry-form").emit("submit");
      assertEqual(storage.getItem(STORAGE_KEY), null);
      assertEqual(document.getElementById("cell-A1").dataset.state, "empty");
      assertEqual(document.getElementById("selected-cell").textContent, "A1");
      assertEqual(document.getElementById("number-input").value, value);
      assertEqual(document.getElementById("entry-feedback").textContent, "Use two digits from 1–6.");
      assertEqual(document.getElementById("current-score").textContent, "0");
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
      typeAppNumber(document, 46);
      document.getElementById("number-entry-form").emit("submit");
      assertEqual(document.getElementById("number-entry-form").hidden, true);
      assertEqual(document.getElementById("selected-cell").textContent, "");
      assertEqual(document.getElementById("attack-ice-actions").hidden, status === "frozen");
      if (status !== "frozen") assertEqual(document.getElementById("toggle-attack-ice").textContent, "Freeze");
      assertEqual(document.getElementById("cell-actions"), null);
      assertEqual(document.getElementById("edit-cell"), null);
      assertEqual(storage.getItem(STORAGE_KEY), serialized);
    });
  }

  test("A repeated submit or stale former-empty button cannot place twice", () => {
    const { document, storage } = startAppTest();
    const oldButton = document.getElementById("cell-A1");
    submitAppNumber(document, "A1", 16);
    const serialized = storage.getItem(STORAGE_KEY);
    document.getElementById("number-entry-form").emit("submit");
    document.getElementById("board-rows").emit("click", oldButton);
    assertEqual(document.getElementById("number-entry-form").hidden, true);
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
  });

  test("Selecting another empty cell discards the old draft and selection", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "B1", 16);
    selectAppCell(document, "A1");
    assertEqual(document.getElementById("cell-B1").getAttribute("aria-pressed"), "false");
    assertEqual(document.getElementById("cell-A1").getAttribute("aria-pressed"), "true");
    assertEqual(document.getElementById("selected-cell").textContent, "A1");
    assertEqual(document.getElementById("number-input").value, "");
    assertEqual(document.getElementById("number-input").getAttribute("aria-invalid"), null);
    assertEqual(document.getElementById("entry-feedback").hidden, true);
    assertEqual(storage.getItem(STORAGE_KEY), null);
  });

  test("Tapping the selected cell again keeps its draft without attempting placement", () => {
    const { document, storage } = startAppTest();
    selectAppCell(document, "A1");
    typeAppNumber(document, 16);
    selectAppCell(document, "A1");
    assertEqual(document.getElementById("number-input").value, "16");
    assertEqual(document.getElementById("selected-cell").textContent, "A1");
    assertEqual(document.getElementById("entry-feedback").hidden, true);
    assertEqual(storage.getItem(STORAGE_KEY), null);
  });

  for (const cancelWith of ["Cancel", "outside tap", "Escape", "occupied-cell tap"]) {
    test(cancelWith + " safely cancels a draft without changing the board or freeze", () => {
      const serialized = serializeGame({ board: boardFixture(["A1", 23], ["B1", 31, "frozen"]) });
      const { document, storage } = startAppTest(serialized);
      selectAppCell(document, "A2");
      typeAppNumber(document, 23);
      if (cancelWith === "Cancel") document.getElementById("cancel-entry").emit("click");
      else if (cancelWith === "Escape") document.emit("keydown", document.root, { key: "Escape" });
      else document.emit("pointerdown", cancelWith === "outside tap" ? document.root : document.getElementById("cell-B1"));
      assertEqual(document.getElementById("number-entry-form").hidden, true);
      assertEqual(document.getElementById("selected-cell").textContent, "");
      assertEqual(document.getElementById("number-input").value, "");
      assertEqual(document.getElementById("cell-A2").getAttribute("aria-pressed"), "false");
      assertFrozenCell(document.getElementById("cell-B1"));
      assertEqual(storage.getItem(STORAGE_KEY), serialized);
    });
  }

  test("Tapping inside entry keeps the draft; tapping another empty cell can select it", () => {
    const { document, storage } = startAppTest();
    selectAppCell(document, "A1");
    typeAppNumber(document, 16);
    document.emit("pointerdown", document.getElementById("number-input"));
    assertEqual(document.getElementById("number-input").value, "16");
    assertEqual(document.getElementById("number-entry-form").hidden, false);
    document.emit("pointerdown", document.getElementById("cell-B1"));
    selectAppCell(document, "B1");
    assertEqual(document.getElementById("selected-cell").textContent, "B1");
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
      assertEqual(currentDocument.getElementById("board-rows").querySelectorAll("img").length,
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
      typeAppNumber(document, value);
      assert(storage.getItem(STORAGE_KEY) === before, "Selection and drafts must not save or change statuses");
      document.getElementById("number-entry-form").emit("submit");
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
    assertEqual(document.getElementById("number-entry-form").hidden, false);
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
    assertEqual(document.getElementById("current-score").textContent, "146");
    assertEqual(document.getElementById("goal-status").hidden, false);
    assertEqual(document.getElementById("street-bonus").hidden, false);
    assert(document.getElementById("board-rows").children[0].className.includes("street"));
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
  });

  test("Completing a Street updates the score and row marker through the input flow", () => {
    const { document, storage } = startAppTest();
    for (const [coordinate, value, score] of [["A1", 11, 11], ["B1", 12, 23], ["C1", 13, 36], ["D1", 14, 100]]) {
      submitAppNumber(document, coordinate, value);
      assertEqual(document.getElementById("current-score").textContent, String(score));
    }
    assertEqual(document.getElementById("street-bonus").hidden, false);
    assert(document.getElementById("board-rows").children[0].className.includes("street"));
    assertDeepEqual(loadGame(storage).state.board[0].map((cell) => cell.value), [11, 12, 13, 14]);
  });

  test("A legal non-frozen D7 placement displays goal status without stopping entry", () => {
    const { document } = startAppTest(serializeGame({ board: boardFixture(["C7", 46]) }));
    assert(document.getElementById("goal-status").hidden);
    submitAppNumber(document, "D7", 55);
    assertEqual(document.getElementById("goal-status").hidden, false);
    selectAppCell(document, "D6");
    assertEqual(document.getElementById("number-entry-form").hidden, false);
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
      assertEqual(document.getElementById("number-entry-form").hidden, true);
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
    assertEqual(document.getElementById("number-entry-form").hidden, true);
  });

  test("Reset requires confirmation and clears the save and transient entry state", () => {
    const serialized = serializeGame({ board: boardFixture(["A1", 23], ["B1", 31, "frozen"]) });
    const { document, storage } = startAppTest(serialized);
    const confirm = document.getElementById("confirm-new-game");
    confirm.emit("click");
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
    selectAppCell(document, "A2");
    typeAppNumber(document, 23);
    document.getElementById("new-game").emit("click");
    assertEqual(document.getElementById("number-entry-form").hidden, true);
    assertEqual(document.getElementById("number-input").value, "");
    document.getElementById("cancel-new-game").emit("click");
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
    document.getElementById("new-game").emit("click");
    confirm.emit("click");
    assertAppBoardReady(document);
    assertEqual(storage.getItem(STORAGE_KEY), null);
    assertEqual(document.getElementById("current-score").textContent, "0");
    assertEqual(document.getElementById("number-entry-form").hidden, true);
    assertEqual(document.getElementById("board-rows").querySelectorAll("img").length, 0);
    for (const cell of document.getElementById("board-rows").querySelectorAll("button")) assert(!cell.disabled);
  });

  test("Selecting a cell dismisses a pending reset so its old confirmation cannot clear the game", () => {
    const serialized = serializeGame({ board: boardFixture(["A1", 16]) });
    const { document, storage } = startAppTest(serialized);
    document.getElementById("new-game").emit("click");
    selectAppCell(document, "B1");
    document.getElementById("confirm-new-game").emit("click");
    assertEqual(document.getElementById("reset-confirmation").hidden, true);
    assertEqual(document.getElementById("selected-cell").textContent, "B1");
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
    assertEqual(document.getElementById("undo-move").disabled, false);
    document.getElementById("undo-move").emit("click");
    assertDeepEqual(loadGame(storage).state, createGameState());
    assertEqual(document.getElementById("cell-A1").dataset.state, "empty");
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
    assertEqual(reloaded.getElementById("board-rows").querySelectorAll("img").length, 1);
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

  test("Cancel and outside taps leave an existing Undo snapshot available and unchanged", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 16);
    const saved = storage.getItem(STORAGE_KEY);
    for (const action of ["Cancel", "outside"]) {
      selectAppCell(document, "B1");
      typeAppNumber(document, 24);
      if (action === "Cancel") document.getElementById("cancel-entry").emit("click");
      else document.emit("pointerdown", document.root);
      assertEqual(storage.getItem(STORAGE_KEY), saved);
      assertEqual(document.getElementById("undo-move").disabled, false);
    }
  });

  test("Undo closes an open rejected draft and clears selection, input, and errors", () => {
    const { document, storage } = startAppTest();
    submitAppNumber(document, "A1", 16);
    submitAppNumber(document, "B1", 12);
    document.emit("pointerdown", document.getElementById("undo-move"));
    document.getElementById("undo-move").emit("click");
    assertEqual(document.getElementById("number-entry-form").hidden, true);
    assertEqual(document.getElementById("selected-cell").textContent, "");
    assertEqual(document.getElementById("number-input").value, "");
    assertEqual(document.getElementById("number-input").getAttribute("aria-invalid"), null);
    assertEqual(document.getElementById("entry-feedback").hidden, true);
    assertDeepEqual(loadGame(storage).state, createGameState());
    document.getElementById("number-entry-form").emit("submit");
    assertDeepEqual(loadGame(storage).state, createGameState());
    for (const cell of document.getElementById("board-rows").querySelectorAll("button")) {
      assertEqual(cell.getAttribute("aria-pressed"), "false");
    }
  });

  test("An unavailable Undo tap does nothing, including leaving an open draft intact", () => {
    const { document, storage } = startAppTest();
    selectAppCell(document, "A1");
    typeAppNumber(document, 16);
    const undo = document.getElementById("undo-move");
    document.emit("pointerdown", undo.querySelector("span"));
    undo.emit("click");
    assertEqual(document.getElementById("selected-cell").textContent, "A1");
    assertEqual(document.getElementById("number-input").value, "16");
    assertEqual(document.getElementById("number-entry-form").hidden, false);
    assertEqual(storage.getItem(STORAGE_KEY), null);
  });

  test("Undo removes a completed Street and restores the previous visible score and row state", () => {
    const { document, storage } = startAppTest();
    for (const [coordinate, value] of [["A1", 11], ["B1", 12], ["C1", 13], ["D1", 14]]) {
      submitAppNumber(document, coordinate, value);
    }
    assertEqual(document.getElementById("current-score").textContent, "100");
    assertEqual(document.getElementById("street-bonus").hidden, false);
    document.getElementById("undo-move").emit("click");
    assertEqual(document.getElementById("current-score").textContent, "36");
    assertEqual(document.getElementById("street-bonus").hidden, true);
    assert(!document.getElementById("board-rows").children[0].className.includes("street"));
    assertEqual(loadGame(storage).state.board[0][3], null);
  });

  test("Undo of the D7 placement removes visible goal feedback and restores the previous score", () => {
    const { document, storage } = startAppTest(serializeGame({ board: boardFixture(["C7", 46]) }));
    submitAppNumber(document, "D7", 55);
    assertEqual(document.getElementById("goal-status").hidden, false);
    assertEqual(document.getElementById("current-score").textContent, "101");
    document.getElementById("undo-move").emit("click");
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
    assertEqual(document.getElementById("number-entry-form").hidden, true);
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
    assertEqual(document.getElementById("number-entry-form").hidden, true);
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
    assertEqual(document.getElementById("board-rows").querySelectorAll("img").length, 1);
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
    assertEqual(document.getElementById("current-score").textContent, "50");
    assertEqual(document.getElementById("street-bonus").hidden, true);
    assert(!document.getElementById("board-rows").children[0].className.includes("street"));
    applyAppAttackAction(document, "B1");
    assertEqual(document.getElementById("current-score").textContent, "100");
    assertEqual(document.getElementById("street-bonus").hidden, false);
    assert(document.getElementById("board-rows").children[0].className.includes("street"));
    document.getElementById("undo-move").emit("click");
    assertEqual(document.getElementById("current-score").textContent, "50");
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
        assertEqual(document.getElementById("number-entry-form").hidden, false);
        assertEqual(document.getElementById("number-input").value, "");
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
    const saved = storage.getItem(STORAGE_KEY);
    const occupied = document.getElementById("cell-A1");
    document.emit("pointerdown", occupied);
    selectAppCell(document, "A1");
    assertEqual(document.getElementById("number-input").value, "");
    assertEqual(document.getElementById("entry-feedback").hidden, true);
    assertEqual(document.getElementById("number-entry-form").hidden, true);
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
    assertEqual(document.getElementById("board-rows").querySelectorAll("img").length, 0);
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

  test("Version 5 loads with Undo intact and the next Freeze writes version 6", () => {
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

  test("Attack Ice introduces no Challenge, Edit, roll, player, or permission interface", () => {
    const { document } = startAppTest();
    assertEqual(document.getElementById("attack-ice-actions").hidden, true);
    for (const id of ["challenge", "challenge-button", "edit-cell", "edit-number", "player-select", "opponents", "own-roll-form", "permissions"]) {
      assertEqual(document.getElementById(id), null);
    }
  });

  return results;
}
