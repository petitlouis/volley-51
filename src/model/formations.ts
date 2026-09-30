import { bestAssignment, dist2, minPairDistance } from './geometry';
import { courtSlots, type Slot } from './libero';
import { ALL_IDS, ROLE_OF } from './roles';
import { overlapViolations } from './overlap';
import { isFront } from './rotation';
import type {
  AttackAngle,
  AttackTarget,
  DefenseAttack,
  Overlay,
  Phase,
  PlayerId,
  Point,
  Poste,
  ReceptionMode,
  Role,
  Scene,
} from './types';

/**
 * Repère en mètres, notre demi-terrain (9 x 9) :
 *   x : 0 = ligne gauche (côté poste 4/5), 9 = ligne droite (côté poste 2/1)
 *   y : 0 = filet, 9 = ligne de fond. y négatif = terrain adverse.
 */
type Placed = Map<PlayerId, Point & { radius: number }>;

export const BASE_XY: Record<Poste, Point> = {
  1: { x: 7.5, y: 7 },
  2: { x: 7.5, y: 2 },
  3: { x: 4.5, y: 2 },
  4: { x: 1.5, y: 2 },
  5: { x: 1.5, y: 7 },
  6: { x: 4.5, y: 7 },
};

export const BENCH_L: Point = { x: -1.6, y: 8.5 };
export const BENCH_C: Point = { x: 10.6, y: 8.5 };

const withLibero = (id: PlayerId, radius: number): number => (id === 'L' ? radius + 0.4 : radius);

function finish(placed: Placed, slots: Slot[], overlay: Overlay = {}): Scene {
  const players = ALL_IDS.map((id) => {
    const p = placed.get(id);
    if (p) {
      const poste = slots.find((s) => s.player === id)?.poste ?? null;
      return { id, role: ROLE_OF[id], x: p.x, y: p.y, radius: p.radius, onCourt: true, poste };
    }
    const bench = id === 'L' ? BENCH_L : BENCH_C;
    return { id, role: ROLE_OF[id], x: bench.x, y: bench.y, radius: 0, onCourt: false, poste: null };
  });
  return { players, overlay };
}

/** Positions de rotation : chaque joueur à son poste nominal. */
export function baseScene(rotation: number, phase: Phase, libero: boolean): Scene {
  const placed: Placed = new Map();
  const slots = courtSlots(rotation, phase, libero);
  for (const s of slots) {
    placed.set(s.player, { ...BASE_XY[s.poste], radius: withLibero(s.player, 2) });
  }
  return finish(placed, slots);
}

/**
 * Service (règle FIVB 7.4) : l'équipe au service est libre de se placer où elle veut.
 * Chacun prend donc sa zone de jeu habituelle selon son rôle, quel que soit son poste de rotation :
 * R4 à gauche, central au centre, pointu et passeur à droite. Seul le serveur est hors du terrain.
 */
const SERVICE_FRONT: Record<Role, Point> = {
  R4: { x: 1.5, y: 1 },
  C: { x: 4.5, y: 1 },
  L: { x: 4.5, y: 1 },
  P: { x: 7.5, y: 1 },
  Pt: { x: 7.5, y: 1 },
};
const SERVICE_BACK: Record<Role, Point> = {
  R4: { x: 1.5, y: 6 },
  C: { x: 4.5, y: 7 },
  L: { x: 4.5, y: 7 },
  P: { x: 7.5, y: 6.5 },
  Pt: { x: 7.5, y: 6.5 },
};
export const SERVER_XY: Point = { x: 7.5, y: 10.2 };

const radiusByDepth = (y: number): number => (y <= 1.5 ? 1.3 : y < 4 ? 2 : 2.6);

function serviceSpot(poste: Poste, player: PlayerId): Point {
  const role = ROLE_OF[player];
  return isFront(poste) ? SERVICE_FRONT[role] : SERVICE_BACK[role];
}

export function serviceScene(rotation: number, libero: boolean): Scene {
  const placed: Placed = new Map();
  const slots = courtSlots(rotation, 'service', libero);
  for (const s of slots) {
    if (s.poste === 1) {
      placed.set(s.player, { ...SERVER_XY, radius: 1.2 });
      continue;
    }
    const xy = serviceSpot(s.poste, s.player);
    placed.set(s.player, { ...xy, radius: withLibero(s.player, radiusByDepth(xy.y)) });
  }
  return finish(placed, slots);
}

