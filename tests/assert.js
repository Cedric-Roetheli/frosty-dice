export function assert(condition, message = "Assertion failed") {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertEqual(actual, expected) {
  assert(Object.is(actual, expected), `Expected ${expected}, received ${actual}`);
}

export function assertDeepEqual(actual, expected) {
  assertEqual(JSON.stringify(actual), JSON.stringify(expected));
}

export function assertThrows(action, expectedMessage) {
  let caughtError;
  try {
    action();
  } catch (error) {
    caughtError = error;
  }
  assert(caughtError instanceof Error, "Expected an error");
  if (expectedMessage) {
    assert(caughtError.message.includes(expectedMessage), `Expected error to include ${expectedMessage}`);
  }
}
