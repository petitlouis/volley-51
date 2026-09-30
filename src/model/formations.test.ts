import { describe, expect, it } from 'vitest';
import {
  attackAngles,
  attackScene,
  availableTargets,
  BASE_XY,
  baseScene,
  coverPoints,
  defenseScene,
  frontAttackers,
  pipeAttacker,
  receptionScene,
  serviceEnterScene,
  serviceScene,
} from './formations';
import { minPairDistance } from './geometry';
import { overlapViolations } from './overlap';
import { courtSlots } from './libero';
import { ALL_IDS, isFrontRow, ROLE_OF } from './roles';
import { isFront, lineup, posteOf } from './rotation';
import type { AttackTarget, DefenseAttack, Poste, Scene } from './types';

const R = [1, 2, 3, 4, 5, 6];
const LIB = [false, true];
const DEFENSES: DefenseAttack[] = ['adv4', 'adv3', 'adv2', 'pipe'];
const TARGETS: AttackTarget[] = ['p4', 'p3', 'p2', 'pipe'];

const onCourt = (s: Scene) => s.players.filter((p) => p.onCourt);
const get = (s: Scene, id: string) => s.players.find((p) => p.id === id)!;

function expectShape(s: Scene, libero: boolean) {
  expect(s.players.map((p) => p.id)).toEqual(ALL_IDS);
  expect(onCourt(s)).toHaveLength(6);
  expect(get(s, 'L').onCourt).toBe(libero && onCourt(s).some((p) => p.id === 'L'));
  for (const p of onCourt(s)) {
    expect(p.radius).toBeGreaterThan(0);
    expect(p.role).toBe(ROLE_OF[p.id]);
  }
  for (const p of s.players.filter((q) => !q.onCourt)) expect(p.radius).toBe(0);
}

function expectInsideOurHalf(s: Scene) {
  for (const p of onCourt(s)) {
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThanOrEqual(9);
    expect(p.y).toBeGreaterThanOrEqual(0);
  }
}

describe('positions de rotation', () => {
  it('chaque joueur est à son poste nominal', () => {
    for (const n of R) {
      const s = baseScene(n, 'defense', false);
      const lu = lineup(n);
      for (const poste of [1, 2, 3, 4, 5, 6] as const) {
        const p = get(s, lu[poste]);
        expect({ x: p.x, y: p.y }).toEqual(BASE_XY[poste]);
      }
    }
  });
});