/** Après le service : le serveur entre et prend la place de défenseur de son rôle. */
export function serviceEnterScene(rotation: number, libero: boolean): Scene {
  const placed: Placed = new Map();
  const slots = courtSlots(rotation, 'service', libero);
  for (const s of slots) {
    const xy = s.poste === 1 ? SERVICE_BACK[ROLE_OF[s.player]] : serviceSpot(s.poste, s.player);
    placed.set(s.player, { ...xy, radius: withLibero(s.player, radiusByDepth(xy.y)) });
  }
  return finish(placed, slots);
}

export const RECEPTION_SETTER: Point = { x: 6.8, y: 1 };
export const W5: Point[] = [
  { x: 1.2, y: 3.2 },
  { x: 2.9, y: 6.6 },
  { x: 4.5, y: 3.8 },
  { x: 6.1, y: 6.6 },
  { x: 7.8, y: 3.2 },
];
/**
 * Réception à 4 : formation en arc, avec des emplacements supplémentaires en avant
 * pour que tous les cas d'ordre de rotation (règle 7.4) aient une solution.
 */
export const W4: Point[] = [
  { x: 1.5, y: 3.5 },
  { x: 3.2, y: 6.6 },
  { x: 5.8, y: 6.6 },
  { x: 7.5, y: 3.5 },
  { x: 3, y: 3.4 },
  { x: 4.5, y: 3.6 },
  { x: 6, y: 3.4 },
];

/** Emplacements candidats du passeur : au filet s'il est en ligne avant, derrière son vis-à-vis sinon. */
const SETTER_FRONT_SPOTS: Point[] = [
  RECEPTION_SETTER,
  { x: 7.4, y: 1 },
  { x: 6, y: 1 },
  { x: 5, y: 1 },
  { x: 3.6, y: 1 },
];
const SETTER_BACK_SPOTS: Point[] = [
  { x: 8.3, y: 4.6 },
  { x: 7, y: 4.8 },
  { x: 5.6, y: 4.8 },
  { x: 4.5, y: 4.8 },
  { x: 2.2, y: 4.8 },
];
/** Emplacements candidats du central de ligne avant qui reste au filet en réception à 4. */
const NET_CENTRAL_SPOTS: Point[] = [
  { x: 4.3, y: 1.1 },
  { x: 3, y: 1 },
  { x: 5.6, y: 1 },
  { x: 2, y: 1 },
  { x: 1, y: 1 },
  { x: 7.2, y: 1 },
];

function* arrangements(n: number, k: number, used: number[] = []): Generator<number[]> {
  if (used.length === k) {
    yield used;
    return;
  }
  for (let i = 0; i < n; i++) if (!used.includes(i)) yield* arrangements(n, k, [...used, i]);
}

/**
 * Réception à 5 : tous sauf le passeur reçoivent, en W.
 * Réception à 4 : le central de ligne avant reste au filet (attaque rapide) et ne reçoit pas.
 * L'équipe en réception doit respecter l'ordre de rotation (règle 7.4) : parmi tous les placements
 * possibles, on retient le plus proche des postes nominaux qui respecte cet ordre.
 */
const receptionCache = new Map<string, Scene>();

export function receptionScene(rotation: number, libero: boolean, mode: ReceptionMode): Scene {
  const key = `${rotation}-${libero}-${mode}`;
  const cached = receptionCache.get(key);
  if (cached) return cached;
  const scene = computeReception(rotation, libero, mode);
  receptionCache.set(key, scene);
  return scene;
}

