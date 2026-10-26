import { initializeRules, RULES_LANGUAGE_KEY } from "../js/rules.js";
import { initializeApp } from "../js/app.js";
import { STORAGE_KEY } from "../js/storage.js";
import { appTestDocument, appTestStorage } from "./app-initialization.test.js";
import { assert, assertDeepEqual, assertEqual } from "./assert.js";

function rulesDocument() {
  const document = appTestDocument();
  for (const [tag, id] of [["h2", "rules-heading"], ["img", "rules-image"],
    ["img", "rules-fill-de"], ["img", "rules-fill-en"],
    ["button", "rules-language-de"], ["button", "rules-language-en"],
    ["button", "open-additional-rules"], ["dialog", "additional-rules-dialog"],
    ["h2", "additional-rules-heading"], ["div", "additional-rules-text"],
    ["button", "close-additional-rules"]]) {
    const node = document.createElement(tag);
    node.id = id;
    node.style = {};
    if (tag === "button") node.type = "button";
    document.root.append(node);
  }
  document.getElementById("rules-heading").textContent = "Rules";
  document.body = document.root;
  document.body.style = { position: "", top: "", left: "", width: "", overflow: "" };
  document.defaultView.scrollX = 0;
  document.defaultView.scrollY = 0;
  document.defaultView.scrollCalls = [];
  document.defaultView.scrollTo = (options) => {
    document.defaultView.scrollCalls.push(options);
    document.defaultView.scrollX = options.left;
    document.defaultView.scrollY = options.top;
  };
  document.getElementById("additional-rules-dialog").getBoundingClientRect = () => ({
    left: 20, top: 20, right: 300, bottom: 500,
  });
  return document;
}

function selectLanguage(document, language, properties) {
  const button = document.getElementById("rules-language-" + language);
  return button.emit("click", button, properties);
}

function assertLanguage(document, language) {
  const image = document.getElementById("rules-image");
  assertEqual(image.src, language === "de" ? "./assets/rules_german.png" : "./assets/Rules.png");
  assertEqual(image.lang, language);
  assertEqual(image.width, 2480);
  assertEqual(image.height, 3508);
  assertEqual(document.getElementById("rules-heading").textContent, "Rules");
  for (const option of ["de", "en"]) {
    assertEqual(document.getElementById("rules-language-" + option).getAttribute("aria-pressed"), String(option === language));
    assertEqual(document.getElementById("rules-fill-" + option).hidden, option !== language);
  }
}

function openAdditionalRules(document) {
  document.getElementById("open-additional-rules").emit("click");
  return document.getElementById("additional-rules-dialog");
}

function closeAdditionalRules(document) {
  document.getElementById("close-additional-rules").emit("click");
}

