import { initializeApp } from "../js/app.js";
import { confirmGameBid, createGameState, cloneBoard, placeGameNumber } from "../js/game.js";
import { initializeRules, RULES_LANGUAGE_KEY } from "../js/rules.js";
import { serializeGame, STORAGE_KEY } from "../js/storage.js";
import { appTestStorage } from "./app-initialization.test.js";
import { rulesDocument } from "./rules.test.js";
import { assert, assertDeepEqual, assertEqual } from "./assert.js";

const MEADOWS = ["background_meadow.png", "background_meadow_desert.png", "background_meadow_snow.png", "background_meadow_sea.png"];

function meadowScript(html) {
  const match = html.match(/<script id="meadow-background">([\s\S]*?)<\/script>/);
  assert(match, "The early meadow initializer must exist");
  return match[1];
}

// Execute the real inline initializer with DOM/random/URL doubles, no browser.
function selectMeadow(html, sample, document = rulesDocument(), baseURI = "https://frostydice.com/") {
  const writes = [];
  let randomCalls = 0;
  document.baseURI = baseURI;
  document.documentElement = { style: { setProperty(name, value) { writes.push([name, value]); } } };
  const random = { floor: Math.floor, random() { randomCalls += 1; return sample; } };
  class URLDouble {
    constructor(path, base) {
      assertEqual(base, baseURI);
      assert(path.startsWith("./assets/"));
      this.href = base.slice(0, base.lastIndexOf("/") + 1) + path.slice(2);
    }
  }
  const blockedStorage = {
    getItem() { throw new Error("Background selection must not read storage"); },
    setItem() { throw new Error("Background selection must not write storage"); },
    removeItem() { throw new Error("Background selection must not clear storage"); },
  };
  new Function("document", "Math", "URL", "localStorage", "sessionStorage", meadowScript(html))(
    document, random, URLDouble, blockedStorage, blockedStorage);
  return { document, writes, get randomCalls() { return randomCalls; } };
}