function computeReception(rotation: number, libero: boolean, mode: ReceptionMode): Scene {
  const slots = courtSlots(rotation, 'reception', libero);
  const setter = slots.find((s) => s.player === 'P')!;
  const central =
    mode === 4 ? slots.find((s) => isFront(s.poste) && ROLE_OF[s.player] === 'C') : undefined;
  const receivers = slots.filter((s) => s !== setter && s !== central);
  const points = mode === 5 ? W5 : W4;
  const setterSpots = isFront(setter.poste) ? SETTER_FRONT_SPOTS : SETTER_BACK_SPOTS;
  const centralSpots = central ? NET_CENTRAL_SPOTS : [undefined];

  for (const margin of [0.3, 0]) {
    let best: { cost: number; byPoste: Map<Poste, Point> } | undefined;
    setterSpots.forEach((sp, si) => {
      centralSpots.forEach((cp, ci) => {
        for (const pick of arrangements(points.length, receivers.length)) {
          const byPoste = new Map<Poste, Point>([[setter.poste, sp]]);
          if (central && cp) byPoste.set(central.poste, cp);
          receivers.forEach((r, i) => byPoste.set(r.poste, points[pick[i]]));
          const rec = Object.fromEntries(byPoste) as Record<Poste, Point>;
          if (overlapViolations(rec, margin).length > 0) continue;
          if (minPairDistance([...byPoste.values()]) < 1) continue;
          let cost = si * 0.5 + ci * 0.5;
          for (const [poste, xy] of byPoste) cost += dist2(BASE_XY[poste], xy);
          if (!best || cost < best.cost) best = { cost, byPoste };
        }
      });
    });
    if (best) {
      const placed: Placed = new Map();
      for (const s of slots) {
        const xy = best.byPoste.get(s.poste)!;
        const radius = s === setter || s === central ? 1.5 : withLibero(s.player, 2.2);
        placed.set(s.player, { ...xy, radius });
      }
      return finish(placed, slots);
    }
  }
  throw new Error(`Aucun placement de réception valide (rotation ${rotation}, mode ${mode})`);
}

/**
 * Défense en rotation. Les clés `adv4`, `adv3`, `adv2` sont les postes d'attaque
 * de l'adversaire. Son poste 4 fait face à notre poste 2 (côté droit sur le schéma).
 */
const DEFENSE_XY: Record<DefenseAttack, Record<Poste, Point>> = {
  adv4: {
    2: { x: 7.2, y: 1 },
    3: { x: 5.6, y: 1 },
    4: { x: 3.6, y: 3 },
    1: { x: 8, y: 5.5 },
    6: { x: 6, y: 7.5 },
    5: { x: 2, y: 6 },
  },
  adv2: {
    4: { x: 1.8, y: 1 },
    3: { x: 3.4, y: 1 },
    2: { x: 5.4, y: 3 },
    5: { x: 1, y: 5.5 },
    6: { x: 3, y: 7.5 },
    1: { x: 7, y: 6 },
  },
  adv3: {
    3: { x: 4.5, y: 1 },
    2: { x: 7, y: 3 },
    4: { x: 2, y: 3 },
    5: { x: 2, y: 6.5 },
    6: { x: 4.5, y: 7.5 },
    1: { x: 7, y: 6.5 },
  },
  pipe: {
    3: { x: 4.5, y: 1 },
    2: { x: 6.5, y: 3 },
    4: { x: 2.5, y: 3 },
    5: { x: 2.5, y: 5 },
    6: { x: 4.5, y: 6 },
    1: { x: 6.5, y: 5 },
  },
};

export const OPPONENT_XY: Record<DefenseAttack, Point & { label: string }> = {
  adv4: { x: 8, y: -1.2, label: "Attaque adverse en 4" },
  adv3: { x: 4.5, y: -1.2, label: "Attaque adverse en 3" },
  adv2: { x: 1, y: -1.2, label: "Attaque adverse en 2" },
  pipe: { x: 4.5, y: -4, label: "Pipe adverse" },
};

/**
 * Sans le passeur, les deux autres défenseurs arrière décalent pour couvrir tout le fond du terrain.
 * Chacun prend le point le plus proche de sa place habituelle.
 */
const DEFENSE_TWO: Record<DefenseAttack, Point[]> = {
  adv4: [{ x: 7.2, y: 5.8 }, { x: 3.4, y: 6.8 }],
  adv2: [{ x: 1.8, y: 5.8 }, { x: 5.6, y: 6.8 }],
  adv3: [{ x: 3.2, y: 6.5 }, { x: 5.8, y: 6.5 }],
  pipe: [{ x: 3, y: 5 }, { x: 6, y: 5 }],
};

export interface Intention {
  id: string;
  label: string;
  hint: string;
  /** Point de chute de la balle dans notre terrain. */
  landing: Point;
}

