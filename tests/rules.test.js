import { initializeRules, RULES_LANGUAGE_KEY } from "../js/rules.js";
import { initializeApp } from "../js/app.js";
import { STORAGE_KEY } from "../js/storage.js";
import { appTestDocument, appTestStorage } from "./app-initialization.test.js";
import { assert, assertEqual } from "./assert.js";

function rulesDocument() {
  const document = appTestDocument();
  for (const [tag, id] of [["h2", "rules-heading"], ["img", "rules-image"],
    ["img", "rules-fill-de"], ["img", "rules-fill-en"],
    ["button", "rules-language-de"], ["button", "rules-language-en"]]) {
    const node = document.createElement(tag);
    node.id = id;
    if (tag === "button") node.type = "button";
    document.root.append(node);
  }
  document.getElementById("rules-heading").textContent = "Rules";
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

  test("DE selects the German illustration, yellow fill, and dedicated preference", () => {
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
  });

  return results;
}
