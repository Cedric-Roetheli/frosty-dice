import { runGameTests } from "./game.test.js";
import { runOwnRollTests } from "./own-roll.test.js";
import { runExternalNumberTests } from "./external-number.test.js";
import { runSchnapszahlTests } from "./schnapszahl.test.js";
import { runScoringTests } from "./scoring.test.js";

const results = [...runGameTests(), ...runOwnRollTests(), ...runExternalNumberTests(), ...runSchnapszahlTests(), ...runScoringTests()];
const failed = results.filter((result) => !result.passed).length;
const summary = document.getElementById("test-summary");
summary.textContent = `${results.length - failed}/${results.length} tests passed; ${failed} failed.`;
summary.dataset.failed = String(failed);

const items = results.map((result) => {
  const item = document.createElement("li");
  item.textContent = `${result.passed ? "PASS" : "FAIL"}: ${result.name}${result.message ? ` — ${result.message}` : ""}`;
  return item;
});

document.getElementById("test-results").replaceChildren(...items);