const mirror = (i: Intention, label: string, hint: string, id = i.id): Intention => ({
  id,
  label,
  hint,
  landing: { x: 9 - i.landing.x, y: i.landing.y },
});

const FROM_ADV4: Intention[] = [
  { id: 'ligne', label: 'Ligne', hint: 'le long de la ligne, côté droit', landing: { x: 8.3, y: 6.8 } },
  { id: 'grande-diag', label: 'Grande diagonale', hint: 'en croisé, vers le fond gauche', landing: { x: 0.9, y: 7.6 } },
  { id: 'petite-diag', label: 'Petite diagonale', hint: 'angle court vers le milieu', landing: { x: 3.8, y: 4.6 } },
  { id: 'bidouille', label: 'Bidouille', hint: 'balle placée derrière le bloc', landing: { x: 6.4, y: 2.4 } },
];

/** Intentions possibles de l'attaquant adverse et point de chute correspondant. */
export const INTENTIONS: Record<DefenseAttack, Intention[]> = {
  adv4: FROM_ADV4,
  adv2: [
    mirror(FROM_ADV4[0], 'Ligne', 'le long de la ligne, côté gauche'),
    mirror(FROM_ADV4[1], 'Grande diagonale', 'en croisé, vers le fond droit'),
    mirror(FROM_ADV4[2], 'Petite diagonale', 'angle court vers le milieu'),
    mirror(FROM_ADV4[3], 'Bidouille', 'balle placée derrière le bloc'),
  ],
  adv3: [
    { id: 'gauche', label: 'Angle gauche', hint: 'vers le fond gauche', landing: { x: 1.5, y: 7 } },
    { id: 'milieu', label: 'Milieu', hint: 'au centre du fond', landing: { x: 4.5, y: 7.5 } },
    { id: 'droite', label: 'Angle droit', hint: 'vers le fond droit', landing: { x: 7.5, y: 7 } },
    { id: 'bidouille', label: 'Bidouille', hint: 'balle placée derrière le bloc', landing: { x: 4.5, y: 2.4 } },
  ],
  pipe: [
    { id: 'diag-gauche', label: 'Diagonale gauche', hint: 'vers la gauche', landing: { x: 2, y: 6.5 } },
    { id: 'milieu', label: 'Milieu', hint: 'au centre du fond', landing: { x: 4.5, y: 7 } },
    { id: 'diag-droite', label: 'Diagonale droite', hint: 'vers la droite', landing: { x: 7, y: 6.5 } },
    { id: 'courte', label: 'Courte', hint: 'balle placée devant les défenseurs', landing: { x: 4.5, y: 4 } },
  ],
};

export const BLOCK_MAX_Y = 1.5;

/** Passeur en ligne arrière : il ne défend pas, il se tient à droite, prêt à monter faire la passe. */
export const SETTER_READY: Point = { x: 7.9, y: 4 };

export function defenseScene(
  rotation: number,
  libero: boolean,
  attack: DefenseAttack,
  intention?: string,
  ownServe = false,
): Scene {
  const placed: Placed = new Map();
  const slots = courtSlots(rotation, 'defense', libero, ownServe);
  const setterBack = slots.some((s) => s.player === 'P' && !isFront(s.poste));
  const shifted = setterBack ? slots.filter((s) => !isFront(s.poste) && s.player !== 'P') : [];
  if (setterBack) {
    const points = DEFENSE_TWO[attack];
    const pick = bestAssignment(shifted.length, points.length, (i, j) =>
      dist2(DEFENSE_XY[attack][shifted[i].poste], points[j]),
    );
    shifted.forEach((s, i) => {
      placed.set(s.player, { ...points[pick[i]], radius: withLibero(s.player, radiusByDepth(points[pick[i]].y)) });
    });
  }
  for (const s of slots) {
    if (shifted.includes(s)) continue;
    if (s.player === 'P' && !isFront(s.poste)) {
      placed.set('P', { ...SETTER_READY, radius: 1.5 });
      continue;
    }
    const xy = DEFENSE_XY[attack][s.poste];
    placed.set(s.player, { ...xy, radius: withLibero(s.player, radiusByDepth(xy.y)) });
  }
  const chosen = intention ? INTENTIONS[attack].find((i) => i.id === intention) : undefined;
  if (intention && !chosen) throw new Error(`Intention inconnue : ${intention}`);
  if (chosen) {
    // Le défenseur le plus proche du point de chute démarre vers la balle.
    let nearest: PlayerId | undefined;
    let best = Infinity;
    for (const [id, p] of placed) {
      if (id === 'P' || p.y <= BLOCK_MAX_Y) continue;
      const d = dist2(p, chosen.landing);
      if (d < best) {
        best = d;
        nearest = id;
      }
    }
    if (nearest) {
      const p = placed.get(nearest)!;
      placed.set(nearest, { ...p, x: p.x + (chosen.landing.x - p.x) * 0.5, y: p.y + (chosen.landing.y - p.y) * 0.5 });
    }
  }
  return finish(placed, slots, { opponent: OPPONENT_XY[attack], landing: chosen?.landing });
}

