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

/**
 * `ownServe` : l'échange a commencé par notre service. Un libéro ne peut entrer ou sortir qu'entre deux
 * échanges : le central qui sert (poste 1) reste donc en jeu jusqu'à la fin de l'échange.
 */
export function courtSlots(
  rotation: number,
  phase: Phase,
  libero: boolean,
  ownServe: boolean = phase === 'service',
): Slot[] {
  const lu = lineup(rotation);
  const rule: Phase = ownServe ? 'service' : phase === 'service' ? 'reception' : phase;
  return POSTES.map((poste) => {
    const player = lu[poste];
    if (libero && ROLE_OF[player] === 'C' && liberoReplacesAt(poste, rule)) {
      return { poste, player: 'L' as PlayerId, replaced: player };
    }
    return { poste, player };
  });
}

/**
 * Poste du libéro : celui du central de ligne arrière qu'il remplace (5 ou 6, et 1 quand ce central
 * ne sert pas). Il y a toujours exactement un central en ligne arrière.
 */
export function liberoPoste(rotation: number): Poste {
  const lu = lineup(rotation);
  return ([5, 6, 1] as Poste[]).find((p) => ROLE_OF[lu[p]] === 'C')!;
}
