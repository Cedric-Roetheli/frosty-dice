// Derived display geometry for the five physical column duels. No game state.
export const FRONTLINE_HEIGHT = 112;
const BOARD_GAP = 4;
const THICKNESS = [5.1, 8.5, 11.9, 17, 23.8];
const TOP = 30;
const TRAVEL = 52;

export function frontlineFraction(p1, p2) {
  if (!Number.isFinite(p1) || !Number.isFinite(p2) || p1 < 0 || p2 < 0) throw new RangeError("Column scores must be nonnegative.");
  return p1 + p2 > 0 ? p1 / (p1 + p2) : 0.5;
}

export function physicalColumnCenter(width, physical) {
  if (!Number.isFinite(width) || width <= 4 * BOARD_GAP || !Number.isInteger(physical) || physical < 0 || physical > 4) throw new RangeError("Invalid board width or column.");
  const cell = (width - 4 * BOARD_GAP) / 5;
  return (physical + 0.5) * cell + physical * BOARD_GAP;
}

function monotoneSlopes(points) {
  const d = points.slice(1).map((point, index) => (point.y - points[index].y) / (point.x - points[index].x));
  const end = (a, b) => {
    const candidate = (3 * a - b) / 2;
    return Math.sign(candidate) !== Math.sign(a) ? 0 : Math.abs(candidate) > 3 * Math.abs(a) ? 3 * a : candidate;
  };
  return points.map((_, i) => i === 0 ? end(d[0], d[1]) : i === points.length - 1 ? end(d[d.length - 1], d[d.length - 2])
    : d[i - 1] * d[i] <= 0 ? 0 : 2 * d[i - 1] * d[i] / (d[i - 1] + d[i]));
}

const rounded = (value) => Math.round(value * 1000) / 1000;

export function createFrontlineGeometry(duels, width, displayFractions) {
  if (!Array.isArray(duels) || duels.length !== 5) throw new RangeError("Exactly five column duels are required.");
  const fractions = displayFractions ?? duels.map((duel) => frontlineFraction(duel.player1.score, duel.player2.score));
  if (fractions.length !== 5 || fractions.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) throw new RangeError("Invalid Frontline fractions.");
  const points = duels.map((duel, i) => {
    if (duel.physical !== i) throw new RangeError("Column duels must follow physical order.");
    const a = duel.player1.score, b = duel.player2.score;
    return { physical: i, x: physicalColumnCenter(width, i), y: TOP + TRAVEL * fractions[i], fraction: fractions[i],
      thickness: THICKNESS[i], control: a > b ? "player1" : b > a ? "player2" : a > 0 ? "tie" : "empty",
      player1: a, player2: b };
  });
  const slopes = monotoneSlopes(points);
  const center = [`M ${rounded(points[0].x)} ${rounded(points[0].y)}`];
  const upper = [], lower = [], samples = [];
  for (let i = 0; i < 4; i += 1) {
    const a = points[i], b = points[i + 1], span = b.x - a.x;
    const c1 = a.y + slopes[i] * span / 3, c2 = b.y - slopes[i + 1] * span / 3;
    center.push(`C ${rounded(a.x + span / 3)} ${rounded(c1)} ${rounded(b.x - span / 3)} ${rounded(c2)} ${rounded(b.x)} ${rounded(b.y)}`);
    for (let step = 0; step <= 20; step += 1) {
      if (i > 0 && step === 0) continue;
      const t = step / 20, u = 1 - t;
      const y = u ** 3 * a.y + 3 * u ** 2 * t * c1 + 3 * u * t ** 2 * c2 + t ** 3 * b.y;
      const x = a.x + span * t;
      const smooth = t * t * (3 - 2 * t);
      const thickness = a.thickness + (b.thickness - a.thickness) * smooth;
      upper.push([x, y - thickness / 2]); lower.push([x, y + thickness / 2]);
      samples.push({ x, y, thickness });
    }
  }
  const line = (pair, prefix) => `${prefix} ${rounded(pair[0])} ${rounded(pair[1])}`;
  const ribbon = [line(upper[0], "M"), ...upper.slice(1).map((point) => line(point, "L")),
    ...lower.reverse().map((point) => line(point, "L")), "Z"].join(" ");
  return { points, center: center.join(" "), ribbon, samples, height: FRONTLINE_HEIGHT, width };
}
