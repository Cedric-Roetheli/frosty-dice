// Derived display geometry for the five physical column duels. No game state.
export const FRONTLINE_HEIGHT = 112;
const BOARD_GAP = 4;
export const FRONTLINE_THICKNESS = 8;
const TOP = 30;
const TRAVEL = 52;
const SWING = [5, -4, 5.5, -3.5];

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
      thickness: FRONTLINE_THICKNESS, control: a > b ? "player1" : b > a ? "player2" : a > 0 ? "tie" : "empty",
      player1: a, player2: b };
  });
  const slopes = monotoneSlopes(points);
  const center = [`M ${rounded(points[0].x)} ${rounded(points[0].y)}`];
  const samples = [];
  for (let i = 0; i < 4; i += 1) {
    const a = points[i], b = points[i + 1], span = b.x - a.x;
    const c1 = a.y + slopes[i] * span / 3, c2 = b.y - slopes[i + 1] * span / 3;
    // Equal-height points stay level. Moderate differences add an endpoint-smooth
    // swing, while steep score changes rely on the readable cubic baseline.
    const difference = Math.abs(b.y - a.y);
    let swing = SWING[i] * Math.min(1, difference / 12) * Math.max(0, 1 - difference / TRAVEL);
    const room = (direction) => direction > 0 ? TOP + TRAVEL - Math.max(a.y, b.y) : Math.min(a.y, b.y) - TOP;
    swing = Math.sign(swing) * Math.min(Math.abs(swing), room(Math.sign(swing)));
    const middle = (a.y + 3 * c1 + 3 * c2 + b.y) / 8 + swing;
    center.push(`C ${rounded(a.x + span / 6)} ${rounded((a.y + c1) / 2)} ${rounded(a.x + span / 3)} ${rounded((a.y + 2 * c1 + c2) / 4 + swing)} ${rounded(a.x + span / 2)} ${rounded(middle)}`);
    center.push(`C ${rounded(a.x + 2 * span / 3)} ${rounded((c1 + 2 * c2 + b.y) / 4 + swing)} ${rounded(a.x + 5 * span / 6)} ${rounded((c2 + b.y) / 2)} ${rounded(b.x)} ${rounded(b.y)}`);
    for (let step = 0; step <= 20; step += 1) {
      if (i > 0 && step === 0) continue;
      const t = step / 20, u = 1 - t;
      const half = t <= 0.5 ? 2 * t : 2 * (1 - t);
      const bump = half * half * (3 - 2 * half);
      const y = difference === 0 ? a.y
        : u ** 3 * a.y + 3 * u ** 2 * t * c1 + 3 * u * t ** 2 * c2 + t ** 3 * b.y + swing * bump;
      const x = a.x + span * t;
      samples.push({ x, y, thickness: FRONTLINE_THICKNESS });
    }
  }
  return { points, center: center.join(" "), samples, height: FRONTLINE_HEIGHT, width };
}

// Static direction guides share the board's physical coordinates, independent
// of the scores and of Player 1's rotated labels.
export function directionArrowGeometry(width) {
  if (!Number.isFinite(width) || width <= 4 * BOARD_GAP) throw new RangeError("Invalid board width.");
  const startX = 8, tipX = width - 8, baseX = tipX - 11.5;
  return [1, 111].map((y) => ({ startX, baseX, tipX, y,
    head: `${baseX},${y - 4.25} ${tipX},${y} ${baseX},${y + 4.25}` }));
}
