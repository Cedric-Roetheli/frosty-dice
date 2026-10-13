import { initializeApp } from "../js/app.js";
import { createGameState, placeGameNumber } from "../js/game.js";
import { STORAGE_KEY, loadGame, serializeGame } from "../js/storage.js";
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
    const match = /^([a-z]+)(?:\[([a-z-]+)(?:=['"]([^'"]+)['"])?\])?$/.exec(selector);
    if (!match || this.tagName !== match[1]) return false;
    return !match[2] || (this.getAttribute(match[2]) !== null && (!match[3] || this.getAttribute(match[2]) === match[3]));
  }
  querySelectorAll(selector) { return this.descendants().filter((node) => node.matches(selector)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) ?? null; }
  addEventListener(type, handler) { (this.listeners[type] ??= []).push(handler); }
  emit(type, target = this) { for (const handler of this.listeners[type] ?? []) handler({ target, preventDefault() {} }); }
  focus() { this.document.activeElement = this; }
  reset() {
    for (const input of this.querySelectorAll("input")) {
      if (input.type === "radio") input.checked = false;
      else input.value = "";
    }
  }
}

function appTestDocument() {
  const document = {
    createElement(tag) { return new AppTestElement(tag, this); },
    createDocumentFragment() { return this.createElement("#fragment"); },
    getElementById(id) { return this.root.descendants().find((node) => node.id === id) ?? null; },
  };
  document.root = document.createElement("#root");
  function add(tag, id, parent = document.root) {
    const node = document.createElement(tag);
    node.id = id;
    parent.append(node);
    return node;
  }
  for (const [tag, id] of [
    ["thead", "board-columns"], ["tbody", "board-rows"], ["h3", "number-heading"],
    ["div", "number-options"], ["p", "placement-help"], ["div", "placement-controls"],
    ["p", "app-status"], ["p", "storage-status"], ["span", "board-mode"],
    ["strong", "current-score"], ["p", "street-bonus"], ["p", "goal-status"],
    ["section", "roll-panel"], ["h2", "roll-heading"], ["button", "next-roll"],
    ["button", "take-failed-roll"], ["p", "take-help"], ["button", "new-game"],
    ["div", "reset-confirmation"], ["button", "cancel-new-game"], ["button", "confirm-new-game"],
  ]) add(tag, id);
  const form = add("form", "own-roll-form");
  for (let die = 1; die <= 2; die += 1) {
    const group = add("fieldset", `die-${die}-group`, form);
    add("div", `die-${die}-values`, group);
  }
  add("button", "confirm-roll", form);
  const numberForm = add("form", "external-number-form");
  add("input", "external-number", numberForm);
  add("button", "cancel-external-number", numberForm);
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

function enterAppNumber(document, mode, value) {
  if (mode === "pair") {
    document.getElementById("next-roll").emit("click");
    const form = document.getElementById("own-roll-form");
    form.emit("change", document.getElementById(`die-1-${Math.floor(value / 10)}`));
    form.emit("change", document.getElementById(`die-2-${value % 10}`));
    form.emit("submit");
    const choices = document.getElementById("number-options");
    const option = choices.querySelector(`button[data-number='${value}']`);
    assert(option && !option.disabled, `${value} must have a legal placement`);
    choices.emit("click", option.querySelector("span"));
  } else {
    document.getElementById("take-failed-roll").emit("click");
    const input = document.getElementById("external-number");
    input.value = String(value);
    input.emit("input");
    document.getElementById("external-number-form").emit("submit");
  }
}

export function runAppInitializationTests() {
  const results = [];
  function test(name, action) {
    try { action(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, message: error.message }); }
  }

  test("App initialization renders all 28 cells and enables an empty entry form", () => {
    const { document, storage } = startAppTest();
    assertAppBoardReady(document);
    assertEqual(document.getElementById("current-score").textContent, "0");
    assertEqual(document.getElementById("own-roll-form").hidden, false);
    assertEqual(document.getElementById("confirm-roll").disabled, true);
    assertEqual(document.getElementById("next-roll").hidden, true);
    assertEqual(storage.getItem(STORAGE_KEY), null);
  });

  test("Restored cell records show numeric values and frozen status without counting frozen points", () => {
    const serialized = serializeGame({ board: boardFixture(["A1", 11], ["B1", 13, "frozen"]) });
    const { document, storage } = startAppTest(serialized);
    assertAppBoardReady(document);
    const cell = document.getElementById("cell-B1");
    assertEqual(cell.dataset.frozen, "true");
    assertFrozenCell(cell);
    assert(cell.textContent.includes("13"));
    assert(!cell.textContent.includes("[object Object]"));
    assert(cell.getAttribute("aria-label").includes("0 points"));
    assert(cell.disabled);
    assertEqual(document.getElementById("current-score").textContent, "11");
    assert(document.getElementById("goal-status").hidden);
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
  });

  test("Thawed values stay visibly scoreless and enable legal neighboring targets", () => {
    const { document } = startAppTest(serializeGame({ board: boardFixture(
      ["A1", 23], ["B1", 31, "thawed"], ["A2", 23, "frozen"],
    ) }));
    assertAppBoardReady(document);
    const thawed = document.getElementById("cell-B1");
    assertEqual(thawed.dataset.state, "thawed");
    assertEqual(thawed.dataset.frozen, "false");
    assertEqual(thawed.querySelector("img"), null);
    assert(thawed.textContent.includes("Thawed") && thawed.textContent.includes("31"));
    assert(thawed.getAttribute("aria-label").includes("permanently 0 points"));
    assert(thawed.getAttribute("aria-label").includes("usable placement neighbor"));
    assert(thawed.disabled); // Occupied cells cannot be overwritten.
    assertEqual(document.getElementById("current-score").textContent, "23");
    document.getElementById("take-failed-roll").emit("click");
    document.getElementById("external-number").value = "46";
    document.getElementById("external-number-form").emit("submit");
    assertEqual(document.getElementById("cell-C1").disabled, false);
  });

  for (const mode of ["pair", "manual"]) {
    test(`${mode} input → placement → save → render → reload moves the freeze for A1=23, B1=31, A2=23`, () => {
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
        const frozenCount = entries.filter((entry) => entry[2] === "frozen").length;
        assertEqual(currentDocument.getElementById("board-rows").querySelectorAll("img").length, frozenCount);
        for (const [coordinate, value, status = "normal"] of entries) {
          const cell = currentDocument.getElementById(`cell-${coordinate}`);
          assertEqual(cell.dataset.state, status);
          assertEqual(cell.dataset.frozen, String(status === "frozen"));
          assertEqual(cell.querySelectorAll("span").at(-1).textContent, String(value));
          assert(cell.disabled, "Occupied cells cannot be overwritten");
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
        enterAppNumber(document, mode, value);
        assert(storage.getItem(STORAGE_KEY) === before, "Input previews must not change saved statuses");
        const target = document.getElementById(`cell-${coordinate}`);
        assertEqual(target.disabled, false); // C1 depends exclusively on thawed B1.
        document.getElementById("board-rows").emit("click", target.querySelector("span"));

        const entries = expectedStages[index];
        const expected = { board: boardFixture(...entries) };
        const serialized = storage.getItem(STORAGE_KEY);
        assertDeepEqual(JSON.parse(serialized), { version: 3, state: expected });
        assertDeepEqual(loadGame(storage).state, expected);
        const score = index === 3 ? 69 : 23; // B1 and A2 contribute zero even after thawing.
        verifyRenderedState(document, entries, score);

        // Exercise another render in the live coordinator without changing game state.
        document.getElementById("new-game").emit("click");
        document.getElementById("cancel-new-game").emit("click");
        verifyRenderedState(document, entries, score);
        assertEqual(storage.getItem(STORAGE_KEY), serialized);

        // Reinitialize through the same public entry point against the actual saved bytes.
        const reloadedDocument = appTestDocument();
        initializeApp(reloadedDocument, storage);
        verifyRenderedState(reloadedDocument, entries, score);
        assertEqual(storage.getItem(STORAGE_KEY), serialized);
        if (index === 2) {
          enterAppNumber(reloadedDocument, mode, 46);
          assertEqual(reloadedDocument.getElementById("cell-C1").disabled, false);
          assertEqual(storage.getItem(STORAGE_KEY), serialized);
        }
      }
    });
  }

  test("Restoration derives Street bonuses and a normal D7 goal", () => {
    const { document } = startAppTest(serializeGame({ board: boardFixture(
      ["A1", 11], ["B1", 12], ["C1", 13], ["D1", 14], ["D7", 46],
    ) }));
    assertAppBoardReady(document);
    assertEqual(document.getElementById("current-score").textContent, "146");
    assertEqual(document.getElementById("goal-status").hidden, false);
    assertEqual(document.getElementById("street-bonus").hidden, false);
    assert(document.getElementById("board-rows").children[0].className.includes("street"));
  });

  test("Old numeric saves and malformed data start safely without deleting the original record", () => {
    const board = Array.from({ length: 7 }, () => Array(4).fill(null));
    board[0][0] = 16;
    for (const serialized of ["{", JSON.stringify({ version: 1, state: { board, ownRollCount: 5 } }),
      JSON.stringify({ version: 2, state: { board } }), JSON.stringify({ version: 3, state: { board } })]) {
      const { document, storage } = startAppTest(serialized);
      assertAppBoardReady(document);
      assertEqual(document.getElementById("current-score").textContent, "0");
      assertEqual(document.getElementById("own-roll-form").hidden, false);
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
    for (const version of [2, 3]) {
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

  test("Pair preview is UI-only and its placement uses the frozen-prime rule", () => {
    const serialized = serializeGame(placeGameNumber(createGameState(), "A1", 11));
    const { document, storage } = startAppTest(serialized);
    const form = document.getElementById("own-roll-form");
    form.emit("change", document.getElementById("die-1-1"));
    form.emit("change", document.getElementById("die-2-3"));
    assertEqual(document.getElementById("confirm-roll").disabled, false);
    form.emit("submit");
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
    const target = document.getElementById("cell-B1");
    assertEqual(target.disabled, false);
    document.getElementById("board-rows").emit("click", target);
    assertDeepEqual(loadGame(storage).state.board[0][1], { value: 13, status: "frozen" });
    assertDeepEqual(Object.keys(JSON.parse(storage.getItem(STORAGE_KEY)).state), ["board"]);
    assertEqual(document.getElementById("current-score").textContent, "11");
    assertFrozenCell(document.getElementById("cell-B1"));
    const after = storage.getItem(STORAGE_KEY);
    document.getElementById("board-rows").emit("click", target);
    assertEqual(storage.getItem(STORAGE_KEY), after);
  });

  test("Manual entry shares the guarded placement rule and cannot use frozen neighbors", () => {
    const serialized = serializeGame({ board: boardFixture(["A1", 11], ["B1", 13, "frozen"]) });
    const { document, storage } = startAppTest(serialized);
    document.getElementById("take-failed-roll").emit("click");
    const input = document.getElementById("external-number");
    const form = document.getElementById("external-number-form");
    input.value = "24";
    form.emit("submit");
    const blocked = document.getElementById("cell-C1");
    assert(blocked.disabled);
    blocked.disabled = false; // The core must guard against a stale/tampered UI.
    document.getElementById("board-rows").emit("click", blocked);
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
    input.value = "11";
    input.emit("input");
    form.emit("submit");
    const target = document.getElementById("cell-A2");
    assertEqual(target.disabled, false);
    document.getElementById("board-rows").emit("click", target);
    assertDeepEqual(loadGame(storage).state.board[1][0], { value: 11, status: "frozen" });
    assertDeepEqual(loadGame(storage).state.board[0][1], { value: 13, status: "thawed" });
    assert(document.getElementById("cell-B1").textContent.includes("Thawed"));
    assertEqual(document.getElementById("current-score").textContent, "11");
  });

  test("Moving the freeze away from D7 displays its thawed goal without giving it points", () => {
    let state = createGameState();
    for (let row = 1; row <= 7; row += 1) state = placeGameNumber(state, `A${row}`, 12);
    for (const [coordinate, value] of [["B7", 24], ["C7", 41], ["D7", 53]]) {
      state = placeGameNumber(state, coordinate, value);
    }
    const { document, storage } = startAppTest(serializeGame(state));
    assert(document.getElementById("goal-status").hidden);
    assertFrozenCell(document.getElementById("cell-D7"));
    for (const [coordinate, value] of [["B1", 13], ["C1", 23]]) {
      document.getElementById("take-failed-roll").emit("click");
      document.getElementById("external-number").value = String(value);
      document.getElementById("external-number-form").emit("submit");
      document.getElementById("board-rows").emit("click", document.getElementById(`cell-${coordinate}`));
    }
    assertEqual(document.getElementById("goal-status").hidden, false);
    assert(document.getElementById("cell-D7").textContent.includes("Thawed"));
    assertEqual(document.getElementById("current-score").textContent, "162");
    assertDeepEqual(loadGame(storage).state.board[6][3], { value: 53, status: "thawed" });
    assertEqual(document.getElementById("cell-C1").dataset.state, "frozen");
  });

  test("Reset requires confirmation and clears the save and transient entry state", () => {
    const serialized = serializeGame({ board: boardFixture(["A1", 11], ["B1", 13, "frozen"]) });
    const { document, storage } = startAppTest(serialized);
    const confirm = document.getElementById("confirm-new-game");
    confirm.emit("click");
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
    document.getElementById("new-game").emit("click");
    document.getElementById("cancel-new-game").emit("click");
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
    document.getElementById("new-game").emit("click");
    confirm.emit("click");
    assertAppBoardReady(document);
    assertEqual(storage.getItem(STORAGE_KEY), null);
    assertEqual(document.getElementById("current-score").textContent, "0");
    assertEqual(document.getElementById("confirm-roll").disabled, true);
    assertEqual(document.getElementById("own-roll-form").hidden, false);
  });

  return results;
}
