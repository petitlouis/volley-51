import { describe, expect, it } from 'vitest';
import { isFrontRow, label, roleColor, ROLE_COLOR_BACK, ROLE_COLOR_FRONT } from './roles';
import { INITIAL_LINEUP, isBack, isFront, lineup, oppositePoste, POSTES, posteOf } from './rotation';
import type { PlayerId, Poste } from './types';

const R = [1, 2, 3, 4, 5, 6];
const SIX: Exclude<PlayerId, 'L'>[] = ['P', 'R4a', 'R4b', 'Ca', 'Cb', 'Pt'];

describe('rotation', () => {
  it("la rotation 1 vaut P, R4a, Ca, Pt, R4b, Cb du poste 1 au poste 6", () => {
    expect(POSTES.map((p) => lineup(1)[p])).toEqual(['P', 'R4a', 'Ca', 'Pt', 'R4b', 'Cb']);
    expect(lineup(1)).toEqual(INITIAL_LINEUP);
  });

  it('le joueur du poste 2 passe au poste 1 à la rotation suivante (2→1→6→5→4→3→2)', () => {
    const chain: Poste[] = [2, 1, 6, 5, 4, 3, 2];
    const who = lineup(1)[2];
    chain.forEach((p, i) => expect(posteOf(who, 1 + i)).toBe(p));
  });

  it('6 rotations successives ramènent à la position de départ (rotation 7 = rotation 1)', () => {
    expect(lineup(7)).toEqual(lineup(1));
  });

  it('chaque joueur passe une fois par chaque poste sur les 6 rotations', () => {
    for (const id of SIX) {
      const visited = R.map((n) => posteOf(id, n)).sort();
      expect(visited).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it('chaque rotation place les 6 joueurs sur 6 postes distincts', () => {
    for (const n of R) expect(new Set(POSTES.map((p) => lineup(n)[p])).size).toBe(6);
  });

  it('les opposés restent opposés : P/Pt, R4a/R4b, Ca/Cb', () => {
    const pairs: [Exclude<PlayerId, 'L'>, Exclude<PlayerId, 'L'>][] = [
      ['P', 'Pt'],
      ['R4a', 'R4b'],
      ['Ca', 'Cb'],
    ];
    for (const n of R) {
      for (const [a, b] of pairs) expect(posteOf(b, n)).toBe(oppositePoste(posteOf(a, n)));
    }
  });

  it('oppositePoste : 1↔4, 2↔5, 3↔6', () => {
    expect([1, 2, 3].map((p) => oppositePoste(p as Poste))).toEqual([4, 5, 6]);
    expect([4, 5, 6].map((p) => oppositePoste(p as Poste))).toEqual([1, 2, 3]);
  });

  it('ligne avant = postes 2,3,4 ; ligne arrière = postes 5,6,1', () => {
    expect(POSTES.filter(isFront)).toEqual([2, 3, 4]);
    expect(POSTES.filter(isBack)).toEqual([1, 5, 6]);
  });

  it('en ligne avant il y a toujours un R4, un C et (P ou Pt) ; idem en arrière', () => {
    for (const n of R) {
      const roles = (front: boolean) =>
        POSTES.filter((p) => isFront(p) === front)
          .map((p) => lineup(n)[p])
          .map((id) => (id.startsWith('R4') ? 'R4' : id.startsWith('C') ? 'C' : 'PPt'))
          .sort();
      expect(roles(true)).toEqual(['C', 'PPt', 'R4']);
      expect(roles(false)).toEqual(['C', 'PPt', 'R4']);
    }
  });

  it("le passeur est en ligne avant aux rotations 4 à 6 seulement (P part du poste 1)", () => {
    // Rotation 1 : poste 1. Il monte au poste 2 à la rotation 6 (2→1 inverse), poste 3 en 5, poste 4 en 4.
    expect(R.map((n) => posteOf('P', n))).toEqual([1, 6, 5, 4, 3, 2]);
  });
});

describe('étiquettes : poste au moment du service et rôle', () => {
  it("rotation 1 : 1-P, 2-R4, 3-C, 4-Pt, 5-R4, 6-C", () => {
    const lu = lineup(1);
    expect(POSTES.map((p) => label(lu[p], p))).toEqual(['1-P', '2-R4', '3-C', '4-Pt', '5-R4', '6-C']);
  });

  it("le numéro est le poste du moment : le joueur qui sert est toujours le 1, dans toutes les rotations", () => {
    for (const n of R) {
      const server = lineup(n)[1];
      expect(label(server, posteOf(server, n))).toMatch(/^1-/);
    }
  });

  it("le numéro suit la rotation, pas l'origine : le passeur est 6-P à la rotation 2, le central Ca est 6-C à la rotation 4", () => {
    expect(label('P', posteOf('P', 2))).toBe('6-P');
    expect(label('Ca', posteOf('Ca', 4))).toBe('6-C');
    expect(label('Pt', posteOf('Pt', 4))).toBe('1-Pt');
  });

  it("les six étiquettes d'une rotation portent les six numéros 1 à 6, une fois chacun", () => {
    for (const n of R) {
      const lu = lineup(n);
      const numbers = POSTES.map((p) => label(lu[p], p)[0]).sort();
      expect(numbers).toEqual(['1', '2', '3', '4', '5', '6']);
    }
  });

  it("sans poste (joueur sorti), l'étiquette n'affiche que le rôle, jamais « undefined »", () => {
    expect(label('Ca')).toBe('C');
    expect(label('Pt')).toBe('Pt');
  });

  it("le libéro s'appelle L", () => {
    expect(label('L')).toBe('L');
    expect(label('L', 6)).toBe('L');
  });
});

describe('ligne avant et arrière : clair et foncé', () => {
  it('postes 2, 3, 4 : avant ; postes 5, 6, 1 : arrière ; le libéro toujours arrière', () => {
    expect(POSTES.filter((p) => isFrontRow('P', p))).toEqual([2, 3, 4]);
    expect(isFrontRow('L', 3)).toBe(false);
    expect(isFrontRow('L', null)).toBe(false);
  });

  it("chaque rôle a une couleur claire (avant) différente de la foncée (arrière)", () => {
    for (const role of ['P', 'R4', 'C', 'Pt'] as const) {
      expect(ROLE_COLOR_FRONT[role]).not.toBe(ROLE_COLOR_BACK[role]);
      expect(roleColor(role, true)).toBe(ROLE_COLOR_FRONT[role]);
      expect(roleColor(role, false)).toBe(ROLE_COLOR_BACK[role]);
      // Luminance approximative : la version avant est plus claire que celle de l'arrière.
      const lum = (hex: string) => {
        const v = parseInt(hex.slice(1), 16);
        return 0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255);
      };
      expect(lum(ROLE_COLOR_FRONT[role])).toBeGreaterThan(lum(ROLE_COLOR_BACK[role]));
    }
  });
});
