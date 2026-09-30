import { describe, expect, it } from 'vitest';
import { attackScene, availableTargets, frontAttackers, pipeAttacker, SETTER_TARGET, ZONE_XY } from './formations';
import { actingSetter, buildFlow, type FlowSetup, type Node } from './flow';
import { minPairDistance } from './geometry';
import { courtSlots } from './libero';
import { ALL_IDS, ROLE_OF } from './roles';
import { isFront } from './rotation';
import type { PlayerId } from './types';

const R = [1, 2, 3, 4, 5, 6];
const ATTACKS = ['adv4', 'adv3', 'adv2', 'pipe'];
const setup = (over: Partial<FlowSetup> = {}): FlowSetup => ({
  kind: 'service',
  rotation: 1,
  libero: true,
  receptionMode: 5,
  ...over,
});
const get = (n: Node, id: PlayerId) => n.scene.players.find((p) => p.id === id)!;
const atSetterTarget = (n: Node, id: PlayerId) => {
  const p = get(n, id);
  return p.x === SETTER_TARGET.x && p.y === SETTER_TARGET.y;
};

/** Parcourt toutes les branches de l'arbre et appelle `visit` sur chaque chemin complet. */
function walk(s: FlowSetup, visit: (choices: string[], nodes: Node[]) => void, choices: string[] = []): void {
  const nodes = buildFlow(s, choices);
  const last = nodes[nodes.length - 1];
  if (last.options.length === 0) {
    visit(choices, nodes);
    return;
  }
  for (const o of last.options) walk(s, visit, [...choices, o.id]);
}

