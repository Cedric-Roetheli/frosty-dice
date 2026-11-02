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
function fixture({ values = [2, 4, 4, 6], reduced = false, language = "en", game, placeholders = false, expanded = true, preferences, width = 512, selectionHeight = 68 } = {}) {
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
  const frame = add("div", "digital-dice-machine", inner);
  let frameWidth = width;
  let textHeight = selectionHeight;
  frame.getBoundingClientRect = () => ({ width: frameWidth, height: frameWidth * 1900 / 1800 });
  const selectionArea = add("div", "digital-dice-status", frame);
  selectionArea.getBoundingClientRect = () => ({ height: textHeight });
  add("p", "digital-dice-label", selectionArea);
  add("div", "digital-dice-chosen", selectionArea);
  document.defaultView.getComputedStyle = () => ({ marginBottom: "4px" });
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
    document, storage, controller, clock, lever, machine, originals, toggle, panel, frame, selectionArea,
    get randomCalls() { return randomCalls; },
    card(id) { return document.getElementById("digital-die-" + id); },
    activate() { lever.emit("keydown", lever, { key: "Enter" }); lever.emit("click", lever, { detail: 0 }); },
    select(id) { this.card(id).emit("click"); },
    deselect(id) { document.getElementById("digital-dice-chosen").querySelectorAll("button").find((node) => node.dataset.dieId === String(id)).emit("click"); },
    setReduced(value) { motion.matches = value; motionListeners.forEach((handler) => handler({ matches: value })); },
    pagehide() { viewListeners.pagehide?.forEach((handler) => handler()); },
    toggleDisclosure() { toggle.emit("click"); },
    resize(width, height = textHeight) { frameWidth = width; textHeight = height; viewListeners.resize?.forEach((handler) => handler()); },
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

  function coordinate(name, extent) {
    const match = sources.css.match(new RegExp(name + ":\\s*(-?[\\d.]+)%"));
    assert(match, "Missing machine coordinate: " + name);
    return Number(match[1]) / 100 * extent;
  }

  test("Mobile poles meet the viewport edge, including inset and scrollbar cases, while desktop stays centered", () => {
    const sourceWidth = Number(sources.css.match(/--digital-source-width:\s*(\d+)/)?.[1]);
    const poleEdge = Number(sources.css.match(/--digital-mobile-pole-edge:\s*(\d+)/)?.[1]);
    assertEqual(sourceWidth, 2048);
    assertEqual(poleEdge, 2019); // Shorter pole; the longer pole's alpha edge is 2032.
    const artworkLeft = coordinate("--digital-cabinet-left", 1);
    const artworkWidth = coordinate("--digital-cabinet-width", 1);
    for (const [viewport, client, insetLeft, insetRight] of [[320, 320, 12, 12], [390, 390, 12, 12], [390, 375, 12, 12], [430, 430, 20, 32], [576, 576, 12, 12], [1024, 1009, 12, 12]]) {
      const width = Math.min(client - insetLeft - insetRight, 512);
      const oldHeight = width * 1900 / 1800;
      const mobile = viewport <= 576;
      const shift = width * (1 - artworkLeft - artworkWidth * poleEdge / sourceWidth);
      const stageLeft = mobile ? client - width + shift : insetLeft + (client - insetLeft - insetRight - width) / 2;
      const rightTip = stageLeft + width * (artworkLeft + artworkWidth * poleEdge / sourceWidth);
      if (mobile) {
        assert(Math.abs(rightTip - client) < 0.00001);
        assert(stageLeft > 0); // The complete lever and cabinet remain onscreen.
        // All non-pole artwork ends before x=1900 in the source and is never clipped.
        assert(stageLeft + width * (artworkLeft + artworkWidth * 1900 / sourceWidth) < client);
      } else {
        assert(rightTip < client);
        assert(Math.abs(stageLeft + width / 2 - client / 2) < 0.00001);
      }
      assertEqual(width * 1900 / 1800, oldHeight); // No whole-machine enlargement.
      assertEqual((client - insetLeft - insetRight) + insetLeft + insetRight, client);
    }
    assert(sources.css.includes("@media (max-width: 36rem)"));
    assert(sources.css.includes("width: calc(100% + var(--digital-page-inset-left) + var(--digital-page-inset-right))"));
    assert(sources.css.includes("margin-inline: calc(-1 * var(--digital-page-inset-left)) calc(-1 * var(--digital-page-inset-right))"));
    assert(sources.css.includes("width: min(calc(100% - var(--digital-page-inset-left) - var(--digital-page-inset-right)), 32rem)"));
    assert(sources.css.includes("transform: translateX(calc(100% - var(--digital-cabinet-left) - var(--digital-cabinet-width) * var(--digital-mobile-pole-edge) / var(--digital-source-width)))"));
    assert(!sources.css.includes("width: 100vw"));
    assert(sources.css.includes(".digital-dice__panel-inner { min-height: 0; overflow: hidden; }"));
  });

  test("Four placeholders use the reclaimed full interior and are 38 percent larger without enlarging the machine", () => {
    const f = fixture();
    const column = f.document.getElementById("digital-dice-column");
    assertEqual(column.style["--digital-selection-space"], "0%");
    assertEqual(DICE_REGION.height, 1380);
    for (let id = 0; id < 4; id += 1) assertEqual(f.card(id).style["--digital-die-width"], "50%");
    const oldSize = 1000 / 4.6;
    const newSize = getDigitalDiceLayout(createDiceState())[0].width / 100 * DICE_REGION.width;
    assertEqual(newSize, 300);
    assert(Math.abs(newSize / oldSize - 1.38) < 0.00001);
    assertEqual(f.frame.getBoundingClientRect().width, 512);
    assertEqual(f.randomCalls, 0);
  });

  test("Rolling and sequential stops retain the exact full-height four-dice layout", () => {
    const f = fixture();
    const positions = [0, 1, 2, 3].map((id) => JSON.stringify(f.card(id).style));
    f.activate();
    for (const elapsed of [0, 700, 300, 300, 300]) {
      f.clock.advance(elapsed);
      assertEqual(f.document.getElementById("digital-dice-column").style["--digital-selection-space"], "0%");
      [0, 1, 2, 3].forEach((id) => assertEqual(JSON.stringify(f.card(id).style), positions[id]));
    }
    assertEqual(f.controller.getState().rolling, false);
    assertEqual(f.randomCalls, 4);
  });

  test("Three and two dice use only the measured text reservation and fit narrow and desktop interiors", () => {
    for (const [width, selectionHeight] of [[296, 62.8], [366, 65.8], [512, 68]]) {
      const f = fixture({ width, selectionHeight, reduced: true });
      f.activate();
      const column = f.document.getElementById("digital-dice-column");
      for (const id of [0, 1]) {
        f.select(id);
        const reservedPixels = parseFloat(column.style["--digital-selection-space"]) / 100 * f.frame.getBoundingClientRect().height;
        assert(Math.abs(reservedPixels - (selectionHeight + 4)) < 0.00001);
        const available = DICE_REGION.height / 1800 * width - reservedPixels;
        const visible = [0, 1, 2, 3].filter((id) => !f.card(id).hidden);
        assertEqual(visible.length, 3 - id);
        let bottom = 0;
        for (const visibleId of visible) {
          const size = parseFloat(f.card(visibleId).style["--digital-die-width"]) / 100 * DICE_REGION.width / 1800 * width;
          const center = parseFloat(f.card(visibleId).style["--digital-die-y"]) / 100 * available;
          assert(center - size / 2 > bottom);
          bottom = center + size / 2;
          assert(bottom < available);
          assert(size < DICE_REGION.width / 1800 * width);
        }
      }
    }
  });

  test("Last deselection and a new roll restore the full four-dice layout with no text reservation", () => {
    const f = fixture({ reduced: true });
    f.activate();
    const column = f.document.getElementById("digital-dice-column");
    f.select(1); f.select(2); f.deselect(1);
    assert(parseFloat(column.style["--digital-selection-space"]) > 0);
    f.deselect(2);
    assertEqual(column.style["--digital-selection-space"], "0%");
    [0, 1, 2, 3].forEach((id) => assertEqual(f.card(id).style["--digital-die-width"], "50%"));
    f.select(0); f.activate();
    assertEqual(column.style["--digital-selection-space"], "0%");
    assertEqual(f.machine.dataset.visibleDice, "4");
    [0, 1, 2, 3].forEach((id) => assertEqual(f.card(id).style["--digital-die-width"], "50%"));
    assertEqual(f.randomCalls, 8);
  });

  test("Resizing and language updates remeasure text without changing selected IDs, values, or collapse preference", () => {
    const f = fixture({ reduced: true });
    f.activate(); f.select(1); f.select(2);
    const state = JSON.stringify(f.controller.getState());
    const column = f.document.getElementById("digital-dice-column");
    const original = column.style["--digital-selection-space"];
    f.resize(296, 62.8);
    assert(column.style["--digital-selection-space"] !== original);
    f.selectionArea.getBoundingClientRect = () => ({ height: 80 });
    f.document.getElementById("rules-language-de").emit("click");
    const reserved = parseFloat(column.style["--digital-selection-space"]) / 100 * f.frame.getBoundingClientRect().height;
    assert(Math.abs(reserved - 84) < 0.00001);
    f.toggleDisclosure(); f.toggleDisclosure();
    assertEqual(JSON.stringify(f.controller.getState()), state);
    assertEqual(f.storage.getItem(DIGITAL_DICE_EXPANDED_KEY), "true");
    assertEqual(f.randomCalls, 4);
  });

  test("Only internal region geometry animates on selection and reduced motion disables that transition", () => {
    const column = sources.css.match(/\.digital-dice__column\s*\{([^}]+)\}/)?.[1];
    const status = sources.css.match(/\.digital-dice__status\s*\{([^}]+)\}/)?.[1];
    assert(column.includes("top: calc(var(--digital-column-top) + var(--digital-selection-space, 0%))"));
    assert(column.includes("height: calc(var(--digital-column-height) - var(--digital-selection-space, 0%))"));
    assert(column.includes("transition: top 250ms ease, height 250ms ease"));
    assert(!/(?:^|;)\s*height:/.test(status));
    assert(status.includes("margin-bottom: var(--digital-selection-gap)"));
    assert(sources.css.includes(".digital-die, .digital-dice__column { transition: none; }"));
  });

  test("The illustrated sign replaces initial instructions in either language, before and after a roll", () => {
    for (const language of ["en", "de"]) {
      const f = fixture({ language, reduced: true });
      const label = f.document.getElementById("digital-dice-label");
      const chosen = f.document.getElementById("digital-dice-chosen");
      assertEqual(label.textContent, "");
      assert(label.hidden); assert(chosen.hidden);
      f.activate();
      assertEqual(label.textContent, "");
      assert(label.hidden); assert(chosen.hidden);
    }
    for (const source of [sources.html, sources.digitalDice]) {
      assert(!source.includes("CHOOSE TWO DICE"));
      assert(!source.includes("WÄHLE ZWEI WÜRFEL"));
    }
    assert(sources.html.includes('<p id="digital-dice-label" hidden></p>'));
  });

  test("Chosen text appears only for selections, retains independent values, and clears on deselection or a new roll", () => {
    const f = fixture({ reduced: true, values: [4, 4, 2, 6] });
    const label = f.document.getElementById("digital-dice-label");
    const chosen = f.document.getElementById("digital-dice-chosen");
    f.activate(); f.select(1); f.select(0);
    assertEqual(label.textContent, "CHOSEN:");
    assertEqual(label.hidden, false); assertEqual(chosen.hidden, false);
    assertEqual(chosen.querySelectorAll("button").length, 2);
    assertDeepEqual(f.controller.getState().selectedIds, [1, 0]);
    f.document.getElementById("rules-language-de").emit("click");
    assertEqual(label.textContent, "GEWÄHLT:");
    f.deselect(1);
    assertEqual(label.hidden, false);
    assertDeepEqual(f.controller.getState().selectedIds, [0]);
    f.deselect(0);
    assert(label.hidden); assert(chosen.hidden);
    assertEqual(label.textContent, "");
    f.select(2); f.activate();
    assert(label.hidden); assert(chosen.hidden);
    assertEqual(label.textContent, "");
  });

  test("The complete redesigned sign, frame, raccoon, bag, and right-side artwork fit without distortion", () => {
    const width = 1800;
    const height = 1900;
    const left = coordinate("--digital-cabinet-left", width);
    const scale = coordinate("--digital-cabinet-width", width) / 2048;
    // Measured alpha bounds of the unchanged 2048 × 2048 source PNG.
    const painted = { left: 634, top: 30, right: 2032, bottom: 1827 };
    assert(left + painted.left * scale > 0);
    assert(left + painted.right * scale < width);
    assert(painted.top * scale > 0);
    assert(painted.bottom * scale < height);
    assert(sources.html.includes('class="digital-dice__cabinet" src="./assets/digital_dice/dice_machine.png" alt="" width="2048" height="2048"'));
    const style = sources.css.match(/\.digital-dice__cabinet\s*\{([^}]+)\}/)?.[1];
    assert(!style.includes("height:"));
    assert(sources.css.includes(".digital-dice img { display: block; height: auto;"));
  });

  test("Dice and selected values stay inside the measured light interior and below the illustrated sign", () => {
    const left = coordinate("--digital-cabinet-left", 1800);
    const x = coordinate("--digital-column-left", 1800) - left;
    const y = coordinate("--digital-column-top", 1900);
    const width = coordinate("--digital-column-width", 1800);
    const height = coordinate("--digital-column-height", 1900);
    assert(Math.abs(width - DICE_REGION.width) < 0.02);
    assert(Math.abs(height - DICE_REGION.height) < 0.02);
    assert(x > 714 && x + width < 1344);
    assert(y > 310 && y + height < 1740);
    assert(Math.abs(coordinate("--digital-status-top", 1900) - y) < 0.02);
    assert(!sources.css.includes("--digital-status-height"));
    assert(coordinate("--digital-status-top", 1900) > 295);
    // The placeholder width matches the same pure layout used after initialization.
    const placeholder = Number(sources.html.match(/--digital-die-width:([\d.]+)%/)?.[1]);
    assert(Math.abs(placeholder - getDigitalDiceLayout(createDiceState())[0].width) < 0.001);
  });

  test("The realigned lever and mounting bracket fit the entire unchanged swing with a separate 44px touch area", () => {
    const x = coordinate("--digital-lever-left", 1800);
    const y = coordinate("--digital-lever-top", 1900);
    const size = coordinate("--digital-lever-width", 1800);
    const pivot = { x: size * 0.935, y: size * 700 / 300 * 0.865 };
    const baseX = coordinate("--digital-base-left", 1800);
    const baseY = coordinate("--digital-base-top", 1900);
    const baseSize = coordinate("--digital-base-width", 1800);
    assert(x + pivot.x > baseX && x + pivot.x < baseX + baseSize);
    assert(y + pivot.y > baseY && y + pivot.y < baseY + baseSize);
    for (const degrees of [0, -32, 2]) {
      const angle = degrees * Math.PI / 180;
      for (const sourceX of [21, 293]) for (const sourceY of [3, 672]) {
        const dx = sourceX * size / 300 - pivot.x;
        const dy = sourceY * size / 300 - pivot.y;
        const pointX = x + pivot.x + dx * Math.cos(angle) - dy * Math.sin(angle);
        const pointY = y + pivot.y + dx * Math.sin(angle) + dy * Math.cos(angle);
        assert(pointX >= 0 && pointX <= 1800);
        assert(pointY >= 0 && pointY <= 1900);
      }
    }
    const lever = sources.css.match(/\.digital-dice__lever\s*\{([^}]+)\}/)?.[1];
    assert(!lever.includes("min-width:"));
    assert(sources.css.match(/\.digital-dice__lever::before\s*\{([^}]+)\}/)?.[1].includes("width: max(100%, 44px)"));
  });

  test("Initial placeholders have stable unique IDs and never call RNG or permit selection", () => {
    const initial = createDiceState();
    assertDeepEqual(initial.dice, [1, 2, 3, 4].map((value, id) => ({ id, value })));
    assertEqual(selectDigitalDie(initial, 0), initial);
    const f = fixture();
    assertEqual(f.randomCalls, 0);
    assertEqual(f.clock.pending.size, 0);
    assertEqual(f.machine.dataset.visibleDice, "4");
    assertEqual(f.document.getElementById("digital-dice-label").textContent, "");
    assert(f.document.getElementById("digital-dice-label").hidden);
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
    assertEqual(f.document.getElementById("digital-dice-label").textContent, "");
    assert(f.document.getElementById("digital-dice-label").hidden);
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
    assert(sources.css.includes("aspect-ratio: 1800 / 1900"));
    assert(sources.css.includes("width: min(100%, 32rem)"));
    assert(sources.css.includes("--digital-cabinet-left: -14.444%"));
    assert(sources.css.includes("transform-origin: 93.5% 86.5%"));
    assert(sources.css.includes("28% { transform: rotate(-32deg); }"));
    assert(sources.css.includes("top 250ms ease, width 250ms ease"));
    assert(sources.css.includes(".digital-dice__machine { position: relative; aspect-ratio: 1800 / 1900; container-type: inline-size; overflow: hidden; }"));
    const f = fixture({ reduced: true });
    const style = JSON.stringify(f.machine.style);
    f.activate(); f.select(0); f.select(1); f.deselect(0);
    assertEqual(JSON.stringify(f.machine.style), style);
  });

  test("Existing Rules preference and toggle update labels without changing values or chosen order", () => {
    const f = fixture({ language: "de", reduced: true });
    assertEqual(f.document.getElementById("digital-dice-label").textContent, "");
    assert(f.document.getElementById("digital-dice-label").hidden);
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