export const SETTER_TARGET: Point = { x: 6.6, y: 0.9 };

/** Passeur de ligne arrière : après la passe il retourne défendre au fond à droite (premier emplacement libre). */
export const SETTER_RETURN_SPOTS: Point[] = [
  { x: 7.6, y: 6.6 },
  { x: 6.2, y: 6.6 },
  { x: 4.8, y: 6.8 },
  { x: 3.4, y: 6.8 },
  { x: 2, y: 6.6 },
];
export const ZONE_XY: Record<2 | 3 | 4, Point> = {
  4: { x: 1.3, y: 2.2 },
  3: { x: 4.3, y: 2 },
  2: { x: 7.8, y: 2.2 },
};
export const PIPE_XY: Point = { x: 4.5, y: 4.6 };

/** Préférence de zone d'attaque selon le rôle : 0 = idéal. */
const ZONE_PREF: Record<string, Record<2 | 3 | 4, number>> = {
  P: { 4: 1.5, 3: 1.5, 2: 1 },
  R4: { 4: 0, 3: 1.5, 2: 1 },
  C: { 4: 1, 3: 0, 2: 1 },
  Pt: { 4: 1, 3: 1.5, 2: 0 },
};
const ZONES: (2 | 3 | 4)[] = [4, 3, 2];

/** Le pipe est attaqué par le pointu quand il est en ligne arrière, sinon par un R4, sinon par un central. */
const PIPE_PREF: Record<string, number> = { Pt: 0, R4: 1, C: 2 };

/**
 * Joueurs de ligne avant (hors passeur du moment) affectés à une zone d'attaque : R4 en 4, central en 3, pointu en 2.
 * Exception : en rotation 1, quand l'adversaire sert, le pointu (poste 4) et le R4 (poste 2) ne se croisent pas.
 * `setter` est le joueur qui fait la passe : `P` normalement, `Pt` quand le passeur a joué la balle.
 */
export function frontAttackers(
  rotation: number,
  libero: boolean,
  setter: PlayerId = 'P',
  ownServe = false,
): Map<2 | 3 | 4, PlayerId> {
  const front = courtSlots(rotation, 'attack', libero, ownServe).filter((s) => isFront(s.poste) && s.player !== setter);
  if (!ownServe && rotation === 1 && setter === 'P') {
    // Rotation 1 en réception : pas de croisement. Le pointu reste en 4 (gauche), le R4 en 2 (droite).
    const fixed = new Map<2 | 3 | 4, PlayerId>();
    for (const s of front) fixed.set(s.poste as 2 | 3 | 4, s.player);
    return fixed;
  }
  const pick = bestAssignment(front.length, ZONES.length, (i, j) => {
    const s = front[i];
    return ZONE_PREF[ROLE_OF[s.player]][ZONES[j]] * 10 + dist2(BASE_XY[s.poste], ZONE_XY[ZONES[j]]) * 0.01;
  });
  const map = new Map<2 | 3 | 4, PlayerId>();
  front.forEach((s, i) => map.set(ZONES[pick[i]], s.player));
  return map;
}

