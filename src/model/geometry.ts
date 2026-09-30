import type { Point } from './types';

export const COURT = 9;
export const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
export const dist2 = (a: Point, b: Point): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export function minPairDistance(points: Point[]): number {
  let min = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) min = Math.min(min, dist(points[i], points[j]));
  }
  return min;
}

/**
 * Affecte `items` éléments à des emplacements distincts parmi `slotCount`
 * en minimisant le coût total. Retourne l'indice d'emplacement de chaque élément.
 */
export function bestAssignment(
  items: number,
  slotCount: number,
  cost: (item: number, slot: number) => number,
): number[] {
  let best = Infinity;
  let bestPick: number[] = [];
  const used: boolean[] = new Array(slotCount).fill(false);
  const cur: number[] = [];
  const rec = (i: number, acc: number): void => {
    if (acc >= best) return;
    if (i === items) {
      best = acc;
      bestPick = [...cur];
      return;
    }
    for (let j = 0; j < slotCount; j++) {
      if (used[j]) continue;
      used[j] = true;
      cur[i] = j;
      rec(i + 1, acc + cost(i, j));
      used[j] = false;
    }
  };
  rec(0, 0);
  return bestPick;
}
