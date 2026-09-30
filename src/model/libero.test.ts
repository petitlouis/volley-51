import { describe, expect, it } from 'vitest';
import { courtSlots, liberoPoste, liberoReplacesAt } from './libero';
import { ROLE_OF } from './roles';
import { isBack, isFront } from './rotation';
import type { Phase } from './types';

const R = [1, 2, 3, 4, 5, 6];
const PHASES: Phase[] = ['service', 'reception', 'defense', 'attack'];

describe('libéro', () => {
  it('sans libéro, aucun L sur le terrain et les 6 joueurs de base jouent', () => {
    for (const n of R) {
      for (const ph of PHASES) {
        const ids = courtSlots(n, ph, false).map((s) => s.player);
        expect(ids).not.toContain('L');
        expect(new Set(ids).size).toBe(6);
      }
    }
  });

  it('avec libéro : 6 joueurs sur le terrain, jamais deux L', () => {
    for (const n of R) {
      for (const ph of PHASES) {
        const slots = courtSlots(n, ph, true);
        expect(slots).toHaveLength(6);
        expect(slots.filter((s) => s.player === 'L').length).toBeLessThanOrEqual(1);
        expect(new Set(slots.map((s) => s.player)).size).toBe(6);
      }
    }
  });

  it('le libéro ne joue jamais en ligne avant', () => {
    for (const n of R) {
      for (const ph of PHASES) {
        for (const s of courtSlots(n, ph, true)) {
          if (s.player === 'L') expect(isBack(s.poste)).toBe(true);
        }
      }
    }
  });

  it('le libéro ne remplace que des centraux', () => {
    for (const n of R) {
      for (const ph of PHASES) {
        for (const s of courtSlots(n, ph, true)) {
          if (s.replaced) expect(ROLE_OF[s.replaced]).toBe('C');
        }
      }
    }
  });

  it('le central de ligne avant n\'est jamais remplacé', () => {
    for (const n of R) {
      for (const ph of PHASES) {
        const front = courtSlots(n, ph, true).filter((s) => isFront(s.poste));
        expect(front.every((s) => s.player !== 'L')).toBe(true);
        expect(front.some((s) => ROLE_OF[s.player] === 'C')).toBe(true);
      }
    }
  });

  it("hors service, le libéro remplace le central arrière (postes 5, 6 ou 1) : 1 remplacement par rotation", () => {
    for (const n of R) {
      for (const ph of ['reception', 'defense', 'attack'] as Phase[]) {
        expect(courtSlots(n, ph, true).filter((s) => s.replaced)).toHaveLength(1);
      }
    }
  });

  it("au service, le central qui sert (poste 1) n'est pas remplacé", () => {
    expect(liberoReplacesAt(1, 'service')).toBe(false);
    expect(liberoReplacesAt(5, 'service')).toBe(true);
    expect(liberoReplacesAt(6, 'service')).toBe(true);
    for (const n of R) {
      const slots = courtSlots(n, 'service', true);
      const server = slots.find((s) => s.poste === 1)!;
      expect(server.replaced).toBeUndefined();
      // Un central au poste 1 sert : le libéro n'entre pas du tout cette rotation-là.
      if (ROLE_OF[server.player] === 'C') expect(slots.some((s) => s.player === 'L')).toBe(false);
    }
  });

  it('le libéro remplace au poste 1 hors service', () => {
    expect(liberoReplacesAt(1, 'reception')).toBe(true);
    expect(liberoReplacesAt(1, 'defense')).toBe(true);
    expect(liberoReplacesAt(1, 'attack')).toBe(true);
  });

  it('ni le passeur ni un attaquant ne sont jamais remplacés', () => {
    for (const n of R) {
      for (const ph of PHASES) {
        for (const s of courtSlots(n, ph, true)) {
          if (s.replaced) expect(['Ca', 'Cb']).toContain(s.replaced);
        }
      }
    }
  });
});

describe('poste du libéro', () => {
  it("c'est le poste du central de ligne arrière qu'il remplace, en réception, défense et attaque", () => {
    for (const n of R) {
      const poste = liberoPoste(n);
      expect([1, 5, 6]).toContain(poste);
      for (const ph of ['reception', 'defense', 'attack'] as Phase[]) {
        const slots = courtSlots(n, ph, true);
        expect(slots.find((s) => s.player === 'L')!.poste).toBe(poste);
        expect(slots.find((s) => s.replaced)!.poste).toBe(poste);
      }
    }
  });

  it("au service, quand le central est au poste 1 il sert lui-même : le libéro n'entre pas et son poste théorique est 1", () => {
    for (const n of R) {
      const slots = courtSlots(n, 'service', true);
      if (liberoPoste(n) === 1) expect(slots.some((s) => s.player === 'L')).toBe(false);
      else expect(slots.find((s) => s.player === 'L')!.poste).toBe(liberoPoste(n));
    }
  });

  it('un seul central est en ligne arrière : les postes 2, 3 et 4 en comptent exactement un', () => {
    for (const n of R) {
      const back = courtSlots(n, 'reception', false).filter((s) => !isFront(s.poste) && ROLE_OF[s.player] === 'C');
      const front = courtSlots(n, 'reception', false).filter((s) => isFront(s.poste) && ROLE_OF[s.player] === 'C');
      expect(back).toHaveLength(1);
      expect(front).toHaveLength(1);
    }
  });
});

describe("libéro et échange commencé par notre service", () => {
  it("le central du poste 1 reste en jeu quand nous servons (rotations 3 et 6), en défense comme en attaque", () => {
    for (const n of [3, 6]) {
      for (const ph of ['defense', 'attack'] as Phase[]) {
        const slots = courtSlots(n, ph, true, true);
        expect(slots.some((s) => s.player === 'L')).toBe(false);
        expect(ROLE_OF[slots.find((s) => s.poste === 1)!.player]).toBe('C');
      }
    }
  });

  it("quand l'adversaire sert, le libéro remplace le central du poste 1 (1-L) : c'est l'échange par défaut", () => {
    for (const n of [3, 6]) {
      for (const ph of ['reception', 'defense', 'attack'] as Phase[]) {
        const l = courtSlots(n, ph, true).find((s) => s.player === 'L');
        expect(l?.poste).toBe(1);
      }
    }
  });

  it("aux postes 5 et 6, le libéro est en place dans les deux cas", () => {
    for (const n of [1, 2, 4, 5]) {
      expect(courtSlots(n, 'defense', true, true).some((s) => s.player === 'L')).toBe(true);
      expect(courtSlots(n, 'defense', true, false).some((s) => s.player === 'L')).toBe(true);
    }
  });
});