describe('hypothèses : départ sur le service', () => {
  const setterOnCourt = (rotation: number) =>
    courtSlots(rotation, 'defense', true).find((s) => s.player === 'P')!;

  it('le premier coup est le service, avec 4 attaques adverses possibles', () => {
    const [n0] = buildFlow(setup(), []);
    expect(n0.title).toBe('Service');
    expect(n0.options.map((o) => o.id)).toEqual(ATTACKS);
    expect(n0.text).toContain('7.4');
  });

  it("l'attaque en 4 adverse propose ligne, grande diagonale, petite diagonale, bidouille", () => {
    const nodes = buildFlow(setup(), ['adv4']);
    expect(nodes[1].question).toContain('intention');
    expect(nodes[1].options.map((o) => o.label)).toEqual(['Ligne', 'Grande diagonale', 'Petite diagonale', 'Bidouille']);
    expect(buildFlow(setup(), ['adv2'])[1].options.map((o) => o.label)).toEqual(['Ligne', 'Grande diagonale', 'Petite diagonale', 'Bidouille']);
    expect(buildFlow(setup(), ['adv3'])[1].options).toHaveLength(4);
    expect(buildFlow(setup(), ['pipe'])[1].options).toHaveLength(4);
  });

  it("passeur en ligne arrière : il ne défend pas, il attend à droite, prêt à passer", () => {
    for (const rotation of R) {
      const setterBack = !isFront(setterOnCourt(rotation).poste);
      for (const a of ATTACKS) {
        const [, defense] = buildFlow(setup({ rotation }), [a]);
        const p = get(defense, 'P');
        if (setterBack) {
          expect(p.x).toBeGreaterThan(7);
          expect(p.y).toBeLessThan(5);
          expect(defense.text).toContain('ne défend pas');
        } else {
          expect(defense.text).not.toContain('ne défend pas');
        }
      }
    }
  });

  it("chaque intention a un point de chute dans notre terrain, marqué à l'écran, et la balle y va", () => {
    for (const a of ATTACKS) {
      const opts = buildFlow(setup(), [a])[1].options;
      for (const o of opts) {
        const node = buildFlow(setup(), [a, o.id])[2];
        const land = node.scene.overlay.landing!;
        expect(land.y).toBeGreaterThan(0);
        expect(land.y).toBeLessThanOrEqual(9);
        expect(land.x).toBeGreaterThanOrEqual(0);
        expect(land.x).toBeLessThanOrEqual(9);
        const path = node.scene.overlay.ballPath!;
        expect(path[path.length - 1]).toEqual(land);
      }
    }
  });

  it("suivant l'intention les joueurs bougent : le défenseur le plus proche démarre vers la balle, et les placements diffèrent", () => {
    for (const a of ATTACKS) {
      const base = buildFlow(setup(), [a])[1];
      const seen = new Set<string>();
      for (const o of base.options) {
        const node = buildFlow(setup(), [a, o.id])[2];
        const land = node.scene.overlay.landing!;
        const moved = node.scene.players.filter((p, i) => {
          const q = base.scene.players[i];
          return p.onCourt && (p.x !== q.x || p.y !== q.y);
        });
        expect(moved).toHaveLength(1);
        const before = base.scene.players.find((q) => q.id === moved[0].id)!;
        expect(Math.hypot(moved[0].x - land.x, moved[0].y - land.y)).toBeLessThan(
          Math.hypot(before.x - land.x, before.y - land.y),
        );
        seen.add(`${moved[0].id}@${moved[0].x.toFixed(2)},${moved[0].y.toFixed(2)}`);
      }
      expect(seen.size).toBeGreaterThanOrEqual(3);
    }
  });

  it("tout joueur a une action : contre pour ceux au filet, reprise pour les autres (sauf le passeur, à la passe)", () => {
    for (const rotation of R) {
      for (const libero of [false, true]) {
        for (const a of ATTACKS) {
          for (const i of buildFlow(setup({ rotation, libero }), [a])[1].options) {
            const node = buildFlow(setup({ rotation, libero }), [a, i.id])[2];
            const on = node.scene.players.filter((p) => p.onCourt);
            const blockers = on.filter((p) => p.y <= 1.5).map((p) => p.id);
            const actors = node.options.filter((o) => o.id !== 'BLOCK').map((o) => o.id as PlayerId);
            expect(node.options.some((o) => o.id === 'BLOCK')).toBe(blockers.length > 0);
            const expected = on.map((p) => p.id).filter((id) => !blockers.includes(id) && id !== 'P');
            expect([...actors].sort()).toEqual([...expected].sort());
            expect(actors).not.toContain('P');
            // Tout joueur en jeu est soit bloqueur, soit acteur possible, soit le passeur qui va à la passe.
            const covered = new Set<string>([...blockers, ...actors, 'P']);
            expect(covered.size).toBe(6);
          }
        }
      }
    }
  });

  it("les reprises sont classées du plus proche au plus éloigné du point de chute", () => {
    for (const a of ATTACKS) {
      for (const i of buildFlow(setup(), [a])[1].options) {
        const node = buildFlow(setup(), [a, i.id])[2];
        const land = node.scene.overlay.landing!;
        const dists = node.options
          .filter((o) => o.id !== 'BLOCK')
          .map((o) => {
            const p = get(node, o.id as PlayerId);
            return Math.hypot(p.x - land.x, p.y - land.y);
          });
        expect(dists).toEqual([...dists].sort((x, y) => x - y));
      }
    }
  });

  it("contre : la centrale et le R4 au filet bloquent, puis contre gagnant (point) ou contre amorti", () => {
    const nodes = buildFlow(setup({ rotation: 1 }), ['adv4', 'ligne', 'BLOCK']);
    const block = nodes[2].options.find((o) => o.id === 'BLOCK')!;
    expect(block.label).toBe('Contre : 2-R4a + 3-Ca');
    const outcome = nodes[3];
    expect(outcome.title).toBe('Contre');
    expect(outcome.text).toContain('2-R4a et 3-Ca contrent');
    expect(outcome.options.map((o) => o.id)).toEqual(['kill', 'soft']);
  });

  it("contre gagnant : la balle revient chez l'adversaire, point pour nous, fin du scénario", () => {
    const end = buildFlow(setup({ rotation: 1 }), ['adv4', 'ligne', 'BLOCK', 'kill'])[4];
    expect(end.title).toBe('Contre gagnant');
    expect(end.text).toContain('Point pour nous');
    expect(end.question).toBeNull();
    const path = end.scene.overlay.ballPath!;
    expect(path[0].y).toBe(0);
    expect(path[path.length - 1].y).toBeLessThan(0);
  });

  it("contre amorti : la balle retombe chez nous près de la ligne des 3 m, chacun sauf le passeur peut la relever, classés par proximité", () => {
    for (const rotation of R) {
      for (const a of ATTACKS) {
        const n = buildFlow(setup({ rotation }), [a, buildFlow(setup({ rotation }), [a])[1].options[0].id, 'BLOCK', 'soft']);
        const soft = n[4];
        expect(soft.title).toBe('Contre amorti');
        const land = soft.scene.overlay.landing!;
        expect(land.y).toBeGreaterThan(2);
        expect(land.y).toBeLessThan(4.5);
        const ids = soft.options.map((o) => o.id as PlayerId);
        expect(ids).not.toContain('P');
        expect(ids).toHaveLength(5);
        const d = ids.map((id) => {
          const p = get(soft, id);
          return Math.hypot(p.x - land.x, p.y - land.y);
        });
        // Le plus proche a déjà démarré vers la balle : il reste classé en tête.
        expect(d[0]).toBeLessThanOrEqual(Math.min(...d.slice(1)) + 1e-9);
        const path = soft.scene.overlay.ballPath!;
        expect(path[path.length - 1]).toEqual(land);
      }
    }
  });

  it("après un contre amorti, le joueur court relever la balle, le passeur va à la passe, puis on attaque", () => {
    const soft = buildFlow(setup({ rotation: 1 }), ['adv4', 'ligne', 'BLOCK', 'soft'])[4];
    const who = soft.options[0].id;
    const nodes = buildFlow(setup({ rotation: 1 }), ['adv4', 'ligne', 'BLOCK', 'soft', who, 'p4']);
    const land = soft.scene.overlay.landing!;
    const d = get(nodes[5], who as PlayerId);
    expect({ x: d.x, y: d.y }).toEqual(land);
    expect(atSetterTarget(nodes[5], 'P')).toBe(true);
    expect(nodes[6].title).toBe('Passe en 4');
    expect(nodes[6].scene.overlay.hitter).toBeDefined();
  });

  it("reprise : le joueur court au point de chute, la balle va au passeur qui est à la passe", () => {
    for (const a of ATTACKS) {
      for (const i of buildFlow(setup(), [a])[1].options) {
        const node2 = buildFlow(setup(), [a, i.id])[2];
        for (const o of node2.options.filter((x) => x.id !== 'BLOCK')) {
          const node3 = buildFlow(setup(), [a, i.id, o.id])[3];
          const land = node2.scene.overlay.landing!;
          const d = get(node3, o.id as PlayerId);
          expect({ x: d.x, y: d.y }).toEqual(land);
          expect(node3.scene.overlay.ball).toEqual(land);
          expect(atSetterTarget(node3, 'P')).toBe(true);
          expect(node3.options.map((x) => x.id)).toEqual(availableTargets(1, true, 'P'));
        }
      }
    }
  });

  it("scénario : le passeur sert (rotation 1), l'adversaire attaque en 4 en ligne : il ne réceptionne pas et va à la passe", () => {
    const nodes = buildFlow(setup({ rotation: 1, libero: true }), ['adv4', 'ligne']);
    const ids = nodes[2].options.map((o) => o.id);
    expect(ids).not.toContain('P');
    const dig = buildFlow(setup({ rotation: 1, libero: true }), ['adv4', 'ligne', 'L']);
    expect(atSetterTarget(dig[3], 'P')).toBe(true);
    expect(dig[3].text).toContain('se libère vers le filet');
    expect(dig[3].text).not.toContain('pointu');
  });

  it('toutes les branches : contre gagnant en 5 coups, reprise en 5 coups, contre amorti en 7 coups, avec attaquant et angles', () => {
    for (const rotation of [1, 2, 4, 6]) {
      for (const libero of [false, true]) {
        walk(setup({ rotation, libero }), (choices, nodes) => {
          for (const n of nodes) {
            expect(n.scene.players.map((p) => p.id)).toEqual(ALL_IDS);
            expect(n.scene.players.filter((p) => p.onCourt)).toHaveLength(6);
          }
          if (choices[2] === 'BLOCK' && choices[3] === 'kill') {
            expect(nodes).toHaveLength(5);
            return;
          }
          expect(nodes).toHaveLength(choices[2] === 'BLOCK' ? 7 : 5);
          const last = nodes[nodes.length - 1];
          expect(last.scene.overlay.hitter).toBeDefined();
          expect(last.scene.overlay.angles!.lines.length).toBeGreaterThanOrEqual(4);
          expect(minPairDistance(last.scene.players.filter((p) => p.onCourt))).toBeGreaterThanOrEqual(1);
          expect(atSetterTarget(last, 'P')).toBe(true);
          expect(last.scene.overlay.hitter).not.toBe('P');
        });
      }
    }
  });

  it("un choix qui n'est pas une option du coup précédent est refusé", () => {
    expect(() => buildFlow(setup(), ['adv9'])).toThrow();
    expect(() => buildFlow(setup(), ['adv4', 'inconnue'])).toThrow();
    expect(() => buildFlow(setup(), ['adv4', 'ligne', 'Ca'])).toThrow();
    expect(() => buildFlow(setup(), ['adv4', 'ligne', 'BLOCK', 'p4'])).toThrow();
    expect(() => buildFlow(setup(), ['adv4', 'ligne', 'BLOCK', 'kill', 'p4'])).toThrow();
    expect(() => buildFlow(setup(), ['adv4', 'ligne', 'L', 'p9'])).toThrow();
  });
});

