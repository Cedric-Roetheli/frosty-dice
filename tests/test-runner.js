import { runGameTests } from "./game.test.js";
import { runOwnRollTests } from "./own-roll.test.js";

const results = [...runGameTests(), ...runOwnRollTests()];
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
