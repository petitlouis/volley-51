import type { Point, Poste } from './types';

/**
 * Règle FIVB 7.4.2 (équipe en réception, au moment de la frappe du serveur) :
 * - chaque joueur arrière est plus loin du filet que le joueur avant correspondant (5/4, 6/3, 1/2) ;
 * - latéralement, ligne avant 4 < 3 < 2 et ligne arrière 5 < 6 < 1 (x croissant vers la droite).
 * `margin` impose un écart minimal (en m) au lieu d'accepter un pied à niveau.
 */
export function overlapViolations(pos: Record<Poste, Point>, margin = 0): string[] {
  const out: string[] = [];
  const deeper = (back: Poste, front: Poste): void => {
    if (pos[back].y < pos[front].y + margin) out.push(`${back} doit être derrière ${front}`);
  };
  const left = (a: Poste, b: Poste): void => {
    if (pos[a].x > pos[b].x - margin) out.push(`${a} doit être à gauche de ${b}`);
  };
  deeper(5, 4);
  deeper(6, 3);
  deeper(1, 2);
  left(4, 3);
  left(3, 2);
  left(5, 6);
  left(6, 1);
  return out;
}