export async function runMeadowTests(sources) {
  const results = [];
  function test(name, action) {
    try { action(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, message: error.message }); }
  }
  if (!sources) {
    try {
      const paths = { html: "../index.html", css: "../css/style.css" };
      sources = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([name, url]) => {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error("Cannot load " + url);
        return [name, await response.text()];
      })));
    } catch (error) {
      return [{ name: "Meadow source files are available", passed: false, message: error.message }];
    }
  }

  test("Meadow selection is synchronous in the head before the stylesheet and body", () => {
    meadowScript(sources.html);
    const position = sources.html.indexOf('<script id="meadow-background">');
    assert(position > sources.html.indexOf("<head>"));
    assert(position < sources.html.indexOf('<link rel="stylesheet"'));
    assert(position < sources.html.indexOf("</head>"));
    assert(position < sources.html.indexOf("<body>"));
  });

  test("Exactly the four intended images occupy equal one-quarter random intervals", () => {
    for (let index = 0; index < MEADOWS.length; index += 1) {
      for (const sample of [index / MEADOWS.length, (index + 0.5) / MEADOWS.length, (index + 1) / MEADOWS.length - Number.EPSILON]) {
        const selection = selectMeadow(sources.html, sample);
        assertEqual(selection.randomCalls, 1);
        assertDeepEqual(selection.writes,
          [["--background-meadow-image", 'url("https://frostydice.com/assets/' + MEADOWS[index] + '")']]);
      }
    }
  });

  test("Meadow URLs resolve from the document on both the root domain and project subpaths", () => {
    for (const baseURI of ["https://frostydice.com/", "http://localhost:8000/index.html", "https://example.org/frosty-dice/index.html"]) {
      const selection = selectMeadow(sources.html, 1.5 / MEADOWS.length, rulesDocument(), baseURI);
      const directory = baseURI.slice(0, baseURI.lastIndexOf("/") + 1);
      assertEqual(selection.writes[0][1], 'url("' + directory + 'assets/background_meadow_desert.png")');
    }
  });

  test("Selection leaves the saved board, ice history, Undo, spending, and language unchanged", () => {
    let game = createGameState();
    game = placeGameNumber(game, "A1", 23);
    game = placeGameNumber(game, "B1", 31);
    game = placeGameNumber(game, "A2", 23);
    const historicalBoard = cloneBoard(game.board);
    historicalBoard[0][0].attackIce = true;
    game = { board: historicalBoard, undo: { board: game.board } }; // A compatible old save.
    game = confirmGameBid(game, 5);
    const before = JSON.stringify(game);
    const serialized = serializeGame(game);
    const storage = appTestStorage(serialized);
    storage.setItem(RULES_LANGUAGE_KEY, "de");
    const document = rulesDocument();
    document.defaultView.localStorage = storage;
    document.defaultView.sessionStorage = storage;
    selectMeadow(sources.html, 0.9, document);
    assertEqual(JSON.stringify(game), before);
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
    assertEqual(storage.getItem(RULES_LANGUAGE_KEY), "de");
    initializeApp(document, storage);
    initializeRules(document, storage);
    assertEqual(document.getElementById("cell-B1").dataset.state, "thawed");
    assertEqual(document.getElementById("cell-A2").dataset.state, "frozen");
    assertEqual(document.getElementById("cell-A1").dataset.attackIce, "true");
    assertEqual(document.getElementById("current-score").textContent, "18");
    assertEqual(document.getElementById("undo-move").disabled, false);
    assertEqual(storage.getItem(STORAGE_KEY), serialized);
  });

  test("Placement, Undo, Reset, Challenge, language, and Additional Rules keep the chosen meadow", () => {
    for (const sample of MEADOWS.map((_, index) => (index + 0.5) / MEADOWS.length)) {
      const selection = selectMeadow(sources.html, sample);
      const document = selection.document;
      const storage = appTestStorage();
      const chosen = [...selection.writes[0]];
      initializeApp(document, storage);
      initializeRules(document, storage);
      function unchanged() {
        assertEqual(selection.randomCalls, 1);
        assertDeepEqual(selection.writes, [chosen]);
      }
      function place() {
        document.getElementById("board-rows").emit("click", document.getElementById("cell-A1"));
        const input = document.getElementById("cell-A1");
        input.value = "22";
        input.emit("input");
        assertEqual(document.getElementById("current-score").textContent, "44");
        unchanged();
      }
      place();
      document.getElementById("open-challenge").emit("click");
      assertEqual(document.getElementById("challenge-dialog").open, true);
      unchanged();
      document.getElementById("close-challenge").emit("click");
      document.getElementById("undo-move").emit("click");
      assertEqual(document.getElementById("cell-A1").dataset.state, "empty");
      unchanged();
      place();
      document.getElementById("new-game").emit("click");
      document.getElementById("confirm-new-game").emit("click");
      assertEqual(storage.getItem(STORAGE_KEY), null);
      unchanged();
      for (const language of ["de", "en"]) {
        document.getElementById("rules-language-" + language).emit("click");
        document.getElementById("open-additional-rules").emit("click");
        assertEqual(document.getElementById("additional-rules-dialog").open, true);
        unchanged();
        document.getElementById("close-additional-rules").emit("click");
        unchanged();
      }
    }
  });

  test("The selected image uses the existing aspect-preserving meadow layer and green continuation", () => {
    const meadow = sources.css.match(/(?:^|\})\s*body::after\s*\{([^}]+)\}/)?.[1];
    assert(meadow);
    assert(meadow.includes("background-image: var(--background-meadow-image), none;"));
    assert(meadow.includes("background-size: var(--meadow-width) auto;"));
    assert(meadow.includes("background-position: center calc(var(--background-horizon) - var(--meadow-width) * 1.56875);"));
    assert(meadow.includes("background-color: var(--background-ground-color);"));
    assert(sources.css.includes('--background-meadow-image: url("../assets/background_meadow.png");'));
  });

  return results;
}
