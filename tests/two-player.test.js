import { createTwoPlayerBoard, createTwoPlayerState, getTwoPlayerColumnScores, getTwoPlayerDuels, getTwoPlayerHorizontalDirection, isValidTwoPlayerBoard, isValidTwoPlayerState, mapTwoPlayerColumn, placeTwoPlayerNumber, undoTwoPlayerMove, validateTwoPlayerPlacement } from "../js/two-player-game.js";
import { createFrontlineGeometry, directionArrowGeometry, FRONTLINE_THICKNESS, frontlineFraction, physicalColumnCenter } from "../js/two-player-frontline.js";
import { clearTwoPlayerGame, deserializeTwoPlayerGame, GAME_MODE_KEY, loadTwoPlayerGame, readGameMode, saveTwoPlayerGame, serializeTwoPlayerGame, TWO_PLAYER_STORAGE_KEY, writeGameMode } from "../js/two-player-storage.js";
import { createEmptyBoard, placeNumber, validatePlacement } from "../js/game.js";
import { assert, assertDeepEqual, assertEqual, assertThrows } from "./assert.js";
import { appTestStorage } from "./app-initialization.test.js";

function board(...entries) {
  const result = createTwoPlayerBoard();
  for (const [coordinate, value, status = "normal"] of entries) result[Number(coordinate[1]) - 1]["ABCDE".indexOf(coordinate[0])] = { value, status };
  return result;
}
function primeExample(state, player) {
  state = placeTwoPlayerNumber(state, player, "A3", player === 1 ? 31 : 23);
  return placeTwoPlayerNumber(state, player, "B3", player === 1 ? 23 : 31);
}

