export type PlayerId = 'P' | 'R4a' | 'R4b' | 'Ca' | 'Cb' | 'Pt' | 'L';
export type Poste = 1 | 2 | 3 | 4 | 5 | 6;
export type Role = 'P' | 'R4' | 'C' | 'Pt' | 'L';
export type Phase = 'service' | 'reception' | 'defense' | 'attack';
export type ReceptionMode = 3 | 4 | 5;
export type DefenseAttack = 'adv4' | 'adv3' | 'adv2' | 'pipe';
export type AttackTarget = 'p4' | 'p3' | 'p2' | 'pipe';

export interface Point {
  x: number;
  y: number;
}

export interface PlayerPos extends Point {
  id: PlayerId;
  role: Role;
  /** Rayon d'action théorique en mètres. */
  radius: number;
  onCourt: boolean;
  /** Poste au moment du service (rotation), fixe pendant l'échange. Le libéro prend celui du central qu'il remplace. */
  poste: Poste | null;
}

export interface AttackAngle {
  label: string;
  to: Point;
}

export interface Overlay {
  opponent?: Point & { label: string };
  hitter?: PlayerId;
  /** Joueur qui touche la balle à ce coup, et position de la balle. */
  ball?: Point;
  /** Trajet de la balle à ce coup : suite de points reliés par des envois successifs. */
  ballPath?: Point[];
  /** Point où la balle est attendue (intention de l'attaquant adverse). */
  landing?: Point;
  angles?: { from: Point; lines: AttackAngle[] };
}

export interface Scene {
  players: PlayerPos[];
  overlay: Overlay;
}
