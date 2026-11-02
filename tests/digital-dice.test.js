import { beginDiceRoll, createDiceState, deselectDigitalDie, DICE_REGION, DICE_STOP_TIMES, DIGITAL_DICE_EXPANDED_KEY, finishDiceRoll, getDigitalDiceLayout, initializeDigitalDice, randomDieValue, selectDigitalDie } from "../js/digital-dice.js";
import { initializeApp } from "../js/app.js";
import { confirmGameBid, createGameState, placeGameNumber } from "../js/game.js";
import { initializeRules, RULES_LANGUAGE_KEY } from "../js/rules.js";
import { serializeGame, STORAGE_KEY } from "../js/storage.js";
import { appTestStorage } from "./app-initialization.test.js";
import { rulesDocument } from "./rules.test.js";
import { assert, assertDeepEqual, assertEqual, assertThrows } from "./assert.js";

function fakeClock() {
  let now = 0;
  let sequence = 0;
  const pending = new Map();
  return {
    pending,
    setTimeout(callback, delay) { const id = ++sequence; pending.set(id, { callback, due: now + delay }); return id; },
    clearTimeout(id) { pending.delete(id); },
    advance(duration) {
      const target = now + duration;
      let work = 0;
      while (true) {
        const next = [...pending].sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
        if (!next || next[1].due > target) break;
        if (++work > 1000) throw new Error("Timer loop did not finish");
        now = next[1].due;
        pending.delete(next[0]);
        next[1].callback();
      }
      now = target;
    },
  };
}

// Existing roll/selection cases open the machine; null tests a fresh preference.
function fixture({ values = [2, 4, 4, 6], reduced = false, language = "en", game, placeholders = false, expanded = true, preferences } = {}) {
  const document = rulesDocument();
  const storage = appTestStorage(game ? serializeGame(game) : null);
  storage.setItem(RULES_LANGUAGE_KEY, language);
  if (expanded !== null) storage.setItem(DIGITAL_DICE_EXPANDED_KEY, String(expanded));
  initializeRules(document, storage);
  if (game) initializeApp(document, storage);
  const create = document.createElement.bind(document);
  function removable(node) {
    node.removeEventListener = (type, handler) => { node.listeners[type] = (node.listeners[type] ?? []).filter((entry) => entry !== handler); };
    return node;
  }
  document.root.descendants().forEach(removable);
  document.createElement = (tag) => removable(create(tag));
  function add(tag, id, parent = document.root) {
    const node = document.createElement(tag);
    node.id = id;
    parent.append(node);
    return node;
  }
  const machine = add("section", "digital-dice");
  const toggle = add("button", "digital-dice-toggle", machine);
  toggle.type = "button";
  toggle.setAttribute("aria-controls", "digital-dice-panel");
  add("span", "digital-dice-toggle-label", toggle);
  const panel = add("div", "digital-dice-panel", machine);
  panel.contains = (node) => node === panel || panel.descendants().includes(node);
  const inner = add("div", "digital-dice-panel-inner", panel);
  const frame = add("div", "digital-dice-frame", inner);
  add("p", "digital-dice-label", frame);
  add("div", "digital-dice-chosen", frame);
  const column = add("div", "digital-dice-column", frame);
  const originals = [];
  if (placeholders) {
    for (let id = 0; id < 4; id += 1) {
      const card = add("button", "digital-die-" + id, column);
      add("img", "placeholder-art-" + id, card);
      originals.push(card);
    }
  }
  const lever = add("button", "digital-dice-lever", frame);
  let captured = null;
  lever.setPointerCapture = (id) => { captured = id; };
  lever.hasPointerCapture = (id) => captured === id;
  lever.releasePointerCapture = (id) => { captured = null; lever.emit("lostpointercapture", lever, { pointerId: id }); };
  const motionListeners = new Set();
  const motion = {
    matches: reduced,
    addEventListener(type, handler) { motionListeners.add(handler); },
    removeEventListener(type, handler) { motionListeners.delete(handler); },
  };
  const viewListeners = {};
  document.defaultView.addEventListener = (type, handler) => { (viewListeners[type] ??= new Set()).add(handler); };
  document.defaultView.removeEventListener = (type, handler) => viewListeners[type]?.delete(handler);
  const clock = fakeClock();
  let randomCalls = 0;
  const controller = initializeDigitalDice(document, {
    storage: preferences === undefined ? storage : preferences,
    motion, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    randomDie() { const value = values[randomCalls % values.length]; randomCalls += 1; return value; },
  });
  return {
    document, storage, controller, clock, lever, machine, originals, toggle, panel,
    get randomCalls() { return randomCalls; },
    card(id) { return document.getElementById("digital-die-" + id); },
    activate() { lever.emit("keydown", lever, { key: "Enter" }); lever.emit("click", lever, { detail: 0 }); },
    select(id) { this.card(id).emit("click"); },
    deselect(id) { document.getElementById("digital-dice-chosen").querySelectorAll("button").find((node) => node.dataset.dieId === String(id)).emit("click"); },
    setReduced(value) { motion.matches = value; motionListeners.forEach((handler) => handler({ matches: value })); },
    pagehide() { viewListeners.pagehide?.forEach((handler) => handler()); },
    toggleDisclosure() { toggle.emit("click"); },
  };
}

