import { runGameTests } from "./game.test.js";
import { runNumberInputTests } from "./number-input.test.js";
import { runFrozenPrimeTests } from "./frozen-prime.test.js";
import { runScoringTests } from "./scoring.test.js";
import { runGoalTests } from "./goal.test.js";
import { runStorageTests } from "./storage.test.js";
import { runAppInitializationTests } from "./app-initialization.test.js";
import { runUndoTests } from "./undo.test.js";
import { runAttackIceTests } from "./attack-ice.test.js";
import { runChallengeTests } from "./challenge.test.js";

const results = [...runGameTests(), ...runNumberInputTests(), ...runFrozenPrimeTests(), ...runScoringTests(), ...runGoalTests(), ...runStorageTests(), ...runAppInitializationTests(), ...runUndoTests(), ...runAttackIceTests(), ...runChallengeTests()];
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