describe('service : équipe au service libre (règle FIVB 7.4)', () => {
  it('6 joueurs en jeu pour toutes les rotations, avec ou sans libéro', () => {
    for (const n of R) {
      for (const lib of LIB) {
        for (const s of [serviceScene(n, lib), serviceEnterScene(n, lib)]) expectShape(s, lib);
      }
    }
  });

  it("chaque joueur est à la zone de son rôle, quel que soit son poste de rotation : R4 à gauche, C au centre, Pt et P à droite", () => {
    for (const n of R) {
      const s = serviceScene(n, false);
      const server = lineup(n)[1];
      for (const p of onCourt(s).filter((q) => q.id !== server)) {
        if (p.role === 'R4') expect(p.x).toBeLessThan(3);
        if (p.role === 'C') expect(p.x).toBe(4.5);
        if (p.role === 'Pt' || p.role === 'P') expect(p.x).toBeGreaterThan(6);
      }
    }
  });

  it("le placement est libre : dans au moins une rotation il violerait l'ordre de rotation imposé à la réception", () => {
    const violating = R.filter((n) => {
      const s = serviceScene(n, false);
      const lu = lineup(n);
      const pos = {} as Record<Poste, { x: number; y: number }>;
      for (const p of [1, 2, 3, 4, 5, 6] as const) {
        const q = get(s, lu[p]);
        pos[p] = { x: q.x, y: q.y };
      }
      return overlapViolations(pos).length > 0;
    });
    expect(violating.length).toBeGreaterThan(0);
  });

  it('le serveur est derrière la ligne de fond, les autres dans le terrain', () => {
    for (const n of R) {
      const s = serviceScene(n, true);
      const serverId = lineup(n)[1];
      expect(get(s, serverId).y).toBeGreaterThan(9);
      for (const p of onCourt(s).filter((q) => q.id !== serverId)) {
        expect(p.y).toBeLessThanOrEqual(9);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(9);
      }
    }
  });

  it("les 3 joueurs de ligne avant sont au filet (y <= 1.5), les autres joueurs en jeu sont au fond (y >= 5)", () => {
    for (const n of R) {
      const s = serviceScene(n, false);
      const lu = lineup(n);
      for (const p of [2, 3, 4] as const) expect(get(s, lu[p]).y).toBeLessThanOrEqual(1.5);
      for (const p of [5, 6] as const) expect(get(s, lu[p]).y).toBeGreaterThanOrEqual(5);
    }
  });

  it("aucune contrainte de distance : le règlement n'impose pas d'écart minimal (ronds seulement non superposés à l'écran)", () => {
    for (const n of R) {
      for (const lib of LIB) {
        expect(minPairDistance(onCourt(serviceScene(n, lib)))).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("après le service, le serveur entre et rejoint la zone de son rôle", () => {
    for (const n of R) {
      const s = serviceEnterScene(n, false);
      const server = get(s, lineup(n)[1]);
      expect(server.y).toBeLessThanOrEqual(9);
      expect(server.y).toBeGreaterThanOrEqual(5);
    }
  });

  it("avec libéro, il remplace le central arrière aux postes 5 et 6 mais le serveur reste seul au poste 1", () => {
    for (const n of R) {
      const s = serviceScene(n, true);
      const lu = lineup(n);
      expect(get(s, lu[1]).onCourt).toBe(true);
      const centralBack = ([5, 6] as const).map((p) => lu[p]).find((id) => ROLE_OF[id] === 'C');
      if (centralBack) expect(get(s, centralBack).onCourt).toBe(false);
    }
  });
});

describe('réception à 5 et à 4 : ordre de rotation obligatoire (règle FIVB 7.4)', () => {
  it("respecte l'ordre de rotation (arrière derrière l'avant correspondant, ordre latéral) pour toutes les rotations, modes et libéro", () => {
    for (const n of R) {
      for (const lib of LIB) {
        for (const m of [4, 5] as const) {
          // Avec libéro, le libéro tient la place du central remplacé : on contrôle par poste.
          const s = receptionScene(n, lib, m);
          const slots = courtSlots(n, 'reception', lib);
          const pos = {} as Record<Poste, { x: number; y: number }>;
          for (const sl of slots) {
            const q = get(s, sl.player);
            pos[sl.poste] = { x: q.x, y: q.y };
          }
          expect(overlapViolations(pos)).toEqual([]);
        }
      }
    }
  });

  it("le contrôle détecte les fautes de chevauchement (latérale et profondeur)", () => {
    const ok = { 1: { x: 8, y: 6 }, 2: { x: 7.5, y: 2 }, 3: { x: 4.5, y: 2 }, 4: { x: 1.5, y: 2 }, 5: { x: 1.5, y: 6 }, 6: { x: 4.5, y: 6 } };
    expect(overlapViolations(ok)).toEqual([]);
    expect(overlapViolations({ ...ok, 5: { x: 5, y: 6 } })).toContain('5 doit être à gauche de 6');
    expect(overlapViolations({ ...ok, 6: { x: 4.5, y: 1 } })).toContain('6 doit être derrière 3');
    expect(overlapViolations({ ...ok, 4: { x: 5, y: 2 } })).toContain('4 doit être à gauche de 3');
  });

  it('respecte 6 joueurs en jeu, distance >= 1 m à l\'écran, dans le demi-terrain', () => {
    for (const n of R) {
      for (const lib of LIB) {
        for (const m of [4, 5] as const) {
          const s = receptionScene(n, lib, m);
          expectShape(s, lib);
          expectInsideOurHalf(s);
          expect(minPairDistance(onCourt(s))).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('le passeur est au filet quand il est en ligne avant, et derrière son vis-à-vis en ligne arrière', () => {
    for (const n of R) {
      for (const m of [4, 5] as const) {
        const s = receptionScene(n, false, m);
        const p = get(s, 'P');
        const front = [2, 3, 4].includes(posteOf('P', n));
        if (front) expect(p.y).toBeLessThanOrEqual(1.5);
        else expect(p.y).toBeGreaterThan(3);
      }
    }
  });

  it('à 5 : les 5 receveurs sont à 3 m du filet ou plus', () => {
    for (const n of R) {
      const s = receptionScene(n, false, 5);
      const receivers = onCourt(s).filter((p) => p.id !== 'P');
      expect(receivers).toHaveLength(5);
      expect(receivers.every((p) => p.y >= 3)).toBe(true);
    }
  });

  it('à 4 : 4 receveurs à 3 m ou plus, le central de ligne avant reste au filet', () => {
    for (const n of R) {
      const s = receptionScene(n, false, 4);
      const lu = lineup(n);
      const frontCentral = ([2, 3, 4] as const).map((p) => lu[p]).find((id) => ROLE_OF[id] === 'C')!;
      expect(get(s, frontCentral).y).toBeLessThanOrEqual(1.5);
      const receivers = onCourt(s).filter((p) => p.id !== 'P' && p.id !== frontCentral);
      expect(receivers).toHaveLength(4);
      expect(receivers.every((p) => p.y >= 3)).toBe(true);
    }
  });

  it('avec libéro, le libéro reçoit et ne se place jamais au filet', () => {
    for (const n of R) {
      for (const m of [4, 5] as const) {
        const l = get(receptionScene(n, true, m), 'L');
        if (l.onCourt) expect(l.y).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe('défense en rotation', () => {
  const blockersExpected: Record<DefenseAttack, number> = { adv4: 2, adv2: 2, adv3: 1, pipe: 1 };

  it('6 joueurs, dans le demi-terrain, distance >= 1 m, pour 4 attaques x 6 rotations x libéro', () => {
    for (const n of R) {
      for (const lib of LIB) {
        for (const a of DEFENSES) {
          const s = defenseScene(n, lib, a);
          expectShape(s, lib);
          expectInsideOurHalf(s);
          expect(minPairDistance(onCourt(s))).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("nombre de bloqueurs au filet : 2 sur attaque en 4 ou en 2, 1 sur attaque au centre ou pipe", () => {
    for (const n of R) {
      for (const a of DEFENSES) {
        const s = defenseScene(n, false, a);
        expect(onCourt(s).filter((p) => p.y <= 1.5)).toHaveLength(blockersExpected[a]);
      }
    }
  });

  it("l'attaque adverse en 4 est bloquée côté droit (postes 2 et 3), en 2 côté gauche (postes 4 et 3)", () => {
    for (const n of R) {
      const lu = lineup(n);
      const s4 = defenseScene(n, false, 'adv4');
      expect(get(s4, lu[2]).y).toBeLessThanOrEqual(1.5);
      expect(get(s4, lu[3]).y).toBeLessThanOrEqual(1.5);
      expect(get(s4, lu[4]).y).toBeGreaterThan(1.5);
      const s2 = defenseScene(n, false, 'adv2');
      expect(get(s2, lu[4]).y).toBeLessThanOrEqual(1.5);
      expect(get(s2, lu[3]).y).toBeLessThanOrEqual(1.5);
      expect(get(s2, lu[2]).y).toBeGreaterThan(1.5);
    }
  });

  it('les défenses adv2 et adv4 sont symétriques (miroir gauche/droite) pour les défenseurs', () => {
    // Rotation 4 : le passeur est en ligne avant (poste 4) et bloque, donc tout le monde suit les tableaux de défense.
    const lu = lineup(4);
    const a = defenseScene(4, false, 'adv4');
    const b = defenseScene(4, false, 'adv2');
    const mirror = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1, 6: 6 } as const;
    for (const p of [1, 2, 3, 4, 5, 6] as const) {
      const pa = get(a, lu[p]);
      const pb = get(b, lu[mirror[p]]);
      expect(pa.y).toBe(pb.y);
      expect(pa.x).toBeCloseTo(9 - pb.x, 5);
    }
  });

  it("les trois joueurs de ligne arrière défendent au fond (y >= 5), ligne avant au plus à 3 m", () => {
    for (const n of R) {
      for (const a of DEFENSES) {
        const s = defenseScene(n, false, a);
        const lu = lineup(n);
        for (const p of [1, 5, 6] as const) {
          // Le passeur de ligne arrière ne défend pas : il attend à droite pour la passe.
          if (lu[p] !== 'P') expect(get(s, lu[p]).y).toBeGreaterThanOrEqual(5);
        }
        for (const p of [2, 3, 4] as const) expect(get(s, lu[p]).y).toBeLessThanOrEqual(3);
      }
    }
  });

  it("le marqueur adverse est placé dans le terrain adverse (y < 0)", () => {
    for (const a of DEFENSES) {
      const opp = defenseScene(1, false, a).overlay.opponent!;
      expect(opp.y).toBeLessThan(0);
      expect(opp.label.length).toBeGreaterThan(0);
    }
  });

  it("l'attaque adverse en 4 arrive côté droit (x élevé), en 2 côté gauche", () => {
    expect(defenseScene(1, false, 'adv4').overlay.opponent!.x).toBeGreaterThan(4.5);
    expect(defenseScene(1, false, 'adv2').overlay.opponent!.x).toBeLessThan(4.5);
    expect(defenseScene(1, false, 'adv3').overlay.opponent!.x).toBe(4.5);
  });

  it("le libéro défend au fond et n'est jamais bloqueur", () => {
    for (const n of R) {
      for (const a of DEFENSES) {
        const l = get(defenseScene(n, true, a), 'L');
        if (l.onCourt) expect(l.y).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it("les rayons d'action sont plus petits au filet qu'en défense arrière", () => {
    const s = defenseScene(1, false, 'adv4');
    const lu = lineup(1);
    expect(get(s, lu[2]).radius).toBeLessThan(get(s, lu[1]).radius);
  });
});

describe('défense sans le passeur : décalage naturel', () => {
  it("le passeur arrière ne défend pas et les deux autres défenseurs arrière s'écartent d'au moins 2.5 m pour couvrir le fond", () => {
    for (const n of R) {
      const lu = lineup(n);
      const setterBack = ([1, 5, 6] as const).some((p) => lu[p] === 'P');
      for (const a of DEFENSES) {
        const s = defenseScene(n, false, a);
        const backDefenders = ([1, 5, 6] as const).map((p) => lu[p]).filter((id) => id !== 'P');
        if (!setterBack) {
          expect(backDefenders).toHaveLength(3);
          continue;
        }
        expect(backDefenders).toHaveLength(2);
        const [d1, d2] = backDefenders.map((id) => get(s, id));
        expect(Math.abs(d1.x - d2.x)).toBeGreaterThanOrEqual(2.5);
        expect(d1.y).toBeGreaterThanOrEqual(5);
        expect(d2.y).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it("chaque défenseur décalé garde son côté : celui de gauche reste à gauche de celui de droite", () => {
    for (const n of R) {
      const lu = lineup(n);
      if (!([1, 5, 6] as const).some((p) => lu[p] === 'P')) continue;
      for (const a of DEFENSES) {
        const s = defenseScene(n, false, a);
        const ids = ([1, 5, 6] as const).map((p) => lu[p]).filter((id) => id !== 'P');
        const [d1, d2] = ids.map((id) => get(s, id));
        const naturalLeft = ([5, 6, 1] as const).find((p) => (ids as string[]).includes(lu[p]))!;
        const leftId = lu[naturalLeft];
        const left = get(s, leftId);
        const right = leftId === ids[0] ? d2 : d1;
        expect(left.x).toBeLessThan(right.x);
      }
    }
  });
});

describe('attaque, soutien et angles', () => {
  it('zones : les attaquants de ligne avant sont R4 en 4, C en 3, Pt en 2 quand ils sont tous devant', () => {
    // Rotation 4 : P est au poste 4 ; rotation 1 : P au poste 1, le trio R4a, Ca, Pt est devant.
    const zones = frontAttackers(1, false);
    expect(zones.get(4)).toBe('R4a');
    expect(zones.get(3)).toBe('Ca');
    expect(zones.get(2)).toBe('Pt');
  });

  it("passeur devant : deux zones attaquables au filet plus la pipe, donc 3 cibles", () => {
    for (const n of R) {
      for (const lib of LIB) {
        const targets = availableTargets(n, lib);
        const P = lineup(n);
        const setterFront = ([2, 3, 4] as const).some((p) => P[p] === 'P');
        expect(targets).toContain('pipe');
        expect(targets).toHaveLength(setterFront ? 3 : 4);
      }
    }
  });

  it('les zones respectent les rôles : R4 jamais en 2 si un Pt est devant, C jamais en 4 si un R4 est devant', () => {
    for (const n of R) {
      const zones = frontAttackers(n, false);
      const lu = lineup(n);
      const front = ([2, 3, 4] as const).map((p) => lu[p]);
      if (front.includes('Pt')) expect(zones.get(2)).toBe('Pt');
      if (front.some((id) => ROLE_OF[id] === 'C')) {
        const centralFront = front.find((id) => ROLE_OF[id] === 'C')!;
        expect(zones.get(3)).toBe(centralFront);
      }
    }
  });

  it('le passeur est au filet, au point de passe', () => {
    for (const n of R) {
      for (const t of availableTargets(n, false)) {
        const p = get(attackScene(n, false, t), 'P');
        expect(p.y).toBeLessThanOrEqual(1.5);
        expect(p.x).toBeGreaterThan(5);
      }
    }
  });

  it("le pipe est frappé par un joueur arrière qui n'est ni le passeur ni le libéro, en priorité R4", () => {
    for (const n of R) {
      for (const lib of LIB) {
        const id = pipeAttacker(n, lib);
        expect(id).not.toBe('P');
        expect(id).not.toBe('L');
        const s = attackScene(n, lib, 'pipe');
        expect(s.overlay.hitter).toBe(id);
        expect(get(s, id).y).toBeGreaterThan(3);
        const lu = lineup(n);
        const backIds = ([1, 5, 6] as const).map((p) => lu[p]);
        expect(backIds).toContain(id);
        if (backIds.some((b) => ROLE_OF[b] === 'R4')) expect(ROLE_OF[id]).toBe('R4');
      }
    }
  });

  it("les scènes d'attaque respectent : 6 joueurs, distance >= 1 m, dans le demi-terrain", () => {
    for (const n of R) {
      for (const lib of LIB) {
        for (const t of availableTargets(n, lib)) {
          const s = attackScene(n, lib, t);
          expectShape(s, lib);
          expectInsideOurHalf(s);
          expect(minPairDistance(onCourt(s))).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("l'attaquant visé est identifié, et se trouve dans la bonne zone", () => {
    for (const n of R) {
      for (const t of availableTargets(n, false)) {
        const s = attackScene(n, false, t);
        expect(s.overlay.hitter).toBeDefined();
        const h = get(s, s.overlay.hitter!);
        if (t === 'p4') expect(h.x).toBeLessThan(3);
        if (t === 'p2') expect(h.x).toBeGreaterThan(6);
        if (t === 'p3') expect(Math.abs(h.x - 4.5)).toBeLessThan(1);
        if (t === 'pipe') expect(h.y).toBeGreaterThan(3);
      }
    }
  });

  it("le soutien : les joueurs restants se placent derrière l'attaquant, à 3 m ou plus du filet", () => {
    for (const n of R) {
      for (const t of availableTargets(n, false)) {
        const s = attackScene(n, false, t);
        const decoys = new Set(frontAttackers(n, false).values());
        const covers = onCourt(s).filter(
          (p) => p.id !== 'P' && p.id !== s.overlay.hitter && !decoys.has(p.id),
        );
        expect(covers.length).toBeGreaterThan(0);
        expect(covers.every((p) => p.y >= 4)).toBe(true);
      }
    }
  });

  it('les points de soutien restent dans le terrain et sont derrière la ligne des 3 m', () => {
    for (const t of TARGETS) {
      const pts = coverPoints(t);
      expect(pts).toHaveLength(3);
      for (const p of pts) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(9);
        expect(p.y).toBeGreaterThan(3);
        expect(p.y).toBeLessThanOrEqual(9);
      }
    }
  });

  it("le libéro ne monte jamais au filet en attaque", () => {
    for (const n of R) {
      for (const t of availableTargets(n, true)) {
        const l = get(attackScene(n, true, t), 'L');
        if (l.onCourt) expect(l.y).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("angles depuis la ligne gauche (poste 4) : ligne, diagonale, diagonale courte, feinte, tous dans le terrain adverse", () => {
    const a = attackAngles('p4');
    expect(a.lines.map((l) => l.label)).toEqual(['Ligne', 'Diagonale', 'Diagonale courte (cut)', 'Feinte']);
    const [ligne, diag] = a.lines;
    expect(ligne.to.x).toBeLessThan(a.from.x);
    expect(diag.to.x).toBeGreaterThan(a.from.x + 4);
    for (const l of a.lines) {
      expect(l.to.y).toBeLessThan(0);
      expect(l.to.y).toBeGreaterThanOrEqual(-9);
      expect(l.to.x).toBeGreaterThanOrEqual(0);
      expect(l.to.x).toBeLessThanOrEqual(9);
    }
  });

  it('les angles en 2 sont le miroir des angles en 4', () => {
    const l = attackAngles('p4');
    const r = attackAngles('p2');
    l.lines.forEach((line, i) => {
      expect(r.lines[i].to.y).toBe(line.to.y);
      expect(r.lines[i].to.x).toBeCloseTo(9 - line.to.x, 5);
    });
    expect(r.from.y).toBe(0);
  });

  it('angles en 3 : gauche, centre, droit, feinte ; au pipe : départ derrière la ligne des 3 m', () => {
    expect(attackAngles('p3').lines.map((l) => l.label)).toEqual(['Angle gauche', 'Centre', 'Angle droit', 'Feinte']);
    expect(attackAngles('p3').from.y).toBe(0);
    const pipe = attackAngles('pipe');
    expect(pipe.from.y).toBeGreaterThanOrEqual(3);
    expect(pipe.lines).toHaveLength(4);
    for (const l of pipe.lines) expect(l.to.y).toBeLessThan(0);
  });

  it("chaque scène d'attaque porte ses angles", () => {
    for (const t of availableTargets(1, false)) {
      const s = attackScene(1, false, t);
      expect(s.overlay.angles).toEqual(attackAngles(t));
    }
  });

  it('zones : isFront reste cohérent avec les postes utilisés', () => {
    expect([2, 3, 4].every((p) => isFront(p as 2 | 3 | 4))).toBe(true);
  });
});

describe("étiquettes de scène : poste au moment du service", () => {
  it("chaque joueur en jeu porte son poste de rotation, le libéro celui du central qu'il remplace, les absents aucun", () => {
    for (const n of R) {
      for (const lib of LIB) {
        const scenes = [
          serviceScene(n, lib),
          receptionScene(n, lib, 5),
          defenseScene(n, lib, 'adv4'),
          attackScene(n, lib, availableTargets(n, lib)[0]),
        ];
        for (const s of scenes) {
          for (const p of s.players) {
            if (!p.onCourt) {
              expect(p.poste).toBeNull();
            } else if (p.id === 'L') {
              expect([1, 5, 6]).toContain(p.poste);
            } else {
              expect(p.poste).toBe(posteOf(p.id as Exclude<typeof p.id, 'L'>, n));
            }
          }
        }
      }
    }
  });

  it("le poste ne change pas pendant l'échange : mêmes numéros au service, en défense et en attaque", () => {
    for (const n of R) {
      const a = serviceScene(n, false);
      const b = attackScene(n, false, availableTargets(n, false)[0]);
      for (const p of a.players) expect(get(b, p.id).poste).toBe(p.poste);
    }
  });
});

describe("contraintes d'attaque : ligne arrière et libéro", () => {
  it("un joueur de ligne arrière n'attaque jamais au filet : en attaque, seul le passeur (à la passe) est en ligne arrière devant les 3 m", () => {
    for (const n of R) {
      for (const lib of LIB) {
        for (const t of availableTargets(n, lib)) {
          const s = attackScene(n, lib, t);
          for (const p of onCourt(s)) {
            if (p.id === 'P') continue;
            if (!isFrontRow(p.id, p.poste)) expect(p.y).toBeGreaterThanOrEqual(3);
          }
        }
      }
    }
  });

  it("les attaques en 2, 3 et 4 sont frappées par un joueur de ligne avant ; le pipe par un joueur de ligne arrière, depuis derrière la ligne des 3 m", () => {
    for (const n of R) {
      for (const lib of LIB) {
        for (const t of availableTargets(n, lib)) {
          const s = attackScene(n, lib, t);
          const h = get(s, s.overlay.hitter!);
          if (t === 'pipe') {
            expect(isFrontRow(h.id, h.poste)).toBe(false);
            expect(h.y).toBeGreaterThanOrEqual(3);
            expect(s.overlay.angles!.from.y).toBeGreaterThanOrEqual(3);
          } else {
            expect(isFrontRow(h.id, h.poste)).toBe(true);
            expect(h.y).toBeLessThan(3);
          }
        }
      }
    }
  });

  it("le libéro n'attaque jamais : il n'est ni attaquant ni leurre, et reste derrière la ligne des 3 m", () => {
    for (const n of R) {
      for (const t of availableTargets(n, true)) {
        const s = attackScene(n, true, t);
        expect(s.overlay.hitter).not.toBe('L');
        const l = get(s, 'L');
        if (l.onCourt) {
          expect(l.y).toBeGreaterThanOrEqual(3);
          expect([...frontAttackers(n, true).values()]).not.toContain('L');
        }
      }
    }
    for (const n of R) expect(pipeAttacker(n, true, 'P')).not.toBe('L');
  });
});
