// Optional dice only: no imports from board, scoring, storage, or turn logic.
export const DICE_STOP_TIMES = Object.freeze([700, 1000, 1300, 1600]);
export const DICE_REGION = Object.freeze({ width: 600, height: 1380 });
const MACHINE_HEIGHT = 1900;
export const DIGITAL_DICE_EXPANDED_KEY = "frosty-dice.digital-dice-expanded";
const FACE_PATH = "./assets/digital_dice/dice_";
const labels = {
  en: { toggle: "DIGITAL DICE", chosen: "CHOSEN:", roll: "Roll four dice", select: "Select die showing ", deselect: "Deselect die showing ", rolling: "Rolling die ", name: "Digital Dice Machine" },
  de: { toggle: "DIGITALE WÜRFEL", chosen: "GEWÄHLT:", roll: "Vier Würfel werfen", select: "Würfel wählen mit ", deselect: "Würfel abwählen mit ", rolling: "Würfel wird geworfen: ", name: "Digitale Würfelmaschine" },
};

export function randomDieValue(crypto = globalThis.crypto, fallback = Math.random) {
  if (crypto?.getRandomValues) {
    const sample = new Uint32Array(1);
    // 2^32 is not divisible by six. Reject its last four values before modulo.
    do { crypto.getRandomValues(sample); } while (sample[0] >= 4294967292);
    return sample[0] % 6 + 1;
  }
  // For browsers without Web Crypto, use the standard uniform Math.random range.
  return Math.floor(fallback() * 6) + 1;
}

export function createDiceState() {
  return { dice: [1, 2, 3, 4].map((value, id) => ({ id, value })), selectedIds: [], hasRolled: false, rolling: false };
}

export function beginDiceRoll(state, randomDie = randomDieValue) {
  if (state.rolling) return state;
  const dice = state.dice.map(({ id }) => {
    const value = randomDie();
    if (!Number.isInteger(value) || value < 1 || value > 6) throw new RangeError("A die must be an integer from 1 to 6.");
    return { id, value };
  });
  return { dice, selectedIds: [], hasRolled: true, rolling: true };
}

export function finishDiceRoll(state) {
  return state.rolling ? { ...state, rolling: false } : state;
}

export function selectDigitalDie(state, id) {
  if (!state.hasRolled || state.rolling || state.selectedIds.length >= 2
      || state.selectedIds.includes(id) || !state.dice.some((die) => die.id === id)) return state;
  return { ...state, selectedIds: [...state.selectedIds, id] };
}

export function deselectDigitalDie(state, id) {
  return state.rolling || !state.selectedIds.includes(id) ? state
    : { ...state, selectedIds: state.selectedIds.filter((selected) => selected !== id) };
}

export function getDigitalDiceLayout(state, selectionSpace = 0) {
  const visible = state.dice.filter((die) => !state.selectedIds.includes(die.id));
  const height = Math.max(0, DICE_REGION.height - selectionSpace);
  const size = Math.min(DICE_REGION.width * 0.8, height / (visible.length + 0.6));
  return visible.map(({ id }, index) => ({ id, centerY: (index + 0.5) / visible.length * 100, width: size / DICE_REGION.width * 100 }));
}

