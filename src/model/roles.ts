import type { PlayerId, Poste, Role } from './types';

export const ALL_IDS: PlayerId[] = ['P', 'R4a', 'R4b', 'Ca', 'Cb', 'Pt', 'L'];

export const ROLE_OF: Record<PlayerId, Role> = {
  P: 'P',
  R4a: 'R4',
  R4b: 'R4',
  Ca: 'C',
  Cb: 'C',
  Pt: 'Pt',
  L: 'L',
};

/** Clair pour la ligne avant, foncé pour la ligne arrière : les contraintes de jeu se lisent d'un coup d'œil. */
export const ROLE_COLOR_FRONT: Record<Role, string> = {
  P: '#7fabf2',
  R4: '#f9bd7a',
  C: '#7fd6a2',
  Pt: '#f28c8d',
  L: '#e8c317',
};
export const ROLE_COLOR_BACK: Record<Role, string> = {
  P: '#1d4a9e',
  R4: '#b85f08',
  C: '#17663a',
  Pt: '#9a1d20',
  L: '#c9a200',
};

export const roleColor = (role: Role, front: boolean): string =>
  front ? ROLE_COLOR_FRONT[role] : ROLE_COLOR_BACK[role];

export const ROLE_NAME: Record<Role, string> = {
  P: 'Passeur',
  R4: 'Réceptionneur-attaquant',
  C: 'Central',
  Pt: 'Pointu',
  L: 'Libéro',
};

/**
 * Étiquette du rond : poste au moment du service et rôle, par exemple `3-C`.
 * Le serveur est donc toujours le `1-…`. Le libéro s'appelle simplement `L`.
 */
export function label(id: PlayerId, poste?: Poste): string {
  if (id === 'L') return 'L';
  return poste === undefined ? ROLE_OF[id] : `${poste}-${ROLE_OF[id]}`;
}

/** Ligne avant (postes 2, 3, 4) ; le libéro est toujours en ligne arrière. */
export const isFrontRow = (id: PlayerId, poste: Poste | null): boolean =>
  id !== 'L' && (poste === 2 || poste === 3 || poste === 4);
