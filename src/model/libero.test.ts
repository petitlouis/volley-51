import { describe, expect, it } from 'vitest';
import { courtSlots, liberoReplacesAt } from './libero';
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