export function runTwoPlayerTests() {
  const results = [];
  function test(name, action) { try { action(); results.push({ name, passed: true }); } catch (error) { results.push({ name, passed: false, message: error.message }); } }

  test("Two independent boards each have 3 rows, 5 columns, 15 empty cells and no derived state", () => {
    const state = createTwoPlayerState();
    assertDeepEqual(Object.keys(state), ["player1", "player2", "undo"]);
    assertEqual(state.undo, null);
    assert(isValidTwoPlayerState(state));
    for (const player of [1, 2]) {
      assertEqual(state["player" + player].board.length, 3);
      assert(state["player" + player].board.every((row) => row.length === 5 && row.every((cell) => cell === null)));
    }
    state.player1.board[2][0] = { value: 12, status: "normal" };
    assertEqual(state.player2.board[2][0], null);
    assertEqual(createEmptyBoard().length, 7);
    assertEqual(createEmptyBoard()[0].length, 4);
  });

  test("Either player may begin in any outer-row cell, including 66, but nowhere in the inner rows", () => {
    for (const player of [1, 2]) for (const col of "ABCDE") {
      const state = placeTwoPlayerNumber(createTwoPlayerState(), player, col + "3", 66);
      assertEqual(state["player" + player].board[2]["ABCDE".indexOf(col)].value, 66);
      assertEqual(state["player" + (3 - player)].board.flat().filter(Boolean).length, 0);
    }
    for (const row of [1, 2]) for (const col of "ABCDE") assertEqual(validateTwoPlayerPlacement(createTwoPlayerBoard(), 2, col + row, 16).legal, false);
    assertThrows(() => placeTwoPlayerNumber(createTwoPlayerState(), 2, "A1", 16), "start");
  });

  test("Classic A1=66 stays prohibited while a 2P column of 66 can reach local A1", () => {
    assertEqual(validatePlacement(createEmptyBoard(), "A1", 66).legal, false);
    let state = createTwoPlayerState();
    for (const coordinate of ["A3", "A2", "A1"]) state = placeTwoPlayerNumber(state, 1, coordinate, 66);
    assertDeepEqual(getTwoPlayerColumnScores(state.player1.board), [396, 0, 0, 0, 0]);
  });

  test("Both players increase from physical left to right, despite opposite logical columns", () => {
    for (const player of [1, 2]) {
      const left = player === 1 ? "D3" : "B3";
      const right = player === 1 ? "C3" : "C3";
      let state = placeTwoPlayerNumber(createTwoPlayerState(), player, left, 24);
      const before = JSON.stringify(state);
      assertEqual(validateTwoPlayerPlacement(state["player" + player].board, player, right, 35).legal, true);
      assertEqual(validateTwoPlayerPlacement(state["player" + player].board, player, right, 16).legal, false);
      assertEqual(validateTwoPlayerPlacement(state["player" + player].board, player, right, 24).legal, false);
      assertThrows(() => placeTwoPlayerNumber(state, player, right, 16), "neighbor");
      assertEqual(JSON.stringify(state), before);
      state = placeTwoPlayerNumber(state, player, right, 35);
      const physical = [0, 1, 2, 3, 4].map((i) => state["player" + player].board[2][mapTwoPlayerColumn(player, i)]?.value ?? null);
      assertDeepEqual(physical.slice(1, 3), [24, 35]);
    }
    assertEqual(getTwoPlayerHorizontalDirection(1), -1);
    assertEqual(getTwoPlayerHorizontalDirection(2), 1);
  });

  test("Physical-left placement requires a smaller value on both boards", () => {
    for (const player of [1, 2]) {
      const right = player === 1 ? "C3" : "C3";
      const left = player === 1 ? "D3" : "B3";
      const occupied = board([right, 35]);
      assert(validateTwoPlayerPlacement(occupied, player, left, 24).legal);
      assert(!validateTwoPlayerPlacement(occupied, player, left, 46).legal);
      let state = placeTwoPlayerNumber(createTwoPlayerState(), player, right, 35);
      state = placeTwoPlayerNumber(state, player, left, 24);
      assertEqual(state["player" + player].board[2][mapTwoPlayerColumn(player, 1)].value, 24);
    }
  });

  test("Equality works above and below, without accepting a merely larger vertical number", () => {
    assert(validateTwoPlayerPlacement(board(["B3", 24]), 2, "B2", 24).legal);
    assert(!validateTwoPlayerPlacement(board(["B3", 24]), 2, "B2", 35).legal);
    assert(validateTwoPlayerPlacement(board(["B1", 24]), 2, "B2", 24).legal);
    assert(!validateTwoPlayerPlacement(board(["B1", 24]), 2, "B2", 16).legal);
  });

  test("OR relationships allow incompatible other neighbors in all directions", () => {
    assert(validateTwoPlayerPlacement(board(["A2", 16], ["B3", 24]), 2, "B2", 26).legal);
    assert(validateTwoPlayerPlacement(board(["C2", 46], ["B1", 24]), 2, "B2", 35).legal);
    assert(validateTwoPlayerPlacement(board(["A2", 46], ["B1", 24]), 2, "B2", 24).legal);
    assert(validateTwoPlayerPlacement(board(["C2", 16], ["B3", 24]), 2, "B2", 24).legal);
    // Player 1: the right-hand logical neighbor is physically left, so 24 > 16
    // is incompatible there, while the equal lower neighbor still supports it.
    assert(validateTwoPlayerPlacement(board(["A2", 16], ["B3", 24]), 1, "B2", 24).legal);
  });

  test("Diagonals, distant cells, and frozen cells cannot support placements; thawed cells can", () => {
    assert(!validateTwoPlayerPlacement(board(["A3", 16]), 2, "B2", 24).legal);
    assert(!validateTwoPlayerPlacement(board(["A3", 16]), 2, "C3", 24).legal);
    assert(!validateTwoPlayerPlacement(board(["A3", 23, "frozen"]), 2, "B3", 46).legal);
    assert(validateTwoPlayerPlacement(board(["A3", 23, "thawed"]), 2, "B3", 46).legal);
  });

  test("Occupied cells, invalid dice values, invalid coordinates, and invalid players are rejected", () => {
    const state = placeTwoPlayerNumber(createTwoPlayerState(), 1, "A3", 16);
    assertThrows(() => placeTwoPlayerNumber(state, 1, "A3", 24), "occupied");
    for (const value of [0, 17, 70, 123, "16", NaN, null]) assertEqual(validateTwoPlayerPlacement(createTwoPlayerBoard(), 2, "A3", value).legal, false);
    for (const coordinate of ["F3", "A4", "A0", "a3", null]) assertEqual(validateTwoPlayerPlacement(createTwoPlayerBoard(), 2, coordinate, 16).legal, false);
    for (const player of [0, 3, "1", null]) assertThrows(() => placeTwoPlayerNumber(state, player, "B3", 24));
  });

  test("Each player's Prime freeze/thaw is independent and a thawed prime remains usable and scoreless", () => {
    let state = primeExample(createTwoPlayerState(), 1);
    assertEqual(state.player1.board[2][0].status, "normal");
    assertEqual(state.player1.board[2][1].status, "frozen");
    state = primeExample(state, 2);
    const opponent = JSON.stringify(state.player2);
    state = placeTwoPlayerNumber(state, 1, "A2", 31);
    assertEqual(state.player1.board[1][0].status, "frozen");
    assertEqual(state.player1.board[2][1].status, "thawed");
    assertEqual(JSON.stringify(state.player2), opponent);
    assertDeepEqual(getTwoPlayerColumnScores(state.player1.board), [31, 0, 0, 0, 0]);
    state = placeTwoPlayerNumber(state, 1, "C3", 11);
    assertEqual(state.player1.board[2][2].value, 11);
    assertEqual(state.player1.board[2][1].status, "thawed");
    assertEqual(state.player2.board[2][1].status, "frozen");
  });

  test("Frozen/thawed prime contact still triggers the shared transition after a legal connection", () => {
    const previous = board(["A2", 23], ["B2", 31, "frozen"], ["C3", 41]);
    const state = { ...createTwoPlayerState(), player1: { board: previous } };
    const next = placeTwoPlayerNumber(state, 1, "C2", 41);
    assertEqual(next.player1.board[1][1].status, "thawed");
    assertEqual(next.player1.board[1][2].status, "frozen");
    const contact = { ...createTwoPlayerState(), player2: { board: board(["A2", 23, "thawed"], ["B3", 31]) } };
    assertEqual(placeTwoPlayerNumber(contact, 2, "B2", 31).player2.board[1][1].status, "frozen");
  });

  test("Invalid prime attempts neither thaw nor replace the latest authoritative Undo", () => {
    const state = primeExample(createTwoPlayerState(), 1);
    const before = JSON.stringify(state);
    assertThrows(() => placeTwoPlayerNumber(state, 1, "C3", 46), "neighbor");
    assertEqual(JSON.stringify(state), before);
    const restored = undoTwoPlayerMove(state);
    assertEqual(restored.player1.board[2][1], null);
    assertEqual(restored.undo, null);
  });

  test("Undo reverses the latest placement on either board and restores both exact Prime snapshots", () => {
    let state = primeExample(createTwoPlayerState(), 1);
    state = placeTwoPlayerNumber(state, 1, "A2", 31);
    const before = JSON.stringify(state);
    const moved = placeTwoPlayerNumber(state, 2, "E3", 66);
    const undone = undoTwoPlayerMove(moved);
    assertDeepEqual(undone.player1, state.player1); assertDeepEqual(undone.player2, state.player2);
    assertEqual(undone.undo, null);
    const thawUndo = undoTwoPlayerMove(state);
    assertEqual(thawUndo.player1.board[2][1].status, "frozen");
    assertEqual(thawUndo.player1.board[1][0], null);
    assertEqual(JSON.stringify(state), before);
    assertEqual(undoTwoPlayerMove(undone), undone);
  });

  test("Normal values and repdigits score by column; damaged cells score zero and Streets never multiply", () => {
    assertDeepEqual(getTwoPlayerColumnScores(board(["A1", 12], ["A2", 44], ["A3", 35], ["B1", 24], ["B3", 46])), [135, 70, 0, 0, 0]);
    assertDeepEqual(getTwoPlayerColumnScores(board(["A1", 11], ["B1", 22], ["C1", 33], ["D1", 44], ["E1", 66])), [22, 44, 66, 88, 132]);
    assertDeepEqual(getTwoPlayerColumnScores(board(["A1", 11, "frozen"], ["B1", 23, "thawed"])), [0, 0, 0, 0, 0]);
    assertDeepEqual(getTwoPlayerColumnScores(board(["A3", 12], ["B3", 13], ["C3", 14], ["D3", 15], ["E3", 16])), [12, 13, 14, 15, 16]);
  });

  test("Physical column mapping reverses only the top player's logical columns", () => {
    assertDeepEqual([0, 1, 2, 3, 4].map((i) => mapTwoPlayerColumn(1, i)), [4, 3, 2, 1, 0]);
    assertDeepEqual([0, 1, 2, 3, 4].map((i) => mapTwoPlayerColumn(2, i)), [0, 1, 2, 3, 4]);
    for (const player of [1, 2]) for (let i = 0; i < 5; i += 1) assertEqual(mapTwoPlayerColumn(player, mapTwoPlayerColumn(player, i)), i);
    const state = { ...createTwoPlayerState(), player1: { board: board(["E3", 16]) }, player2: { board: board(["A3", 24]) } };
    const duels = getTwoPlayerDuels(state);
    assertEqual(duels[0].player1.score, 16); assertEqual(duels[0].player2.score, 24);
    assertEqual(duels[4].player1.score, 0); assertEqual(duels[4].player2.score, 0);
  });

  for (const [a, b, litA, litB] of [[80, 65, true, false], [65, 80, false, true], [42, 42, true, true], [0, 0, false, false], [25, 0, true, false]]) {
    test(`Column duel ${a}:${b} has fixed ownership and illumination ${litA}:${litB}`, () => {
      // Construct totals from ordinary valid cells, including a repdigit where needed.
      const cells = { 80: [["E3", 36], ["E2", 22]], 65: [["A3", 65]], 42: [["A3", 42]], 25: [["E3", 25]], 0: [] };
      const values = (score, column) => (cells[score] ?? []).map(([coord, value]) => [column + coord[1], value]);
      const state = { player1: { board: board(...values(a, "E")) }, player2: { board: board(...values(b, "A")) }, undo: null };
      const duel = getTwoPlayerDuels(state)[0];
      assertDeepEqual(duel, { physical: 0, player1: { score: a, lit: litA }, player2: { score: b, lit: litB } });
      assertEqual(getTwoPlayerDuels(state).length, 5);
    });
  }

  test("Leadership and positive ties update dynamically without moving physical columns", () => {
    let state = placeTwoPlayerNumber(createTwoPlayerState(), 1, "E3", 24);
    assertEqual(getTwoPlayerDuels(state)[0].player1.lit, true);
    state = placeTwoPlayerNumber(state, 2, "A3", 24);
    assertEqual(getTwoPlayerDuels(state)[0].player2.lit, true);
    state = placeTwoPlayerNumber(state, 2, "A2", 24);
    assertEqual(getTwoPlayerDuels(state)[0].player1.lit, false);
    assertEqual(getTwoPlayerDuels(state)[0].player2.lit, true);
    assertDeepEqual(Object.keys(getTwoPlayerDuels(state)[0]), ["physical", "player1", "player2"]);
  });

  test("Frontline fractions follow the two column totals, including ties and empty columns", () => {
    for (const [a, b, expected] of [[25, 75, 0.25], [75, 25, 0.75], [50, 50, 0.5], [0, 0, 0.5], [100, 0, 1], [0, 100, 0]]) {
      assertEqual(frontlineFraction(a, b), expected);
    }
    assertThrows(() => frontlineFraction(-1, 20));
  });

  test("Five physical column centers align exactly with the same five-cell grid at mobile widths", () => {
    for (const viewport of [320, 375, 390, 430]) {
      const boardWidth = Math.min(viewport - 24, 448) - 10;
      const cellWidth = (boardWidth - 16) / 5;
      const centers = [0, 1, 2, 3, 4].map((i) => physicalColumnCenter(boardWidth, i));
      centers.forEach((center, i) => assertEqual(center, (i + 0.5) * cellWidth + 4 * i));
      assert(centers[0] > 7 && centers[4] < boardWidth - 7);
    }
  });

  test("The smooth Frontline passes through all five points and stays within bounds even across sharp score changes", () => {
    const scores = [[100, 0], [0, 100], [100, 0], [0, 100], [50, 50]];
    const duels = scores.map(([a, b], physical) => ({ physical, player1: { score: a }, player2: { score: b } }));
    const geometry = createFrontlineGeometry(duels, 286);
    assertEqual(geometry.points.length, 5);
    assertEqual((geometry.center.match(/ C /g) ?? []).length, 8);
    assertEqual(geometry.samples.length, 81);
    geometry.points.forEach((point) => {
      const sample = geometry.samples.find((item) => Math.abs(item.x - point.x) < 0.00001);
      assert(sample && Math.abs(sample.y - point.y) < 0.00001);
      assert(point.x > point.thickness / 2 && point.x < geometry.width - point.thickness / 2);
    });
    for (const sample of geometry.samples) {
      assert(sample.y >= 30 && sample.y <= 82);
      assert(sample.y - sample.thickness / 2 > 0);
      assert(sample.y + sample.thickness / 2 < geometry.height);
    }
    assert(geometry.samples.every((sample, i) => i === 0 || sample.x > geometry.samples[i - 1].x));
    assertEqual(FRONTLINE_THICKNESS, 8);
    assert(geometry.samples.every((sample) => sample.thickness === FRONTLINE_THICKNESS));
    assertDeepEqual(geometry.points.map((point) => point.thickness), Array(5).fill(FRONTLINE_THICKNESS));
    const dotOuterRadius = 7.5 + 2.25 / 2 + 4.5;
    for (const point of geometry.points) {
      assert(point.y - dotOuterRadius > 0 && point.y + dotOuterRadius < geometry.height);
    }
    assertDeepEqual(geometry.points.map((point) => point.control), ["player1", "player2", "player1", "player2", "tie"]);
  });

  test("Equal-height scoring points form a straight centerline at every shared score ratio", () => {
    const duels = [0, 1, 2, 3, 4].map((physical) => ({ physical, player1: { score: 0 }, player2: { score: 0 } }));
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      const level = createFrontlineGeometry(duels, 286, Array(5).fill(fraction));
      const y = 30 + 52 * fraction;
      assert(level.samples.every((sample) => sample.y === y));
      assert(level.center.match(/-?\d+(?:\.\d+)?/g).map(Number).filter((_, i) => i % 2 === 1).every((value) => value === y));
      assert(level.samples.every((sample) => sample.thickness === FRONTLINE_THICKNESS));
      assert(level.points.every((point) => point.thickness === FRONTLINE_THICKNESS));
    }
  });

  test("An equal adjacent pair stays horizontal while differing pairs curve through their points", () => {
    const duels = [0, 1, 2, 3, 4].map((physical) => ({ physical, player1: { score: 0 }, player2: { score: 0 } }));
    const mixed = createFrontlineGeometry(duels, 286, [0.25, 0.5, 0.5, 0.75, 0.6]);
    assert(mixed.samples.slice(20, 41).every((sample) => sample.y === 56));
    const cubics = mixed.center.match(/C [^CML]+/g);
    for (const cubic of cubics.slice(2, 4)) {
      assert(cubic.match(/-?\d+(?:\.\d+)?/g).map(Number).filter((_, i) => i % 2 === 1).every((value) => value === 56));
    }
    assert(mixed.samples[10].y !== mixed.points[0].y && mixed.samples[10].y !== mixed.points[1].y);
    for (const point of mixed.points) assert(mixed.samples.some((sample) => sample.x === point.x && sample.y === point.y));
    const level = createFrontlineGeometry(duels, 286, Array(5).fill(0.5));
    const near = createFrontlineGeometry(duels, 286, [0.5, 0.50001, 0.5, 0.5, 0.5]);
    assert(near.samples.every((sample, i) => Math.abs(sample.y - level.samples[i].y) < 0.01));
    const steep = createFrontlineGeometry(duels, 286, [0, 1, 0, 1, 0]);
    for (let segment = 0; segment < 4; segment += 1) {
      const ys = steep.samples.slice(segment * 20, segment * 20 + 21).map((sample) => sample.y);
      const rising = ys[0] < ys[20];
      assert(ys.every((value, index) => index === 0 || (rising ? value >= ys[index - 1] : value <= ys[index - 1])));
    }
  });

  test("The uniform Frontline ends at the fifth dot; two static guides point right within mobile widths", () => {
    const duels = [0, 1, 2, 3, 4].map((physical) => ({ physical, player1: { score: 0 }, player2: { score: 0 } }));
    for (const viewport of [320, 375, 390, 430]) for (const fractions of [
      [0, 0, 0, 0, 0], [0.5, 0.5, 0.5, 0.5, 0.5], [1, 1, 1, 1, 1],
      [0, 1, 0, 1, 0], [1, 0, 1, 0, 1], [0.2, 0.4, 0.3, 0.6, 0.55],
    ]) {
      const width = Math.min(viewport - 24, 448) - 10;
      const geometry = createFrontlineGeometry(duels, width, fractions);
      assertEqual(geometry.arrow, undefined);
      assertEqual(geometry.ribbon, undefined);
      assert(geometry.center.startsWith(`M ${Math.round(geometry.points[0].x * 1000) / 1000} ${Math.round(geometry.points[0].y * 1000) / 1000}`));
      assert(geometry.center.endsWith(`${Math.round(geometry.points[4].x * 1000) / 1000} ${Math.round(geometry.points[4].y * 1000) / 1000}`));
      assert(geometry.samples.every((sample) => sample.y >= 30 && sample.y <= 82
        && sample.y - sample.thickness / 2 > 0 && sample.y + sample.thickness / 2 < geometry.height));
      assert(geometry.samples.every((sample, i) => i === 0 || sample.x > geometry.samples[i - 1].x));
      const [top, bottom] = directionArrowGeometry(width);
      assertEqual(top.startX, bottom.startX);
      assertEqual(top.baseX, bottom.baseX);
      assertEqual(top.tipX, bottom.tipX);
      assert(top.startX < geometry.points[0].x && top.tipX > geometry.points[4].x && top.tipX < width);
      assert(top.baseX < top.tipX && bottom.baseX < bottom.tipX);
      assertDeepEqual(top.head.split(" ").map((vertex) => Number(vertex.split(",")[0])), [top.baseX, top.tipX, top.baseX]);
      assertDeepEqual(bottom.head.split(" ").map((vertex) => Number(vertex.split(",")[0])), [bottom.baseX, bottom.tipX, bottom.baseX]);
      assertEqual(top.y, 1);
      assertEqual(bottom.y, 111);
      assertEqual(top.tipX - top.baseX, 11.5);
      assertEqual(bottom.tipX - bottom.baseX, 11.5);
      assertEqual(Number(top.head.split(" ")[0].split(",")[1]), top.y - 4.25);
      assertEqual(Number(bottom.head.split(" ")[2].split(",")[1]), bottom.y + 4.25);
      assert(top.y < 14 && bottom.y > 98);
      assertDeepEqual(directionArrowGeometry(width), directionArrowGeometry(width));
    }
  });

  test("Zero, positive ties and leaders give distinct point states without altering column wins", () => {
    const scores = [[0, 0], [25, 75], [75, 25], [50, 50], [100, 0]];
    const duels = scores.map(([a, b], physical) => ({ physical, player1: { score: a }, player2: { score: b } }));
    const points = createFrontlineGeometry(duels, 286).points;
    assertDeepEqual(points.map((point) => point.control), ["empty", "player2", "player1", "tie", "player1"]);
    assertDeepEqual(points.map((point) => point.fraction), [0.5, 0.25, 0.75, 0.5, 1]);
  });

  test("Older Player 1 saves retain their Undo while new moves use the revised direction", () => {
    const before = board(["A3", 23]);
    const after = board(["A3", 23], ["B3", 31, "frozen"]);
    const legacy = { player1: { board: after }, player2: { board: createTwoPlayerBoard() },
      undo: { player1: { board: before }, player2: { board: createTwoPlayerBoard() } } };
    const stored = JSON.stringify({ version: 1, state: legacy });
    const restored = deserializeTwoPlayerGame(stored);
    assertDeepEqual(restored, legacy);
    assertDeepEqual(undoTwoPlayerMove(restored).player1.board, before);
    assertEqual(validateTwoPlayerPlacement(after, 1, "C3", 46).legal, false);
    const continued = placeTwoPlayerNumber(restored, 1, "A2", 23);
    assertEqual(continued.player1.board[2][1].status, "thawed");
    assertEqual(continued.player1.board[1][0].status, "frozen");
  });

  test("A completed board does not stop the opponent or Undo, and three-digit scores remain exact", () => {
    let state = createTwoPlayerState();
    for (const row of [3, 2, 1]) for (const [column, value] of [66, 44, 36, 24, 12].entries()) state = placeTwoPlayerNumber(state, 1, "ABCDE"[column] + row, value);
    assertEqual(state.player1.board.flat().filter(Boolean).length, 15);
    assertDeepEqual(getTwoPlayerColumnScores(state.player1.board), [396, 264, 108, 72, 36]);
    state = placeTwoPlayerNumber(state, 2, "A3", 12);
    assertEqual(state.player2.board[2][0].value, 12);
    assertEqual(undoTwoPlayerMove(state).player2.board[2][0], null);
  });

  test("Versioned saves round-trip independent ice and Undo, storing no derived scores or triangles", () => {
    const state = placeTwoPlayerNumber(primeExample(primeExample(createTwoPlayerState(), 1), 2), 1, "A2", 31);
    const serialized = serializeTwoPlayerGame(state);
    assertDeepEqual(deserializeTwoPlayerGame(serialized), state);
    const payload = JSON.parse(serialized);
    assertEqual(payload.version, 1);
    assertDeepEqual(Object.keys(payload.state), ["player1", "player2", "undo"]);
    const copy = deserializeTwoPlayerGame(serialized); copy.player1.board[2][0].value = 66;
    assertEqual(state.player1.board[2][0].value, 31);
    assert(isValidTwoPlayerState(undoTwoPlayerMove(deserializeTwoPlayerGame(serialized))));
  });

  test("Bad, incompatible, and mixed saves fall back without deleting the original data", () => {
    for (const raw of ["oops", "null", "{}", JSON.stringify({ version: 2, state: createTwoPlayerState() }), '{"version":1,"state":{"board":[]}}']) {
      const storage = appTestStorage(); storage.setItem(TWO_PLAYER_STORAGE_KEY, raw);
      const loaded = loadTwoPlayerGame(storage);
      assertEqual(loaded.status, "invalid"); assertDeepEqual(loaded.state, createTwoPlayerState());
      assertEqual(storage.getItem(TWO_PLAYER_STORAGE_KEY), raw);
    }
    const state = createTwoPlayerState();
    state.player1.board[2][0] = { value: 23, status: "frozen", attackIce: true };
    assertEqual(isValidTwoPlayerState(state), false);
    state.player1.board = board(["A3", 23, "frozen"], ["B3", 31, "frozen"]);
    assertEqual(isValidTwoPlayerState(state), false);
    assert(!isValidTwoPlayerBoard(createEmptyBoard()));
    assertEqual(isValidTwoPlayerBoard([Array(5), Array(5), Array(5)]), false);
  });

  test("Invalid or nested Undo and forged freeze transitions are rejected", () => {
    let state = primeExample(createTwoPlayerState(), 1);
    state.undo.undo = null; assertEqual(isValidTwoPlayerState(state), false);
    state = primeExample(createTwoPlayerState(), 1);
    state.player1.board[2][1].status = "normal"; assertEqual(isValidTwoPlayerState(state), false);
    state = createTwoPlayerState(); state.undo = { player1: state.player1, player2: state.player2 };
    assertEqual(isValidTwoPlayerState(state), false);
  });

  test("Storage failures are safe and clearing 2P touches neither classic nor the mode preference", () => {
    const storage = appTestStorage("classic bytes");
    storage.setItem(GAME_MODE_KEY, "2p");
    assert(saveTwoPlayerGame(createTwoPlayerState(), storage));
    assert(clearTwoPlayerGame(storage));
    assertEqual(storage.getItem("frosty-dice.game"), "classic bytes");
    assertEqual(storage.getItem(GAME_MODE_KEY), "2p");
    const blocked = { getItem() { throw new Error("Blocked"); }, setItem() { throw new Error("Blocked"); }, removeItem() { throw new Error("Blocked"); } };
    assertEqual(loadTwoPlayerGame(blocked).status, "unavailable");
    assertEqual(saveTwoPlayerGame(createTwoPlayerState(), blocked), false);
    assertEqual(clearTwoPlayerGame(blocked), false);
    assertEqual(readGameMode(blocked), "3p-plus");
    assertEqual(writeGameMode("2p", blocked), false);
  });

  test("Mode preference defaults to classic, validates values, and is independent of existing saves", () => {
    const storage = appTestStorage("existing classic game");
    for (const value of [null, "", "2P", "3p", "unknown"]) {
      if (value === null) storage.removeItem(GAME_MODE_KEY); else storage.setItem(GAME_MODE_KEY, value);
      assertEqual(readGameMode(storage), "3p-plus");
    }
    assert(writeGameMode("2p", storage)); assertEqual(readGameMode(storage), "2p");
    assertEqual(storage.getItem("frosty-dice.game"), "existing classic game");
    assertEqual(writeGameMode("bad", storage), false); assertEqual(readGameMode(storage), "2p");
  });

  test("Classic placement still uses A1 and its unchanged numeric/ice rules", () => {
    let classic = placeNumber(createEmptyBoard(), "A1", 23);
    classic = placeNumber(classic, "B1", 31);
    classic = placeNumber(classic, "A2", 23);
    assertEqual(classic[0][1].status, "thawed"); assertEqual(classic[1][0].status, "frozen");
    assertEqual(validatePlacement(createEmptyBoard(), "B1", 24).legal, false);
    assertEqual(validatePlacement(createEmptyBoard(), "A1", 66).legal, false);
  });
  return results;
}