describe('hypothèses : départ sur la réception', () => {
  const rec = (over: Partial<FlowSetup> = {}) => setup({ kind: 'reception', ...over });
  const setterFront = (rotation: number) =>
    isFront(courtSlots(rotation, 'reception', true).find((s) => s.player === 'P')!.poste);

  it('le premier coup est la réception à 4 ou à 5, ordre de rotation rappelé', () => {
    const n5 = buildFlow(rec({ receptionMode: 5 }), [])[0];
    const n4 = buildFlow(rec({ receptionMode: 4 }), [])[0];
    expect(n5.title).toBe('Réception à 5');
    expect(n4.title).toBe('Réception à 4');
    expect(n5.text).toContain('7.4');
  });

  it("le serveur adverse peut viser 6 zones ; « sur le passeur » n'existe que s'il est en ligne arrière", () => {
    for (const rotation of R) {
      const ids = buildFlow(rec({ rotation }), [])[0].options.map((o) => o.id);
      expect(ids.slice(0, 6)).toEqual(['zone1', 'zone6', 'zone5', 'zone2', 'zone3', 'zone4']);
      expect(ids.includes('passeur')).toBe(!setterFront(rotation));
      expect(ids).toHaveLength(setterFront(rotation) ? 6 : 7);
    }
  });

  it("chaque zone a un point de chute marqué, la balle y va, et le joueur le plus proche démarre vers elle", () => {
    for (const rotation of R) {
      const base = buildFlow(rec({ rotation }), [])[0];
      for (const z of base.options) {
        const node = buildFlow(rec({ rotation }), [z.id])[1];
        const land = node.scene.overlay.landing!;
        expect(land.y).toBeGreaterThan(0);
        const path = node.scene.overlay.ballPath!;
        expect(path[path.length - 1]).toEqual(land);
        const moved = node.scene.players.filter((p, i) => {
          const q = base.scene.players[i];
          return p.onCourt && (p.x !== q.x || p.y !== q.y);
        });
        // Sur le passeur, le point de chute est sa propre place : personne n'a à bouger.
        expect(moved).toHaveLength(z.id === 'passeur' ? 0 : 1);
      }
    }
  });

  it("qui réceptionne : les receveurs classés du plus proche au plus éloigné ; pas le passeur au filet ni, à 4, le central au filet", () => {
    for (const rotation of R) {
      for (const mode of [4, 5] as const) {
        const base = buildFlow(rec({ rotation, receptionMode: mode }), []);
        for (const z of base[0].options) {
          const node = buildFlow(rec({ rotation, receptionMode: mode }), [z.id])[1];
          const ids = node.options.map((o) => o.id as PlayerId);
          expect(ids.includes('P')).toBe(!setterFront(rotation));
          const expected = (mode === 5 ? 5 : 4) + (setterFront(rotation) ? 0 : 1);
          expect(ids).toHaveLength(expected);
          if (mode === 4) {
            const netCentral = courtSlots(rotation, 'reception', true).find((s) => isFront(s.poste) && ROLE_OF[s.player] === 'C');
            expect(ids).not.toContain(netCentral!.player);
          }
          const land = node.scene.overlay.landing!;
          const d = ids.map((id) => {
            const p = get(node, id);
            return Math.hypot(p.x - land.x, p.y - land.y);
          });
          expect(d[0]).toBeLessThanOrEqual(Math.min(...d.slice(1)) + 1e-9);
        }
      }
    }
  });

  it("passeur en ligne avant (rotation 6, poste 2) : il est au filet à droite et ne reçoit jamais", () => {
    const [n0] = buildFlow(rec({ rotation: 6 }), []);
    const p = get(n0, 'P');
    expect(p.y).toBeLessThanOrEqual(1.5);
    expect(p.x).toBeGreaterThan(5);
    expect(n0.options.map((o) => o.id)).not.toContain('passeur');
    const nodes = buildFlow(rec({ rotation: 6 }), ['zone6', buildFlow(rec({ rotation: 6 }), ['zone6'])[1].options[0].id]);
    expect(nodes[2].text).toContain('en ligne avant');
    expect(nodes[2].text).not.toContain('se libère');
  });

  it('parcours complet : 4 coups, le receveur court au point de chute, le passeur du moment se place au filet, attaque avec angles', () => {
    for (const rotation of [1, 3, 5, 6]) {
      for (const receptionMode of [4, 5] as const) {
        for (const libero of [false, true]) {
          walk(rec({ rotation, receptionMode, libero }), (choices, nodes) => {
            expect(nodes).toHaveLength(4);
            const setter = actingSetter(choices[1] as PlayerId);
            const land = nodes[1].scene.overlay.landing!;
            const r = get(nodes[2], choices[1] as PlayerId);
            expect({ x: r.x, y: r.y }).toEqual(land);
            expect(atSetterTarget(nodes[2], setter)).toBe(true);
            expect(nodes[2].scene.overlay.ball).toEqual(land);
            expect(atSetterTarget(nodes[3], setter)).toBe(true);
            expect(nodes[3].scene.overlay.hitter).toBeDefined();
            expect(nodes[3].scene.overlay.angles).toBeDefined();
            expect(minPairDistance(nodes[3].scene.players.filter((p) => p.onCourt))).toBeGreaterThanOrEqual(1);
          });
        }
      }
    }
  });

  it('service sur le passeur (ligne arrière) : il réceptionne à son poste, le pointu fait la passe', () => {
    const nodes = buildFlow(rec({ rotation: 1 }), ['passeur', 'P']);
    const p0 = get(nodes[0], 'P');
    expect(nodes[1].scene.overlay.landing).toEqual({ x: p0.x, y: p0.y });
    expect(nodes[2].text).toContain('pointu');
    expect(atSetterTarget(nodes[2], 'Pt')).toBe(true);
  });

  it("un choix invalide est refusé", () => {
    expect(() => buildFlow(rec(), ['zone9'])).toThrow();
    expect(() => buildFlow(rec({ rotation: 6 }), ['passeur'])).toThrow();
    expect(() => buildFlow(rec(), ['zone1', 'P', 'p4'])).not.toThrow();
    expect(() => buildFlow(rec(), ['zone1', 'inconnu'])).toThrow();
  });
});