export function runRulesTests() {
  const results = [];
  function test(name, action) {
    try { action(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, message: error.message }); }
  }

  test("Rules default to English with only EN filled and no preference write", () => {
    const document = rulesDocument();
    const storage = appTestStorage();
    initializeRules(document, storage);
    assertLanguage(document, "en");
    assertEqual(storage.getItem(RULES_LANGUAGE_KEY), null);
  });

  test("DE selects the German illustration, active fill, and dedicated preference", () => {
    const document = rulesDocument();
    const storage = appTestStorage();
    initializeRules(document, storage);
    selectLanguage(document, "de");
    assertLanguage(document, "de");
    assertEqual(storage.getItem(RULES_LANGUAGE_KEY), "de");
    assertEqual(storage.getItem(STORAGE_KEY), null);
  });

  test("EN restores the English illustration and replaces the DE fill", () => {
    const document = rulesDocument();
    const storage = appTestStorage();
    initializeRules(document, storage);
    selectLanguage(document, "de");
    selectLanguage(document, "en");
    assertLanguage(document, "en");
    assertEqual(storage.getItem(RULES_LANGUAGE_KEY), "en");
  });

  test("The last selected language is restored on a fresh page for either language", () => {
    for (const language of ["de", "en"]) {
      const storage = appTestStorage();
      const first = rulesDocument();
      initializeRules(first, storage);
      selectLanguage(first, language);
      const restored = rulesDocument();
      initializeRules(restored, storage);
      assertLanguage(restored, language);
    }
  });

  test("Unknown or malformed preferences fall back to English without rewriting storage", () => {
    for (const value of ["", "DE", "fr", "__proto__", '{"language":"de"}']) {
      const storage = appTestStorage();
      storage.setItem(RULES_LANGUAGE_KEY, value);
      const document = rulesDocument();
      initializeRules(document, storage);
      assertLanguage(document, "en");
      assertEqual(storage.getItem(RULES_LANGUAGE_KEY), value);
    }
  });

  test("Selecting a language leaves existing game-save bytes and other preferences untouched", () => {
    const storage = appTestStorage("existing game save");
    storage.setItem("other-preference", "keep");
    const document = rulesDocument();
    initializeRules(document, storage);
    selectLanguage(document, "de");
    selectLanguage(document, "en");
    assertEqual(storage.getItem(STORAGE_KEY), "existing game save");
    assertEqual(storage.getItem("other-preference"), "keep");
  });

  test("The real New Game confirmation clears the game but retains the selected language", () => {
    const document = rulesDocument();
    const storage = appTestStorage();
    initializeApp(document, storage);
    initializeRules(document, storage);
    selectLanguage(document, "de");
    const rows = document.getElementById("board-rows");
    rows.emit("click", document.getElementById("cell-A1"));
    const input = document.getElementById("cell-A1");
    input.value = "22";
    input.emit("input");
    assert(storage.getItem(STORAGE_KEY) !== null);
    document.getElementById("new-game").emit("click");
    document.getElementById("confirm-new-game").emit("click");
    assertEqual(storage.getItem(STORAGE_KEY), null);
    assertEqual(storage.getItem(RULES_LANGUAGE_KEY), "de");
    assertLanguage(document, "de");
    const restored = rulesDocument();
    initializeRules(restored, storage);
    assertLanguage(restored, "de");
  });

  test("Native keyboard-generated button clicks select either language without moving focus", () => {
    const document = rulesDocument();
    initializeRules(document, appTestStorage());
    for (const language of ["de", "en"]) {
      const button = document.getElementById("rules-language-" + language);
      assertEqual(button.tagName, "button");
      assertEqual(button.type, "button");
      button.focus();
      selectLanguage(document, language, { detail: 0 });
      assertEqual(document.activeElement, button);
      assertLanguage(document, language);
    }
  });

  test("Blocked preference reads and writes do not prevent switching", () => {
    const document = rulesDocument();
    const storage = {
      getItem() { throw new Error("Storage blocked"); },
      setItem() { throw new Error("Storage blocked"); },
    };
    initializeRules(document, storage);
    assertLanguage(document, "en");
    selectLanguage(document, "de");
    assertLanguage(document, "de");
    selectLanguage(document, "en");
    assertLanguage(document, "en");
  });

  test("An inaccessible localStorage property does not break the Rules section", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    try {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true, get() { throw new Error("Access denied"); },
      });
      const document = rulesDocument();
      initializeRules(document);
      selectLanguage(document, "de");
      assertLanguage(document, "de");
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
      else delete globalThis.localStorage;
    }
  });

  test("A quota error keeps the chosen illustration usable without changing the saved preference", () => {
    const document = rulesDocument();
    const storage = appTestStorage();
    storage.setItem(RULES_LANGUAGE_KEY, "de");
    storage.setItem = () => { throw new Error("Quota exceeded"); };
    initializeRules(document, storage);
    assertLanguage(document, "de");
    selectLanguage(document, "en");
    assertLanguage(document, "en");
    assertEqual(storage.getItem(RULES_LANGUAGE_KEY), "de");
    const dialog = openAdditionalRules(document);
    assertEqual(dialog.lang, "en");
    closeAdditionalRules(document);
  });

  test("The English yellow box opens the exact English paragraphs with accessible focus", () => {
    const document = rulesDocument();
    initializeRules(document, appTestStorage());
    const dialog = openAdditionalRules(document);
    assertEqual(dialog.open, true);
    assertEqual(dialog.lang, "en");
    assertEqual(document.getElementById("additional-rules-heading").textContent, "Additional Rules");
    assertDeepEqual(document.getElementById("additional-rules-text").children.map((node) => node.textContent), [
      "All numbers placed on the board turn into points.",
      "Placing two prime numbers next to eachother freezes the cell.",
      "Points may be used to challenge another player. The challenge is a blind auction and works as follows: both players secretly bid points, bids are then confirmed and revealed. The higher bid wins.",
      "Both bids are spent and the points subtracted from the players.",
      "The winner may freeze a cell of the losers board or unfreeze their own cell.",
    ]);
    assertEqual(document.activeElement, document.getElementById("close-additional-rules"));
    assertEqual(document.body.style.position, "fixed");
  });

  test("The German yellow box opens the exact German heading and paragraphs", () => {
    const document = rulesDocument();
    initializeRules(document, appTestStorage());
    selectLanguage(document, "de");
    const dialog = openAdditionalRules(document);
    assertEqual(dialog.lang, "de");
    assertEqual(document.getElementById("additional-rules-heading").textContent, "Zusätzliche Regeln");
    assertEqual(document.getElementById("close-additional-rules").getAttribute("aria-label"), "Zusätzliche Regeln schließen");
    assertDeepEqual(document.getElementById("additional-rules-text").children.map((node) => node.textContent), [
      "Alle Zahlen, die auf dem Spielfeld platziert werden, zählen als Punkte.",
      "Werden zwei Primzahlen nebeneinander platziert, friert das entsprechende Feld ein.",
      "Punkte können verwendet werden, um einen anderen Spieler herauszufordern. Die Herausforderung erfolgt in Form einer verdeckten Auktion und funktioniert wie folgt:",
      "Beide Spieler bieten geheim eine bestimmte Anzahl Punkte. Sobald beide Gebote bestätigt wurden, werden sie aufgedeckt. Der Spieler mit dem höheren Gebot gewinnt.",
      "Beide Spieler verlieren die jeweils gebotenen Punkte, unabhängig davon, wer gewonnen hat.",
      "Der Gewinner darf entweder ein Feld auf dem Spielfeld des Verlierers einfrieren oder eines seiner eigenen eingefrorenen Felder auftauen.",
    ]);
  });

  test("Only the measured yellow-box button opens the popup for either image", () => {
    const document = rulesDocument();
    initializeRules(document, appTestStorage());
    document.getElementById("rules-image").emit("click");
    assertEqual(document.getElementById("additional-rules-dialog").open, false);
    for (const language of ["en", "de"]) {
      selectLanguage(document, language);
      const trigger = document.getElementById("open-additional-rules");
      assertEqual(trigger.hidden, false);
      assertEqual(parseFloat(trigger.style.left), 73 / 2480 * 100);
      assertEqual(parseFloat(trigger.style.top), 2754 / 3508 * 100);
      assertEqual(parseFloat(trigger.style.width), 2312 / 2480 * 100);
      assertEqual(parseFloat(trigger.style.height), 696 / 3508 * 100);
      trigger.focus();
      trigger.emit("click", trigger, { detail: 0 });
      assertEqual(document.getElementById("additional-rules-dialog").open, true);
      closeAdditionalRules(document);
    }
  });

  test("The close button restores exact page styles, scroll position, and opener focus", () => {
    const document = rulesDocument();
    const previous = { position: "relative", top: "4px", left: "2px", width: "98%", overflow: "visible" };
    Object.assign(document.body.style, previous);
    document.defaultView.scrollX = 7;
    document.defaultView.scrollY = 1730;
    initializeRules(document, appTestStorage());
    const dialog = openAdditionalRules(document);
    assertEqual(document.body.style.top, "-1730px");
    assertEqual(document.body.style.overflow, "hidden");
    closeAdditionalRules(document);
    assertEqual(dialog.open, false);
    assertDeepEqual(document.body.style, previous);
    assertDeepEqual(document.defaultView.scrollCalls, [{ left: 7, top: 1730, behavior: "instant" }]);
    assertEqual(document.activeElement, document.getElementById("open-additional-rules"));
    assertDeepEqual(document.activeElement.lastFocusOptions, { preventScroll: true });
  });

  test("Escape closes the popup and stops the event before underlying game handlers", () => {
    const document = rulesDocument();
    initializeRules(document, appTestStorage());
    const dialog = openAdditionalRules(document);
    let stopped = false;
    const event = dialog.emit("keydown", dialog, { key: "Escape", stopPropagation() { stopped = true; } });
    assertEqual(event.defaultPrevented, true);
    assertEqual(stopped, true);
    assertEqual(dialog.open, false);
    assertEqual(document.body.style.position, "");
  });

  test("Native cancellation also closes the popup and unlocks scrolling", () => {
    const document = rulesDocument();
    initializeRules(document, appTestStorage());
    const dialog = openAdditionalRules(document);
    assertEqual(dialog.emit("cancel").defaultPrevented, true);
    assertEqual(dialog.open, false);
    assertEqual(document.body.style.position, "");
  });

  test("A backdrop tap closes, while content, padding, and dragging out do not", () => {
    const document = rulesDocument();
    initializeRules(document, appTestStorage());
    const dialog = openAdditionalRules(document);
    const text = document.getElementById("additional-rules-text");
    dialog.emit("pointerdown", text, { clientX: 40, clientY: 40 });
    dialog.emit("click", text, { clientX: 40, clientY: 40 });
    assertEqual(dialog.open, true);
    dialog.emit("pointerdown", dialog, { clientX: 30, clientY: 30 });
    dialog.emit("click", dialog, { clientX: 30, clientY: 30 });
    assertEqual(dialog.open, true);
    dialog.emit("pointerdown", text, { clientX: 40, clientY: 40 });
    dialog.emit("click", dialog, { clientX: 10, clientY: 10 });
    assertEqual(dialog.open, true);
    dialog.emit("pointerdown", dialog, { clientX: 10, clientY: 10 });
    dialog.emit("click", dialog, { clientX: 10, clientY: 10 });
    assertEqual(dialog.open, false);
    assertEqual(document.body.style.position, "");
  });

  test("Reopening uses the current language, replaces old paragraphs, and starts at the top", () => {
    const document = rulesDocument();
    initializeRules(document, appTestStorage());
    openAdditionalRules(document);
    document.getElementById("additional-rules-text").scrollTop = 200;
    closeAdditionalRules(document);
    selectLanguage(document, "de");
    const dialog = openAdditionalRules(document);
    assertEqual(dialog.lang, "de");
    assertEqual(document.getElementById("additional-rules-text").children.length, 6);
    assertEqual(document.getElementById("additional-rules-text").scrollTop, 0);
    closeAdditionalRules(document);
    selectLanguage(document, "en");
    openAdditionalRules(document);
    assertEqual(document.getElementById("additional-rules-text").children.length, 5);
  });

  test("Repeated opening and late close events cannot overwrite the saved scroll position", () => {
    const document = rulesDocument();
    document.defaultView.scrollY = 1730;
    initializeRules(document, appTestStorage());
    const dialog = openAdditionalRules(document);
    document.defaultView.scrollY = 0;
    openAdditionalRules(document);
    dialog.emit("close");
    assertEqual(document.body.style.position, "fixed");
    closeAdditionalRules(document);
    assertEqual(document.defaultView.scrollY, 1730);
    assertEqual(document.defaultView.scrollCalls.length, 1);
  });

  test("External dialog closure restores scrolling, including when opening fails", () => {
    const document = rulesDocument();
    initializeRules(document, appTestStorage());
    const dialog = openAdditionalRules(document);
    dialog.close();
    dialog.emit("close");
    assertEqual(document.body.style.position, "");
    dialog.showModal = () => { throw new Error("Cannot open"); };
    let rejected = false;
    try { openAdditionalRules(document); } catch { rejected = true; }
    assertEqual(rejected, true);
    assertEqual(document.body.style.position, "");
  });

  test("Opening and closing Additional Rules preserves the real game, Undo, Challenge, and language preference", () => {
    const document = rulesDocument();
    const storage = appTestStorage();
    initializeApp(document, storage);
    initializeRules(document, storage);
    selectLanguage(document, "de");
    document.getElementById("board-rows").emit("click", document.getElementById("cell-A1"));
    document.getElementById("cell-A1").value = "22";
    document.getElementById("cell-A1").emit("input");
    const savedGame = storage.getItem(STORAGE_KEY);
    openAdditionalRules(document);
    closeAdditionalRules(document);
    assertEqual(storage.getItem(STORAGE_KEY), savedGame);
    assertEqual(storage.getItem(RULES_LANGUAGE_KEY), "de");
    assertEqual(document.getElementById("current-score").textContent, "44");
    assertEqual(document.getElementById("undo-move").disabled, false);
    assertEqual(document.getElementById("challenge-dialog").open, false);
  });

  return results;
}