/** Attaquant arrière (pipe) : le pointu s'il est derrière, jamais le libéro ni le passeur. */
export function pipeAttacker(
  rotation: number,
  libero: boolean,
  setter: PlayerId = 'P',
  ownServe = false,
): PlayerId {
  const back = courtSlots(rotation, 'attack', libero, ownServe).filter(
    (s) => !isFront(s.poste) && s.player !== 'P' && s.player !== 'L' && s.player !== setter,
  );
  back.sort((a, b) => PIPE_PREF[ROLE_OF[a.player]] - PIPE_PREF[ROLE_OF[b.player]]);
  return back[0].player;
}

export function availableTargets(
  rotation: number,
  libero: boolean,
  setter: PlayerId = 'P',
  ownServe = false,
): AttackTarget[] {
  const zones = frontAttackers(rotation, libero, setter, ownServe);
  const list: AttackTarget[] = [];
  for (const z of ZONES) if (zones.has(z)) list.push(`p${z}` as AttackTarget);
  list.push('pipe');
  return list;
}

/** Angles de frappe possibles depuis le point d'attaque (y négatif = terrain adverse). */
export function attackAngles(target: AttackTarget): { from: Point; lines: AttackAngle[] } {
  if (target === 'p4' || target === 'p2') {
    const left = target === 'p4';
    const mx = (x: number): number => (left ? x : 9 - x);
    const zone = ZONE_XY[left ? 4 : 2];
    return {
      from: { x: zone.x, y: 0 },
      lines: [
        { label: 'Ligne', to: { x: mx(0.6), y: -9 } },
        { label: 'Diagonale', to: { x: mx(8.4), y: -9 } },
        { label: 'Diagonale courte (cut)', to: { x: mx(5.5), y: -3.2 } },
        { label: 'Feinte', to: { x: mx(2.8), y: -2.2 } },
      ],
    };
  }
  if (target === 'p3') {
    return {
      from: { x: ZONE_XY[3].x, y: 0 },
      lines: [
        { label: 'Angle gauche', to: { x: 1, y: -9 } },
        { label: 'Centre', to: { x: 4.5, y: -9 } },
        { label: 'Angle droit', to: { x: 8, y: -9 } },
        { label: 'Feinte', to: { x: 4.5, y: -2 } },
      ],
    };
  }
  return {
    from: { x: PIPE_XY.x, y: 3.2 },
    lines: [
      { label: 'Diagonale gauche', to: { x: 1, y: -9 } },
      { label: 'Centre', to: { x: 4.5, y: -9 } },
      { label: 'Diagonale droite', to: { x: 8, y: -9 } },
      { label: 'Courte (feinte)', to: { x: 4.5, y: -3.5 } },
    ],
  };
}

const clampX = (x: number): number => Math.min(8, Math.max(1, x));

/** Points de soutien (couverture) autour de l'attaquant. */
export function coverPoints(target: AttackTarget): Point[] {
  if (target === 'pipe') {
    return [
      { x: 2.6, y: 5.8 },
      { x: 6.4, y: 5.8 },
      { x: 4.5, y: 7.2 },
    ];
  }
  const xh = ZONE_XY[Number(target[1]) as 2 | 3 | 4].x;
  return [
    { x: clampX(xh - 2.2), y: 4.4 },
    { x: clampX(xh + 2.2), y: 4.4 },
    { x: xh, y: 5.8 },
  ];
}

export function attackScene(
  rotation: number,
  libero: boolean,
  target: AttackTarget,
  setter: PlayerId = 'P',
  ownServe = false,
): Scene {
  const slots = courtSlots(rotation, 'attack', libero, ownServe);
  const placed: Placed = new Map();
  const zones = frontAttackers(rotation, libero, setter, ownServe);
  const pipeId = target === 'pipe' ? pipeAttacker(rotation, libero, setter, ownServe) : null;

  // Passeur de ligne arrière : il a pénétré pour la passe, il retourne défendre. De ligne avant, il reste au filet.
  const setterBack = !isFront(slots.find((s) => s.player === setter)!.poste);
  if (!setterBack) placed.set(setter, { ...SETTER_TARGET, radius: 1.5 });
  for (const [zone, id] of zones) placed.set(id, { ...ZONE_XY[zone], radius: 1.2 });
  if (pipeId) placed.set(pipeId, { ...PIPE_XY, radius: 1.5 });

  const covers = slots.filter((s) => !placed.has(s.player) && s.player !== setter);
  const points = coverPoints(target);
  const pick = bestAssignment(covers.length, points.length, (i, j) =>
    dist2(BASE_XY[covers[i].poste], points[j]),
  );
  covers.forEach((s, i) => placed.set(s.player, { ...points[pick[i]], radius: withLibero(s.player, 2.2) }));
  if (setterBack) {
    const spot =
      SETTER_RETURN_SPOTS.find((c) => [...placed.values()].every((p) => dist2(p, c) >= 1.2 ** 2)) ??
      SETTER_RETURN_SPOTS[0];
    placed.set(setter, { ...spot, radius: 1.5 });
  }

  const hitter = pipeId ?? zones.get(Number(target[1]) as 2 | 3 | 4);
  return finish(placed, slots, { hitter, angles: attackAngles(target) });
}

