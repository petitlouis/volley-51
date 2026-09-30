import { ROLE_OF } from './roles';
import { lineup, POSTES } from './rotation';
import type { Phase, PlayerId, Poste } from './types';

export interface Slot {
  poste: Poste;
  /** Joueur réellement sur le terrain (le libéro peut remplacer un central). */
  player: PlayerId;
  /** Central remplacé par le libéro, le cas échéant. */
  replaced?: PlayerId;
}

/**
 * Le libéro remplace le central de ligne arrière (postes 5 et 6).
 * Au poste 1, il le remplace aussi, sauf quand nous servons : le central sert lui-même.
 */
export function liberoReplacesAt(poste: Poste, phase: Phase): boolean {
  if (poste === 5 || poste === 6) return true;
  return poste === 1 && phase !== 'service';
}

export function courtSlots(rotation: number, phase: Phase, libero: boolean): Slot[] {
  const lu = lineup(rotation);
  return POSTES.map((poste) => {
    const player = lu[poste];
    if (libero && ROLE_OF[player] === 'C' && liberoReplacesAt(poste, phase)) {
      return { poste, player: 'L' as PlayerId, replaced: player };
    }
    return { poste, player };
  });
}
