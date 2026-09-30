import type { PlayerId, Poste } from './types';

export const POSTES: Poste[] = [1, 2, 3, 4, 5, 6];

/** Rotation 1, du poste 1 au poste 6. */
export const INITIAL_LINEUP: Record<Poste, Exclude<PlayerId, 'L'>> = {
  1: 'P',
  2: 'R4a',
  3: 'Ca',
  4: 'Pt',
  5: 'R4b',
  6: 'Cb',
};

/**
 * Joueurs par poste pour la rotation n (1 à 6).
 * Sens de rotation : 2→1→6→5→4→3→2, donc le joueur du poste p+1 arrive au poste p.
 */
export function lineup(rotation: number): Record<Poste, Exclude<PlayerId, 'L'>> {
  const shift = (((rotation - 1) % 6) + 6) % 6;
  const result = {} as Record<Poste, Exclude<PlayerId, 'L'>>;
  for (const p of POSTES) {
    result[p] = INITIAL_LINEUP[(((p - 1 + shift) % 6) + 1) as Poste];
  }
  return result;
}

export function posteOf(id: Exclude<PlayerId, 'L'>, rotation: number): Poste {
  const lu = lineup(rotation);
  return POSTES.find((p) => lu[p] === id)!;
}

export const isFront = (p: Poste): boolean => p === 2 || p === 3 || p === 4;
export const isBack = (p: Poste): boolean => !isFront(p);
export const oppositePoste = (p: Poste): Poste => (((p + 2) % 6) + 1) as Poste;