describe('attaque avec un passeur de remplacement', () => {
  it("le pointu au filet n'attaque pas, le passeur devient un joueur ordinaire", () => {
    for (const rotation of R) {
      const zones = frontAttackers(rotation, true, 'Pt');
      expect([...zones.values()]).not.toContain('Pt');
      const pipe = pipeAttacker(rotation, true, 'Pt');
      expect(['Pt', 'P', 'L']).not.toContain(pipe);
      const s = attackScene(rotation, true, 'pipe', 'Pt');
      expect(s.players.filter((p) => p.onCourt)).toHaveLength(6);
    }
  });
});

describe('trajet de la balle', () => {
  const last = <T,>(a: T[]): T => a[a.length - 1];
  const same = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x === b.x && a.y === b.y;

  it("chaque coup porte un trajet, et la balle part d'où elle s'était arrêtée au coup précédent (sauf le contre, qui refait l'attaque)", () => {
    for (const kind of ['service', 'reception'] as const) {
      for (const rotation of [1, 3, 6]) {
        walk(setup({ kind, rotation }), (_choices, nodes) => {
          nodes.forEach((n, i) => {
            const path = n.scene.overlay.ballPath!;
            expect(path.length).toBeGreaterThanOrEqual(1);
            for (const p of path) {
              expect(p.x).toBeGreaterThanOrEqual(-3);
              expect(p.x).toBeLessThanOrEqual(12);
              expect(p.y).toBeGreaterThanOrEqual(-10.5);
              expect(p.y).toBeLessThanOrEqual(12.5);
            }
            if (i > 0 && n.title !== 'Contre') {
              expect(same(path[0], last(nodes[i - 1].scene.overlay.ballPath!))).toBe(true);
            }
          });
        });
      }
    }
  });

  it("service : serveur, attaque adverse, point de chute, joueur qui reprend, passeur, point de frappe", () => {
    const nodes = buildFlow(setup({ rotation: 1, libero: true }), ['adv4', 'ligne', 'L', 'p4']);
    expect(nodes[0].scene.overlay.ballPath![0]).toEqual({ x: 7.5, y: 10.2 });
    expect(last(nodes[1].scene.overlay.ballPath!)).toEqual({ x: 8, y: -1.2 });
    expect(nodes[2].scene.overlay.ballPath).toEqual([{ x: 8, y: -1.2 }, { x: 8.3, y: 6.8 }]);
    expect(nodes[3].scene.overlay.ballPath).toEqual([{ x: 8.3, y: 6.8 }, SETTER_TARGET]);
    expect(nodes[4].scene.overlay.ballPath).toEqual([SETTER_TARGET, nodes[4].scene.overlay.angles!.from]);
  });

  it("réception : la balle part du serveur adverse, va à la zone visée puis au passeur, puis à l'attaquant", () => {
    const nodes = buildFlow(setup({ kind: 'reception', rotation: 1 }), ['zone2', 'Pt', 'p2']);
    expect(nodes[0].scene.overlay.ballPath).toEqual([{ x: 4.5, y: -10 }]);
    expect(nodes[1].scene.overlay.ballPath).toEqual([{ x: 4.5, y: -10 }, { x: 7.5, y: 2.6 }]);
    expect(nodes[2].scene.overlay.ballPath).toEqual([{ x: 7.5, y: 2.6 }, SETTER_TARGET]);
    expect(last(nodes[3].scene.overlay.ballPath!)).toEqual(nodes[3].scene.overlay.angles!.from);
  });

  it("contre amorti : la balle revient du filet chez nous, puis au passeur", () => {
    const nodes = buildFlow(setup({ rotation: 1 }), ['adv4', 'ligne', 'BLOCK', 'soft']);
    const kill = buildFlow(setup({ rotation: 1 }), ['adv4', 'ligne', 'BLOCK', 'kill']);
    expect(nodes[3].scene.overlay.ballPath![1].y).toBe(0);
    expect(nodes[4].scene.overlay.ballPath![0].y).toBe(0);
    expect(kill[4].scene.overlay.ballPath![1].y).toBeLessThan(0);
  });
});