export function initializeDigitalDice(document, options = {}) {
  const view = document.defaultView;
  const machine = document.getElementById("digital-dice");
  const frame = document.getElementById("digital-dice-machine");
  const toggle = document.getElementById("digital-dice-toggle");
  const toggleLabel = document.getElementById("digital-dice-toggle-label");
  const panel = document.getElementById("digital-dice-panel");
  const lever = document.getElementById("digital-dice-lever");
  const area = document.getElementById("digital-dice-column");
  const status = document.getElementById("digital-dice-label");
  const selectionArea = status.parentNode;
  const chosen = document.getElementById("digital-dice-chosen");
  const motion = options.motion ?? view.matchMedia?.("(prefers-reduced-motion: reduce)") ?? { matches: false };
  const randomDie = options.randomDie ?? (() => randomDieValue(view.crypto));
  const setTimer = options.setTimeout ?? view.setTimeout.bind(view);
  const clearTimer = options.clearTimeout ?? view.clearTimeout.bind(view);
  const timers = new Set();
  const unlisten = [];
  const cards = new Map();
  const choices = new Map();
  let state = createDiceState();
  let language = document.getElementById("rules-language-de")?.getAttribute("aria-pressed") === "true" ? "de" : "en";
  let leaving = new Set();
  let faces = [1, 2, 3, 4];
  let stopped = 4;
  let generation = 0;
  let destroyed = false;
  let pointer = null;
  let suppressClick = false;
  let shownSelection = "";
  let expanded = false;
  const preferenceStorage = () => options.storage === undefined ? view.localStorage : options.storage;
  try {
    expanded = preferenceStorage().getItem(DIGITAL_DICE_EXPANDED_KEY) === "true";
  } catch {
    // Blocked storage leaves the disclosure collapsed and usable for this visit.
  }

  function listen(target, type, action, settings) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, action, settings);
    unlisten.push(() => target.removeEventListener?.(type, action, settings));
  }

  function schedule(action, delay) {
    const token = generation;
    const id = setTimer(() => {
      timers.delete(id);
      if (!destroyed && token === generation) action();
    }, delay);
    timers.add(id);
  }

  function clearWork() {
    generation += 1;
    timers.forEach(clearTimer);
    timers.clear();
    leaving.clear();
  }

  function renderDisclosure() {
    if (!expanded && panel.contains(document.activeElement)) toggle.focus({ preventScroll: true });
    machine.dataset.expanded = String(expanded);
    toggle.setAttribute("aria-expanded", String(expanded));
    toggleLabel.textContent = labels[language].toggle;
    panel.inert = !expanded;
    panel.setAttribute("aria-hidden", String(!expanded));
  }

  listen(toggle, "click", () => {
    expanded = !expanded;
    renderDisclosure();
    try {
      preferenceStorage().setItem(DIGITAL_DICE_EXPANDED_KEY, String(expanded));
    } catch {
      // Visibility still changes when preferences cannot be saved.
    }
  });

  for (const die of state.dice) {
    const card = document.getElementById("digital-die-" + die.id) ?? document.createElement("button");
    card.id = "digital-die-" + die.id;
    card.type = "button";
    card.className = "digital-die";
    card.dataset.dieId = String(die.id);
    const art = card.querySelector("img") ?? document.createElement("img");
    art.src = FACE_PATH + die.value + ".png";
    art.alt = "";
    art.width = 2048;
    art.height = 2048;
    art.draggable = false;
    if (!art.parentNode) card.append(art);
    if (!card.parentNode) area.append(card);
    cards.set(die.id, { card, art });
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "digital-dice__chosen-value";
    choice.dataset.dieId = String(die.id);
    choices.set(die.id, choice);
    listen(card, "click", () => {
      if (destroyed) return;
      const next = selectDigitalDie(state, die.id);
      if (next === state) return;
      state = next;
      if (!motion.matches) {
        leaving.add(die.id);
        schedule(() => { leaving.delete(die.id); render(); }, 180);
      }
      render();
      choice.focus({ preventScroll: true });
    });
    listen(choice, "click", () => {
      if (destroyed) return;
      const next = deselectDigitalDie(state, die.id);
      if (next === state) return;
      state = next;
      leaving.delete(die.id);
      render();
      card.focus({ preventScroll: true });
    });
  }

  function render() {
    renderDisclosure();
    const text = labels[language];
    machine.dataset.rolling = String(state.rolling);
    machine.setAttribute("aria-busy", String(state.rolling));
    machine.setAttribute("aria-label", text.name);
    area.setAttribute("aria-label", language === "de" ? "Vier Würfel" : "Four dice");
    lever.disabled = state.rolling;
    lever.setAttribute("aria-label", text.roll);
    status.textContent = state.selectedIds.length ? text.chosen : "";
    status.hidden = state.selectedIds.length === 0;
    chosen.hidden = state.selectedIds.length === 0;
    const key = state.selectedIds.join(",");
    if (key !== shownSelection) {
      const nodes = [];
      state.selectedIds.forEach((id, index) => {
        if (index > 0) {
          const comma = document.createElement("span");
          comma.textContent = ",";
          comma.setAttribute("aria-hidden", "true");
          nodes.push(comma);
        }
        nodes.push(choices.get(id));
      });
      chosen.replaceChildren(...nodes);
      shownSelection = key;
    }
    // Reserve actual text height only while selected; rolling always uses all 1380px.
    let selectionSpace = 0;
    if (state.selectedIds.length) {
      const height = frame.getBoundingClientRect().height;
      if (height > 0) {
        const gap = parseFloat(view.getComputedStyle(selectionArea).marginBottom) || 0;
        selectionSpace = (selectionArea.getBoundingClientRect().height + gap) / height * MACHINE_HEIGHT;
      }
    }
    const layout = getDigitalDiceLayout(state, selectionSpace);
    area.style.setProperty("--digital-selection-space", selectionSpace / MACHINE_HEIGHT * 100 + "%");
    machine.dataset.visibleDice = String(layout.length);
    for (const [index, die] of state.dice.entries()) {
      const { card, art } = cards.get(die.id);
      const position = layout.find((entry) => entry.id === die.id);
      card.hidden = !position && !leaving.has(die.id);
      card.dataset.leaving = String(leaving.has(die.id));
      card.dataset.rolling = String(state.rolling && index >= stopped);
      card.disabled = !state.hasRolled || state.rolling || !position || state.selectedIds.length === 2;
      card.setAttribute("aria-label", state.rolling && index >= stopped ? text.rolling + (index + 1)
        : !state.hasRolled ? (language === "de" ? "Würfel mit " : "Die showing ") + die.value : text.select + die.value);
      card.setAttribute("aria-pressed", "false");
      if (position) {
        card.style.setProperty("--digital-die-y", position.centerY + "%");
        card.style.setProperty("--digital-die-width", position.width + "%");
      }
      art.src = FACE_PATH + faces[index] + ".png";
      const choice = choices.get(die.id);
      choice.textContent = String(die.value);
      choice.disabled = state.rolling;
      choice.setAttribute("aria-label", text.deselect + die.value);
    }
  }

  function finishNow() {
    clearWork();
    state = finishDiceRoll(state);
    stopped = 4;
    faces = state.dice.map((die) => die.value);
    render();
  }

  function roll(startAngle = 0) {
    if (destroyed || state.rolling) return;
    const next = beginDiceRoll(state, randomDie);
    clearWork();
    state = next;
    stopped = 0;
    lever.style.setProperty("--digital-lever-start-angle", startAngle + "deg");
    lever.style.setProperty("--digital-lever-pull-angle", "0deg");
    render();
    if (motion.matches) { finishNow(); return; }
    let frame = 0;
    function cycle() {
      frame += 1;
      state.dice.forEach((die, index) => {
        if (index < stopped) return;
        faces[index] = (frame + index) % 6 + 1;
        cards.get(die.id).art.src = FACE_PATH + faces[index] + ".png";
      });
      if (state.rolling) schedule(cycle, 80);
    }
    cycle();
    DICE_STOP_TIMES.forEach((delay, index) => schedule(() => {
      stopped = index + 1;
      faces[index] = state.dice[index].value;
      if (stopped === 4) finishNow();
      else render();
    }, delay));
  }

  function releasePointer() {
    const id = pointer?.id;
    pointer = null;
    if (id !== undefined && lever.hasPointerCapture?.(id)) lever.releasePointerCapture(id);
    lever.style.setProperty("--digital-lever-pull-angle", "0deg");
  }

  listen(lever, "pointerdown", (event) => {
    if (destroyed || state.rolling || pointer || event.isPrimary === false || (event.button ?? 0) !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0 };
    suppressClick = true;
    lever.setPointerCapture?.(event.pointerId);
    lever.focus({ preventScroll: true });
    event.preventDefault();
  });
  listen(lever, "pointermove", (event) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    pointer.dx = event.clientX - pointer.x;
    pointer.dy = event.clientY - pointer.y;
    lever.style.setProperty("--digital-lever-pull-angle", -Math.min(32, Math.max(0, pointer.dy) / 18 * 32) + "deg");
  });
  listen(lever, "pointerup", (event) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    const activated = Math.hypot(dx, dy) <= 8 || (dy >= 14 && Math.abs(dx) <= Math.max(40, dy * 1.5));
    const angle = -Math.min(32, Math.max(0, dy) / 18 * 32);
    releasePointer();
    if (activated) roll(angle);
    // Some touch browsers synthesize a click after pointerup, even without detail.
    schedule(() => { suppressClick = false; }, 500);
  });
  listen(lever, "pointercancel", () => { releasePointer(); suppressClick = false; });
  listen(lever, "lostpointercapture", () => { if (pointer) releasePointer(); });
  listen(lever, "keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") suppressClick = false;
  });
  listen(lever, "click", (event) => {
    if (suppressClick || (event.detail ?? 0) > 0 || event.pointerType) {
      suppressClick = false;
      event.preventDefault();
      return;
    }
    roll(); // Native Enter/Space and assistive activation produce a zero-detail click.
  });
  listen(lever, "dragstart", (event) => event.preventDefault());
  listen(document, "ruleslanguagechange", (event) => {
    language = event.detail;
    render();
  });
  listen(view, "resize", render);
  listen(view, "pagehide", () => { releasePointer(); finishNow(); });
  listen(motion, "change", () => { if (motion.matches) finishNow(); });
  render();

  return {
    getState() { return { ...state, dice: state.dice.map((die) => ({ ...die })), selectedIds: [...state.selectedIds] }; },
    destroy() {
      if (destroyed) return;
      finishNow();
      releasePointer();
      destroyed = true;
      lever.disabled = true;
      cards.forEach(({ card }) => { card.disabled = true; });
      choices.forEach((choice) => { choice.disabled = true; });
      unlisten.forEach((remove) => remove());
    },
  };
}

// Wait for the existing Rules module to restore the preferred language first.
if (typeof document !== "undefined") {
  const start = () => { if (document.getElementById("digital-dice")) initializeDigitalDice(document); };
  if (document.readyState === "complete") start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
}