/**
 * Deuxième touche : `player` joue la balle (défense ou réception) à sa place actuelle ou au point de chute
 * `contact`, et `setter` (le passeur, ou le pointu si le passeur a joué la balle) se place au point de passe.
 * Pendant la passe, les attaquants de ligne avant (`attackers`, par zone) se placent déjà à leur zone d'attaque :
 * le central au centre, le R4 à gauche, le pointu à droite, avant de savoir vers qui va la passe.
 */
export function secondContactScene(
  base: Scene,
  player: PlayerId,
  setter: PlayerId,
  contact?: Point,
  attackers?: Map<2 | 3 | 4, PlayerId>,
): Scene {
  const zoneOf = new Map<PlayerId, 2 | 3 | 4>();
  attackers?.forEach((id, zone) => zoneOf.set(id, zone));
  const players = base.players.map((p) => {
    if (!p.onCourt) return p;
    if (p.id === setter) return { ...p, ...SETTER_TARGET, radius: 1.5 };
    // Le joueur qui reprend la balle court la chercher à son point de chute.
    if (contact && p.id === player) return { ...p, ...contact };
    const zone = zoneOf.get(p.id);
    if (zone) return { ...p, ...ZONE_XY[zone], radius: 1.2 };
    // Les autres joueurs déjà près du filet (bloqueurs) libèrent le point de passe.
    if (dist2(p, SETTER_TARGET) < 1.8 ** 2) return { ...p, y: 2.6 };
    return p;
  });
  const ball = players.find((p) => p.id === player)!;
  return {
    players,
    overlay: { ...base.overlay, opponent: undefined, landing: undefined, ball: { x: ball.x, y: ball.y } },
  };
}

/** Zones visées par le service adverse (points de chute dans notre terrain). */
export const SERVE_ZONES: Intention[] = [
  { id: 'zone1', label: 'Zone 1', hint: 'fond, côté droit', landing: { x: 7.5, y: 7.2 } },
  { id: 'zone6', label: 'Zone 6', hint: 'fond, au centre', landing: { x: 4.5, y: 7.5 } },
  { id: 'zone5', label: 'Zone 5', hint: 'fond, côté gauche', landing: { x: 1.5, y: 7.2 } },
  { id: 'zone2', label: 'Zone 2 (court)', hint: 'court, côté droit', landing: { x: 7.5, y: 2.6 } },
  { id: 'zone3', label: 'Zone 3 (court)', hint: 'court, au centre', landing: { x: 4.5, y: 2.6 } },
  { id: 'zone4', label: 'Zone 4 (court)', hint: 'court, côté gauche', landing: { x: 1.5, y: 2.6 } },
];

/**
 * Le joueur le plus proche du point de chute (hors `excluded`) démarre vers la balle.
 * Sert à montrer, suivant l'intention adverse, qui réagit en premier.
 */
export function approachLanding(scene: Scene, landing: Point, excluded: PlayerId[]): Scene {
  let nearest: PlayerId | undefined;
  let best = Infinity;
  for (const p of scene.players) {
    if (!p.onCourt || excluded.includes(p.id)) continue;
    const d = dist2(p, landing);
    if (d < best) {
      best = d;
      nearest = p.id;
    }
  }
  const players = scene.players.map((p) =>
    p.id === nearest ? { ...p, x: p.x + (landing.x - p.x) * 0.5, y: p.y + (landing.y - p.y) * 0.5 } : p,
  );
  return { players, overlay: { ...scene.overlay, landing } };
}