describe('libéro et central qui sert', () => {
  const rec = (over: Partial<FlowSetup> = {}) => setup({ kind: 'reception', ...over });

  it("nous servons, central au poste 1 (rotations 3 et 6) : il reste en jeu pendant tout l'échange, le libéro n'entre pas", () => {
    for (const rotation of [3, 6]) {
      walk(setup({ rotation, libero: true }), (_choices, nodes) => {
        for (const n of nodes) {
          expect(get(n, 'L').onCourt).toBe(false);
          const onCourt = n.scene.players.filter((p) => p.onCourt);
          expect(onCourt).toHaveLength(6);
          const first = onCourt.find((p) => p.poste === 1)!;
          expect(first.role).toBe('C');
          expect(n.options.map((o) => o.label).join(' ')).not.toContain('L reprend');
          expect(n.options.map((o) => o.label).join(' ')).not.toContain('L relève');
        }
      });
    }
  });

  it("nous servons, libéro en 6 ou 5 (rotations 1, 2, 4, 5) : il est en jeu du service à l'attaque", () => {
    for (const rotation of [1, 2, 4, 5]) {
      walk(setup({ rotation, libero: true }), (_choices, nodes) => {
        for (const n of nodes) expect(get(n, 'L').onCourt).toBe(true);
      });
    }
  });

  it("nous réceptionnons, central au poste 1 (rotations 3 et 6) : le libéro le remplace avant l'échange (1-L) et peut réceptionner", () => {
    for (const rotation of [3, 6]) {
      const [n0] = buildFlow(rec({ rotation, libero: true }), []);
      const l = get(n0, 'L');
      expect(l.onCourt).toBe(true);
      expect(l.poste).toBe(1);
      const options = buildFlow(rec({ rotation, libero: true }), ['zone1'])[1].options.map((o) => o.label);
      expect(options).toContain('1-L réceptionne');
    }
  });

  it("le libéro ne sert jamais et n'occupe jamais un poste de ligne avant, dans aucun coup", () => {
    for (const kind of ['service', 'reception'] as const) {
      for (const rotation of R) {
        walk(setup({ kind, rotation, libero: true }), (_choices, nodes) => {
          for (const n of nodes) {
            const l = get(n, 'L');
            if (!l.onCourt) continue;
            expect([1, 5, 6]).toContain(l.poste);
            expect(l.y).toBeLessThanOrEqual(9);
          }
        });
      }
    }
    // Au service, le serveur (poste 1, derrière la ligne de fond) n'est jamais le libéro.
    for (const rotation of R) {
      const [n0] = buildFlow(setup({ rotation, libero: true }), []);
      const server = n0.scene.players.find((p) => p.onCourt && p.y > 9)!;
      expect(server.id).not.toBe('L');
    }
  });
});