function pointer(target, type, x, y, id = 1) {
  return target.emit(type, target, { pointerId: id, isPrimary: true, button: 0, clientX: x, clientY: y });
}

export async function runDigitalDiceTests(sources) {
  const results = [];
  function test(name, action) {
    try { action(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, message: error.message }); }
  }
  if (!sources) {
    try {
      sources = Object.fromEntries(await Promise.all(Object.entries({ html: "../index.html", css: "../css/style.css", digitalDice: "../js/digital-dice.js" }).map(async ([name, url]) => {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error("Cannot load " + url);
        return [name, await response.text()];
      })));
    } catch (error) { return [{ name: "Digital dice sources are available", passed: false, message: error.message }]; }
  }

  test("Initial placeholders have stable unique IDs and never call RNG or permit selection", () => {
    const initial = createDiceState();
    assertDeepEqual(initial.dice, [1, 2, 3, 4].map((value, id) => ({ id, value })));
    assertEqual(selectDigitalDie(initial, 0), initial);
    const f = fixture();
    assertEqual(f.randomCalls, 0);
    assertEqual(f.clock.pending.size, 0);
    assertEqual(f.machine.dataset.visibleDice, "4");
    assertEqual(f.document.getElementById("digital-dice-label").textContent, "CHOOSE TWO DICE");
    for (let id = 0; id < 4; id += 1) {
      assert(f.card(id).disabled);
      assertEqual(f.card(id).querySelector("img").src, "./assets/digital_dice/dice_" + (id + 1) + ".png");
      f.select(id);
    }
    assertDeepEqual(f.controller.getState().selectedIds, []);
  });

  test("The real shell already contains four neutral disabled dice and initialization reuses them", () => {
    const column = sources.html.match(/<div id="digital-dice-column"[\s\S]*?<\/div>/)?.[0];
    assertEqual((column.match(/<button /g) ?? []).length, 4);
    assertEqual((column.match(/ disabled>/g) ?? []).length, 4);
    const f = fixture({ placeholders: true });
    assertEqual(f.document.getElementById("digital-dice-column").children.length, 4);
    f.originals.forEach((card, id) => assertEqual(f.card(id), card));
  });

  test("First visits default to collapsed, with a mounted but inaccessible machine and no roll", () => {
    const f = fixture({ expanded: null });
    assertEqual(f.toggle.getAttribute("aria-expanded"), "false");
    assertEqual(f.toggle.getAttribute("aria-controls"), f.panel.id);
    assertEqual(f.machine.dataset.expanded, "false");
    assertEqual(f.panel.getAttribute("aria-hidden"), "true");
    assertEqual(f.panel.inert, true);
    assertEqual(f.document.getElementById("digital-dice-toggle-label").textContent, "DIGITAL DICE");
    assertEqual(f.document.getElementById("digital-dice-column").children.length, 4);
    assertEqual(f.storage.getItem(DIGITAL_DICE_EXPANDED_KEY), null);
    assertEqual(f.randomCalls, 0);
    assertEqual(f.clock.pending.size, 0);
    assert(sources.html.includes('data-expanded="false"'));
    assert(sources.html.includes('id="digital-dice-panel" class="digital-dice__panel" aria-hidden="true" inert'));
  });

  test("Only a saved true restores expansion; absent, false, and malformed preferences stay collapsed", () => {
    for (const value of [null, false, "", "TRUE", "1", "{}", "null", true]) {
      const f = fixture({ expanded: value });
      assertEqual(f.toggle.getAttribute("aria-expanded"), String(value === true));
      assertEqual(f.panel.inert, value !== true);
      assertEqual(f.randomCalls, 0);
      assertEqual(f.storage.getItem(DIGITAL_DICE_EXPANDED_KEY), value === null ? null : String(value));
    }
  });

  test("Toggle clicks persist open and closed preferences independently and restore them on later visits", () => {
    const f = fixture({ expanded: null });
    f.toggleDisclosure();
    assertEqual(f.toggle.getAttribute("aria-expanded"), "true");
    assertEqual(f.panel.inert, false);
    assertEqual(f.panel.getAttribute("aria-hidden"), "false");
    assertEqual(f.storage.getItem(DIGITAL_DICE_EXPANDED_KEY), "true");
    const next = fixture({ expanded: null, preferences: f.storage });
    assertEqual(next.machine.dataset.expanded, "true");
    next.toggleDisclosure();
    assertEqual(f.storage.getItem(DIGITAL_DICE_EXPANDED_KEY), "false");
    assertEqual(fixture({ expanded: null, preferences: f.storage }).machine.dataset.expanded, "false");
    assertEqual(f.storage.getItem(STORAGE_KEY), null);
  });

  test("Unavailable preference storage defaults to collapsed and still allows session toggling", () => {
    let reads = 0;
    let writes = 0;
    const f = fixture({ expanded: null, preferences: {
      getItem() { reads += 1; throw new Error("Storage blocked"); },
      setItem() { writes += 1; throw new Error("Storage blocked"); },
    } });
    assertEqual(f.machine.dataset.expanded, "false");
    f.toggleDisclosure();
    assertEqual(f.machine.dataset.expanded, "true");
    f.toggleDisclosure();
    assertEqual(f.machine.dataset.expanded, "false");
    assertEqual(reads, 1);
    assertEqual(writes, 2);
    assertEqual(f.randomCalls, 0);
  });

  test("Visibility alone is persisted; dice actions and language changes never save dice or alter the preference", () => {
    const f = fixture({ expanded: null, reduced: true });
    const writes = [];
    const save = f.storage.setItem;
    f.storage.setItem = (key, value) => { writes.push([key, value]); save(key, value); };
    f.toggleDisclosure();
    f.activate(); f.select(1); f.select(2); f.deselect(1);
    f.document.getElementById("rules-language-de").emit("click");
    f.toggleDisclosure();
    assertDeepEqual(writes, [[DIGITAL_DICE_EXPANDED_KEY, "true"], [RULES_LANGUAGE_KEY, "de"], [DIGITAL_DICE_EXPANDED_KEY, "false"]]);
    assertEqual(f.storage.getItem(STORAGE_KEY), null);
  });

  test("Collapsing keeps the same dice, selected IDs, DOM images, and layout on reopening", () => {
    const f = fixture();
    f.activate(); f.clock.advance(1600);
    f.select(1); f.select(2);
    const state = JSON.stringify(f.controller.getState());
    const cards = [0, 1, 2, 3].map((id) => f.card(id));
    const images = cards.map((card) => card.querySelector("img"));
    const positions = cards.map((card) => JSON.stringify(card.style));
    f.toggleDisclosure();
    f.clock.advance(250); // Selection fades still finish while collapsed.
    f.toggleDisclosure();
    assertEqual(JSON.stringify(f.controller.getState()), state);
    cards.forEach((card, id) => {
      assertEqual(f.card(id), card);
      assertEqual(f.card(id).querySelector("img"), images[id]);
      assertEqual(JSON.stringify(f.card(id).style), positions[id]);
    });
    assertDeepEqual(f.controller.getState().selectedIds, [1, 2]);
    assert(f.card(1).hidden); assert(f.card(2).hidden);
    assertEqual(f.machine.dataset.visibleDice, "2");
    assertEqual(f.randomCalls, 4);
  });

  test("A roll completes normally while collapsed without replacing its timers or generating new results", () => {
    const f = fixture({ values: [6, 1, 2, 5] });
    f.activate(); f.clock.advance(400);
    const state = JSON.stringify(f.controller.getState());
    const timers = [...f.clock.pending.keys()];
    assertEqual(f.toggle.disabled, false);
    f.toggleDisclosure();
    assertEqual(JSON.stringify(f.controller.getState()), state);
    assertDeepEqual([...f.clock.pending.keys()], timers);
    f.clock.advance(1200);
    assertEqual(f.controller.getState().rolling, false);
    assertEqual(f.clock.pending.size, 0);
    assertEqual(f.machine.dataset.expanded, "false");
    assertEqual(f.panel.inert, true);
    f.toggleDisclosure();
    for (let id = 0; id < 4; id += 1) assertEqual(f.card(id).querySelector("img").src, "./assets/digital_dice/dice_" + [6, 1, 2, 5][id] + ".png");
    assertEqual(f.lever.disabled, false);
    assertEqual(f.randomCalls, 4);
  });

  test("Language switching translates the disclosure without changing visibility or dice state", () => {
    const f = fixture({ expanded: null, language: "de", reduced: true });
    const label = f.document.getElementById("digital-dice-toggle-label");
    assertEqual(label.textContent, "DIGITALE WÜRFEL");
    f.document.getElementById("rules-language-en").emit("click");
    assertEqual(label.textContent, "DIGITAL DICE");
    assertEqual(f.machine.dataset.expanded, "false");
    f.toggleDisclosure(); f.activate(); f.select(2);
    const state = JSON.stringify(f.controller.getState());
    f.document.getElementById("rules-language-de").emit("click");
    assertEqual(label.textContent, "DIGITALE WÜRFEL");
    assertEqual(f.machine.dataset.expanded, "true");
    assertEqual(f.storage.getItem(DIGITAL_DICE_EXPANDED_KEY), "true");
    assertEqual(JSON.stringify(f.controller.getState()), state);
  });

  test("The disclosure uses native Enter/Space button activation and returns focus before hiding its controls", () => {
    const f = fixture({ expanded: null });
    assertEqual(f.toggle.type, "button");
    for (const key of ["Enter", " "]) {
      const before = f.toggle.getAttribute("aria-expanded");
      const down = f.toggle.emit("keydown", f.toggle, { key });
      assertEqual(down.defaultPrevented, undefined);
      assertEqual(f.toggle.getAttribute("aria-expanded"), before);
      f.toggle.emit("keyup", f.toggle, { key });
      f.toggle.emit("click", f.toggle, { detail: 0 }); // Browser's native button activation.
      assert(f.toggle.getAttribute("aria-expanded") !== before);
    }
    f.toggleDisclosure();
    f.lever.focus();
    f.toggleDisclosure();
    assertEqual(f.document.activeElement, f.toggle);
    assertEqual(f.panel.inert, true);
    assertEqual(f.randomCalls, 0);
    const button = sources.html.match(/<button id="digital-dice-toggle"[\s\S]*?<\/button>/)?.[0];
    assert(button.includes('type="button"'));
    assert(button.includes('aria-expanded="false" aria-controls="digital-dice-panel"'));
    assert(button.includes('class="digital-dice__chevron" aria-hidden="true"'));
    assert(sources.css.includes(".digital-dice__toggle:focus-visible { outline-color: #fff; }"));
  });

  test("Disclosure height and opacity animate for 300ms without scaling the machine and respect reduced motion", () => {
    const closed = sources.css.match(/\.digital-dice__panel\s*\{([^}]+)\}/)?.[1];
    assert(closed.includes("grid-template-rows: 0fr"));
    assert(closed.includes("opacity: 0"));
    assert(closed.includes("grid-template-rows 300ms ease, opacity 300ms ease"));
    assert(!closed.includes("transform:"));
    assert(sources.css.includes('.digital-dice[data-expanded="true"] .digital-dice__panel { grid-template-rows: 1fr; opacity: 1; visibility: visible; transition-delay: 0s; }'));
    assert(sources.css.includes(".digital-dice__panel-inner { min-height: 0; overflow: hidden; }"));
    assert(sources.css.includes(".digital-dice__panel, .digital-dice__chevron { transition: none; }"));
    const f = fixture({ expanded: null, reduced: true });
    f.toggleDisclosure(); f.toggleDisclosure();
    assertEqual(f.clock.pending.size, 0);
  });

  test("Web Crypto mapping is uniform over six residues and rejects the final four Uint32 values", () => {
    for (let value = 0; value < 60; value += 1) {
      assertEqual(randomDieValue({ getRandomValues(buffer) { buffer[0] = value; } }), value % 6 + 1);
    }
    const samples = [4294967292, 4294967293, 4294967294, 4294967295, 5];
    let calls = 0;
    assertEqual(randomDieValue({ getRandomValues(buffer) { buffer[0] = samples[calls++]; } }), 6);
    assertEqual(calls, 5);
  });

  test("The documented non-crypto fallback stays in the 1–6 integer range", () => {
    for (const [sample, value] of [[0, 1], [0.2, 2], [0.4, 3], [0.6, 4], [0.8, 5], [0.999999, 6]]) {
      assertEqual(randomDieValue(null, () => sample), value);
    }
  });

  test("A roll generates exactly four final values immediately with injectable RNG", () => {
    const f = fixture({ values: [6, 1, 3, 3] });
    f.activate();
    assertEqual(f.randomCalls, 4);
    assertDeepEqual(f.controller.getState().dice.map((die) => die.value), [6, 1, 3, 3]);
    assertEqual(f.controller.getState().rolling, true);
    f.clock.advance(1600);
    assertEqual(f.randomCalls, 4);
    assertDeepEqual(f.controller.getState().dice.map((die) => die.value), [6, 1, 3, 3]);
  });

  test("Invalid injected die values are rejected without changing the original dice state", () => {
    const state = createDiceState();
    const original = JSON.stringify(state);
    for (const value of [0, 7, 1.5, "4", null, NaN]) assertThrows(() => beginDiceRoll(state, () => value));
    assertEqual(JSON.stringify(state), original);
  });

  test("Roll locking rejects rapid activations and selections without consuming more random values", () => {
    const f = fixture();
    f.activate();
    for (let attempt = 0; attempt < 8; attempt += 1) { f.activate(); f.select(attempt % 4); }
    assertEqual(f.randomCalls, 4);
    assertDeepEqual(f.controller.getState().selectedIds, []);
    assert(f.lever.disabled);
    for (let id = 0; id < 4; id += 1) assert(f.card(id).disabled);
    f.clock.advance(1600);
    assertEqual(f.lever.disabled, false);
    for (let id = 0; id < 4; id += 1) assertEqual(f.card(id).disabled, false);
  });

  test("Dice stop top-to-bottom at 700/1000/1300/1600ms and show the precomputed faces", () => {
    const f = fixture({ values: [6, 5, 4, 3] });
    f.activate();
    f.clock.advance(699);
    for (let id = 0; id < 4; id += 1) assertEqual(f.card(id).dataset.rolling, "true");
    for (let index = 0; index < 4; index += 1) {
      f.clock.advance(index === 0 ? 1 : 300);
      for (let id = 0; id < 4; id += 1) assertEqual(f.card(id).dataset.rolling, String(id > index));
      assertEqual(f.card(index).querySelector("img").src, "./assets/digital_dice/dice_" + [6, 5, 4, 3][index] + ".png");
    }
    assertEqual(f.controller.getState().rolling, false);
    assertEqual(f.clock.pending.size, 0);
  });

  test("Cycling reuses image elements, never changes final outcomes, and stops scheduling after completion", () => {
    const f = fixture();
    const images = [0, 1, 2, 3].map((id) => f.card(id).querySelector("img"));
    f.activate();
    f.clock.advance(240);
    assertEqual(f.randomCalls, 4);
    assertEqual(f.clock.pending.size <= 5, true);
    images.forEach((art, id) => assertEqual(f.card(id).querySelector("img"), art));
    f.clock.advance(1360);
    const faces = images.map((image) => image.src);
    f.clock.advance(10000);
    assertDeepEqual(images.map((image) => image.src), faces);
    assertEqual(f.clock.pending.size, 0);
  });

  test("Tap pointerup followed by synthetic click triggers one roll, including reduced motion", () => {
    for (const reduced of [false, true]) {
      const f = fixture({ reduced });
      pointer(f.lever, "pointerdown", 10, 10);
      pointer(f.lever, "pointerup", 10, 10);
      f.lever.emit("click", f.lever, { detail: 1, pointerType: "touch" });
      assertEqual(f.randomCalls, 4);
      assertEqual(f.controller.getState().hasRolled, true);
    }
  });

  test("A downward pull previews rotation, captures outside release, and rolls exactly once", () => {
    const f = fixture();
    pointer(f.lever, "pointerdown", 40, 20);
    assert(f.lever.hasPointerCapture(1));
    pointer(f.lever, "pointermove", 43, 45);
    assertEqual(f.lever.style["--digital-lever-pull-angle"], "-32deg");
    pointer(f.lever, "pointerup", 43, 100);
    f.lever.emit("click", f.lever, { detail: 0 });
    assertEqual(f.randomCalls, 4);
    assertEqual(f.lever.hasPointerCapture(1), false);
    assertEqual(f.lever.style["--digital-lever-start-angle"], "-32deg");
  });

  test("Cancelled, upward, sideways, and outside-page scrolling gestures do not roll", () => {
    for (const kind of ["cancel", "up", "side", "page"]) {
      const f = fixture();
      if (kind === "page") {
        f.document.emit("pointerdown", f.document.root, { clientX: 0, clientY: 0 });
        f.document.emit("pointermove", f.document.root, { clientX: 0, clientY: 100 });
      } else {
        pointer(f.lever, "pointerdown", 10, 50);
        if (kind === "cancel") pointer(f.lever, "pointercancel", 10, 90);
        else pointer(f.lever, "pointerup", kind === "side" ? 90 : 10, kind === "up" ? 10 : 50);
        f.lever.emit("click", f.lever, { detail: 1 });
      }
      assertEqual(f.randomCalls, 0);
      assertEqual(f.controller.getState().hasRolled, false);
    }
  });

  test("Native keyboard Enter and Space clicks remain available after a pointer cancellation", () => {
    const f = fixture({ reduced: true });
    pointer(f.lever, "pointerdown", 0, 0);
    pointer(f.lever, "pointercancel", 0, 0);
    for (const key of ["Enter", " "]) {
      f.lever.emit("keydown", f.lever, { key });
      f.lever.emit("click", f.lever, { detail: 0 });
    }
    assertEqual(f.randomCalls, 8);
  });

  test("Reduced motion shows final values immediately without cycling or animation timers", () => {
    const f = fixture({ reduced: true });
    f.activate();
    assertEqual(f.randomCalls, 4);
    assertEqual(f.controller.getState().rolling, false);
    assertEqual(f.clock.pending.size, 0);
    for (let id = 0; id < 4; id += 1) assertEqual(f.card(id).querySelector("img").src, "./assets/digital_dice/dice_" + [2, 4, 4, 6][id] + ".png");
    f.select(0);
    assert(f.card(0).hidden);
    f.deselect(0);
    assertEqual(f.card(0).hidden, false);
  });

  test("Enabling reduced motion or pagehide settles an active roll and removes old callbacks", () => {
    for (const action of ["motion", "pagehide"]) {
      const f = fixture();
      f.activate();
      const oldCallbacks = [...f.clock.pending.values()].map((entry) => entry.callback);
      if (action === "motion") f.setReduced(true); else f.pagehide();
      assertEqual(f.controller.getState().rolling, false);
      assertEqual(f.clock.pending.size, 0);
      const before = JSON.stringify(f.controller.getState());
      oldCallbacks.forEach((callback) => callback());
      assertEqual(JSON.stringify(f.controller.getState()), before);
    }
  });

  test("Selection fades out one die, grows/repositions survivors, and focuses its chosen-number button", () => {
    const f = fixture();
    f.activate(); f.clock.advance(1600);
    const width = parseFloat(f.card(1).style["--digital-die-width"]);
    f.select(0);
    assertDeepEqual(f.controller.getState().selectedIds, [0]);
    assertEqual(f.card(0).dataset.leaving, "true");
    assertEqual(f.document.activeElement.dataset.dieId, "0");
    assertEqual(f.document.getElementById("digital-dice-chosen").textContent, "2");
    assertEqual(f.machine.dataset.visibleDice, "3");
    assert(parseFloat(f.card(1).style["--digital-die-width"]) > width);
    f.clock.advance(180);
    assert(f.card(0).hidden);
    assertEqual([0, 1, 2, 3].filter((id) => !f.card(id).hidden).length, 3);
  });

  test("Two selected IDs preserve selection order, leave two dice, and silently reject a third", () => {
    const f = fixture({ reduced: true });
    f.activate(); f.select(3); f.select(0); f.select(1);
    assertDeepEqual(f.controller.getState().selectedIds, [3, 0]);
    assertEqual(f.document.getElementById("digital-dice-chosen").textContent, "6,2");
    assertEqual(f.machine.dataset.visibleDice, "2");
    assertEqual(f.card(1).hidden, false); assertEqual(f.card(2).hidden, false);
    assert(f.card(1).disabled); assert(f.card(2).disabled);
    assertEqual(f.lever.disabled, false);
  });

  test("Duplicate-valued dice can be independently chosen and restored by their own IDs", () => {
    const f = fixture({ reduced: true, values: [4, 4, 2, 6] });
    f.activate(); f.select(1); f.select(0);
    assertDeepEqual(f.controller.getState().selectedIds, [1, 0]);
    assertEqual(f.document.getElementById("digital-dice-chosen").querySelectorAll("button").length, 2);
    f.deselect(1);
    assertDeepEqual(f.controller.getState().selectedIds, [0]);
    assertEqual(f.card(1).hidden, false); assert(f.card(0).hidden);
    f.deselect(0);
    assertDeepEqual(f.controller.getState().selectedIds, []);
    assertEqual(f.machine.dataset.visibleDice, "4");
    assertEqual(f.document.getElementById("digital-dice-label").textContent, "CHOOSE TWO DICE");
  });

  test("A new roll replaces every selection without requiring a board action or confirmation", () => {
    const f = fixture({ reduced: true });
    f.activate(); f.select(1); f.select(2);
    f.activate();
    assertEqual(f.randomCalls, 8);
    assertDeepEqual(f.controller.getState().selectedIds, []);
    assertEqual(f.machine.dataset.visibleDice, "4");
  });

  test("Stale fade callbacks cannot hide or reposition dice from a later roll", () => {
    const f = fixture();
    f.activate(); f.clock.advance(1600); f.select(0);
    const oldCallbacks = [...f.clock.pending.values()].map((entry) => entry.callback);
    f.activate();
    oldCallbacks.forEach((callback) => callback());
    assertEqual(f.machine.dataset.visibleDice, "4");
    assertEqual(f.card(0).hidden, false);
    assertEqual(f.controller.getState().rolling, true);
    assertDeepEqual(f.controller.getState().selectedIds, []);
  });

  test("Four/three/two layouts fit the actual interior with gaps and monotonically increasing size", () => {
    let state = finishDiceRoll(beginDiceRoll(createDiceState(), () => 4));
    let lastSize = 0;
    for (const selected of [[], [0], [0, 1]]) {
      state = { ...state, selectedIds: selected };
      const layout = getDigitalDiceLayout(state);
      assertEqual(layout.length, 4 - selected.length);
      const size = layout[0].width / 100 * DICE_REGION.width;
      assert(size > lastSize); lastSize = size;
      assert(size < DICE_REGION.width);
      for (let index = 0; index < layout.length; index += 1) {
        const center = layout[index].centerY / 100 * DICE_REGION.height;
        assert(center - size / 2 > 0);
        assert(center + size / 2 < DICE_REGION.height);
        if (index > 0) assert(center - layout[index - 1].centerY / 100 * DICE_REGION.height > size);
      }
    }
  });

  test("The wrapper stays fixed while dice and chosen text change, with the lever inside its geometry", () => {
    assert(sources.css.includes("aspect-ratio: 1260 / 1800"));
    assert(sources.css.includes("width: min(100%, 32rem)"));
    assert(sources.css.includes("--digital-cabinet-left: 20.635%"));
    assert(sources.css.includes("transform-origin: 93.5% 86.5%"));
    assert(sources.css.includes("28% { transform: rotate(-32deg); }"));
    assert(sources.css.includes("top 250ms ease, width 250ms ease"));
    assert(sources.css.includes(".digital-dice__machine { position: relative; aspect-ratio: 1260 / 1800; container-type: inline-size; overflow: hidden; }"));
    const f = fixture({ reduced: true });
    const style = JSON.stringify(f.machine.style);
    f.activate(); f.select(0); f.select(1); f.deselect(0);
    assertEqual(JSON.stringify(f.machine.style), style);
  });

  test("Existing Rules preference and toggle update labels without changing values or chosen order", () => {
    const f = fixture({ language: "de", reduced: true });
    assertEqual(f.document.getElementById("digital-dice-label").textContent, "WÄHLE ZWEI WÜRFEL");
    assertEqual(f.lever.getAttribute("aria-label"), "Vier Würfel werfen");
    f.activate(); f.select(3); f.select(0);
    const state = JSON.stringify(f.controller.getState());
    f.document.getElementById("rules-language-en").emit("click");
    assertEqual(f.document.getElementById("digital-dice-label").textContent, "CHOSEN:");
    assertEqual(f.lever.getAttribute("aria-label"), "Roll four dice");
    assertEqual(f.document.getElementById("digital-dice-chosen").textContent, "6,2");
    f.document.getElementById("rules-language-de").emit("click");
    assertEqual(f.document.getElementById("digital-dice-label").textContent, "GEWÄHLT:");
    assertEqual(JSON.stringify(f.controller.getState()), state);
  });

  test("Digital dice never modify the saved board, score, ice, Undo, spending, or receipt history", () => {
    let game = createGameState();
    for (const [coordinate, value] of [["A1", 23], ["B1", 31], ["A2", 23]]) game = placeGameNumber(game, coordinate, value);
    game = confirmGameBid(game, 5);
    const f = fixture({ game, reduced: true });
    const saved = f.storage.getItem(STORAGE_KEY);
    const score = f.document.getElementById("current-score").textContent;
    const receipt = f.document.getElementById("receipt-history").textContent;
    const undo = f.document.getElementById("undo-move").disabled;
    f.document.defaultView.localStorage = { getItem() { throw new Error("No dice storage access"); }, setItem() { throw new Error("No dice saving"); } };
    f.toggleDisclosure(); f.toggleDisclosure();
    f.activate(); f.select(0); f.select(2); f.deselect(0); f.activate();
    assertEqual(f.storage.getItem(STORAGE_KEY), saved);
    assertEqual(f.document.getElementById("current-score").textContent, score);
    assertEqual(f.document.getElementById("receipt-history").textContent, receipt);
    assertEqual(f.document.getElementById("undo-move").disabled, undo);
    assertEqual(f.document.getElementById("cell-B1").dataset.state, "thawed");
    assertEqual(f.document.getElementById("cell-A2").dataset.state, "frozen");
    assert(!sources.digitalDice.includes(STORAGE_KEY));
    assert(!sources.digitalDice.match(/^import /m));
  });

  test("Reload creates neutral temporary dice without touching the existing game save", () => {
    const game = placeGameNumber(createGameState(), "A1", 22);
    const f = fixture({ game, reduced: true });
    f.activate(); f.select(1); f.select(2);
    const restored = fixture({ game });
    assertEqual(restored.randomCalls, 0);
    assertDeepEqual(restored.controller.getState(), createDiceState());
    assertEqual(restored.storage.getItem(STORAGE_KEY), f.storage.getItem(STORAGE_KEY));
  });

  test("Destroy settles visuals, clears every timer, and detaches interaction callbacks", () => {
    const f = fixture();
    f.activate();
    const oldCallbacks = [...f.clock.pending.values()].map((entry) => entry.callback);
    f.controller.destroy();
    assertEqual(f.clock.pending.size, 0);
    assertEqual(f.machine.dataset.rolling, "false");
    const state = JSON.stringify(f.controller.getState());
    oldCallbacks.forEach((callback) => callback());
    f.activate(); f.select(1); f.pagehide();
    assertEqual(JSON.stringify(f.controller.getState()), state);
    assertEqual(f.randomCalls, 4);
  });

  test("Machine is in normal flow after main and before Rules, and all six faces are preloaded", () => {
    const position = sources.html.indexOf('<section id="digital-dice"');
    assert(position > sources.html.indexOf("</main>"));
    assert(position < sources.html.indexOf('<section id="rules"'));
    assert(sources.css.includes("margin: calc(var(--meadow-painted-depth) + 3rem) auto 0"));
    assert(sources.css.includes(".digital-dice + .rules-illustration { margin-top: clamp(3rem, 10vw, 5rem); }"));
    for (let value = 1; value <= 6; value += 1) {
      assert(sources.html.includes('rel="preload" as="image" href="./assets/digital_dice/dice_' + value + '.png"'));
    }
    const leverStyle = sources.css.match(/\.digital-dice__lever\s*\{([^}]+)\}/)?.[1];
    assert(leverStyle.includes("touch-action: none"));
    assert(sources.css.includes(".digital-die[data-rolling=\"true\"],\n  .digital-dice[data-rolling=\"true\"] .digital-dice__lever { animation: none; }"));
  });

  return results;
}