describe('les attaquants se placent pendant la passe', () => {
  const rec = (over: Partial<FlowSetup> = {}) => setup({ kind: 'reception', ...over });

  it("réception, rotation 1 : le central passe au centre, le R4 à gauche, le pointu à droite dès que le receveur joue la balle", () => {
    const nodes = buildFlow(rec({ rotation: 1 }), ['zone6', 'L']);
    const pass = nodes[2];
    const at = (id: PlayerId) => {
      const p = get(pass, id);
      return { x: p.x, y: p.y };
    };
    expect(at('R4a')).toEqual({ x: ZONE_XY[4].x, y: ZONE_XY[4].y });
    expect(at('Ca')).toEqual({ x: ZONE_XY[3].x, y: ZONE_XY[3].y });
    expect(at('Pt')).toEqual({ x: ZONE_XY[2].x, y: ZONE_XY[2].y });
    expect(pass.text).toContain('2-R4a à gauche');
    expect(pass.text).toContain('3-Ca au centre');
    expect(pass.text).toContain('4-Pt à droite');
  });

  it("seuls les joueurs de ligne avant se placent : les joueurs de ligne arrière restent derrière la ligne des 3 m", () => {
    for (const rotation of R) {
      for (const mode of [4, 5] as const) {
        const [n0] = buildFlow(rec({ rotation, receptionMode: mode }), []);
        for (const z of n0.options) {
          const nodes = buildFlow(rec({ rotation, receptionMode: mode }), [z.id, buildFlow(rec({ rotation, receptionMode: mode }), [z.id])[1].options[0].id]);
          const pass = nodes[2];
          const setter = pass.text.includes('pointu') ? 'Pt' : 'P';
          const attackers = new Set([...frontAttackers(rotation, true, setter).values()]);
          for (const p of pass.scene.players.filter((q) => q.onCourt)) {
            if (attackers.has(p.id) && p.id !== nodes[1].options[0].id) continue;
            if (p.id === setter || p.id === nodes[1].options[0].id) continue;
            if (p.role !== 'L' && p.poste !== null && ![2, 3, 4].includes(p.poste)) expect(p.y).toBeGreaterThanOrEqual(3);
          }
        }
      }
    }
  });

  it("passeur en ligne avant : seulement deux attaquants se placent", () => {
    for (const rotation of [4, 5, 6]) {
      const first = buildFlow(rec({ rotation }), [])[0].options[0].id;
      const pass = buildFlow(rec({ rotation }), [first, buildFlow(rec({ rotation }), [first])[1].options[0].id])[2];
      const parts = pass.text.match(/(à gauche|au centre|à droite)/g) ?? [];
      expect(parts).toHaveLength(2);
    }
  });

  it("nous servons : après la reprise de balle, les attaquants de ligne avant sont déjà à leur zone, et n'en bougent plus quand la passe est choisie", () => {
    for (const rotation of R) {
      const flow = buildFlow(setup({ rotation }), ['adv4', 'ligne']);
      const toucher = flow[2].options.find((o) => o.id !== 'BLOCK')!.id as PlayerId;
      const dig = buildFlow(setup({ rotation }), ['adv4', 'ligne', toucher])[3];
      const attackers = frontAttackers(rotation, true, 'P', true);
      const target = dig.options[0].id;
      const attack = buildFlow(setup({ rotation }), ['adv4', 'ligne', toucher, target])[4];
      for (const [zone, id] of attackers) {
        if (id === toucher) continue;
        const d = get(dig, id);
        expect({ x: d.x, y: d.y }).toEqual({ x: ZONE_XY[zone].x, y: ZONE_XY[zone].y });
        const a = get(attack, id);
        expect({ x: a.x, y: a.y }).toEqual({ x: d.x, y: d.y });
      }
      expect(dig.text).toContain('se placent');
    }
  });
});
