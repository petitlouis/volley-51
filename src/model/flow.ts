import {
  approachLanding,
  attackScene,
  availableTargets,
  BLOCK_MAX_Y,
  defenseScene,
  frontAttackers,
  INTENTIONS,
  OPPONENT_XY,
  receptionScene,
  receivingSlots,
  secondContactScene,
  SERVE_ZONES,
  SERVER_XY,
  SETTER_TARGET,
  serviceScene,
} from './formations';
import { dist2 } from './geometry';
import { courtSlots, liberoPoste } from './libero';
import { label } from './roles';
import { isFront, lineup, POSTES, posteOf } from './rotation';
import type { AttackTarget, DefenseAttack, PlayerId, Point, Poste, ReceptionMode, Scene } from './types';

export type StartKind = 'service' | 'reception';

export interface FlowSetup {
  kind: StartKind;
  rotation: number;
  libero: boolean;
  receptionMode: ReceptionMode;
}

export interface Option {
  id: string;
  label: string;
  hint?: string;
}

/** Un coup joué : la scène à l'écran, son explication, et les hypothèses suivantes. */
export interface Node {
  title: string;
  text: string;
  scene: Scene;
  question: string | null;
  options: Option[];
}

export const DEFENSE_LABEL: Record<DefenseAttack, string> = {
  adv4: 'Attaque adverse en 4',
  adv3: 'Attaque adverse en 3',
  adv2: 'Attaque adverse en 2',
  pipe: 'Pipe adverse',
};

const DEFENSE_HINT: Record<DefenseAttack, string> = {
  adv4: 'frappe vers notre côté droit',
  adv3: 'attaque rapide au centre',
  adv2: 'frappe vers notre côté gauche',
  pipe: 'attaque arrière au centre',
};

export const TARGET_LABEL: Record<AttackTarget, string> = {
  p4: 'Passe en 4',
  p3: 'Passe en 3',
  p2: 'Passe en 2',
  pipe: 'Pipe',
};

const DEFENSE_TEXT: Record<DefenseAttack, string> = {
  adv4:
    "L'attaquant adverse du poste 4 frappe vers notre côté droit (face à notre poste 2). " +
    'Bloc à deux (postes 2 et 3), le poste 4 recule sur la ligne des 3 m pour couvrir les feintes, ' +
    'le poste 1 garde la ligne, le poste 6 la diagonale, le poste 5 le fond côté gauche.',
  adv2:
    "L'attaquant adverse du poste 2 frappe vers notre côté gauche (face à notre poste 4). " +
    'Bloc à deux (postes 4 et 3), le poste 2 recule sur la ligne des 3 m, ' +
    'le poste 5 garde la ligne, le poste 6 la diagonale, le poste 1 le fond côté droit.',
  adv3:
    'Attaque rapide au centre. Bloc à un seul joueur (poste 3), les postes 2 et 4 reculent à 3 m ' +
    'pour couvrir les feintes, les trois joueurs arrière forment une ligne en 5, 6, 1.',
  pipe:
    'Attaque arrière au centre (pipe). Le poste 3 bloque seul, les postes 2 et 4 reculent, ' +
    'les défenseurs arrière avancent car la balle arrive moins profond.',
};

const TARGET_TEXT: Record<AttackTarget, string> = {
  p4: "Passe en 4 : l'attaquant part de la ligne gauche. Les traits montrent ses angles : ligne, diagonale, diagonale courte, feinte. Les autres forment le soutien autour de lui.",
  p3: "Passe en 3 : attaque rapide du central. Il choisit entre l'angle gauche, le centre, l'angle droit ou la feinte. Le soutien se place derrière lui.",
  p2: "Passe en 2 : l'attaquant part de la ligne droite. Ligne, diagonale, diagonale courte ou feinte. Les autres le soutiennent.",
  pipe: "Pipe : attaque d'un joueur de ligne arrière depuis l'axe du terrain. Il doit s'élancer de derrière la ligne des 3 m, et le libéro n'attaque jamais. Le soutien se place autour de lui.",
};

const DEFENSE_ATTACKS = Object.keys(DEFENSE_LABEL) as DefenseAttack[];

/** Point où le service adverse est frappé (derrière leur ligne de fond), et où notre service retombe. */
export const OPPONENT_SERVER: Point = { x: 4.5, y: -10 };
export const SERVE_LANDING: Point = { x: 4.5, y: -6 };

const withPath = (scene: Scene, ballPath: Point[]): Scene => ({
  ...scene,
  overlay: { ...scene.overlay, ballPath },
});
const opponentAt = (a: DefenseAttack): Point => ({ x: OPPONENT_XY[a].x, y: OPPONENT_XY[a].y });

/** Si le passeur joue la balle, le pointu (son opposé) fait la passe. */
export const actingSetter = (touched: PlayerId): PlayerId => (touched === 'P' ? 'Pt' : 'P');

/** Étiquette d'un joueur : poste au moment du service et rôle (le serveur est toujours le 1). */
const lab = (rotation: number, id: PlayerId): string =>
  id === 'L' ? label('L', liberoPoste(rotation)) : label(id, posteOf(id as Exclude<PlayerId, 'L'>, rotation));

function rotationText(rotation: number, libero: boolean): string {
  const lu = lineup(rotation);
  const parts = POSTES.map((p) => (p === 1 ? `${lab(rotation, lu[p])} (au service)` : lab(rotation, lu[p])));
  return `Rotation ${rotation} : ${parts.join(', ')}.${libero ? ' Le libéro remplace le central arrière.' : ''}`;
}

const MODE_NOTE: Record<ReceptionMode, string> = {
  3: 'le pointu, le passeur et le central de ligne avant se préparent à attaquer.',
  4: 'le central de ligne avant reçoit aussi ; le pointu et le passeur se préparent à attaquer.',
  5: 'le pointu reçoit en renfort quand la réception n\'est pas assez solide ; le passeur ne reçoit pas.',
};

const ZONE_TEXT: Record<2 | 3 | 4, string> = { 4: 'à gauche', 3: 'au centre', 2: 'à droite' };

/** Où se placent les attaquants de ligne avant pendant la passe. */
function attackersText(n: number, attackers: Map<2 | 3 | 4, PlayerId>): string {
  const parts = ([4, 3, 2] as const)
    .filter((z) => attackers.has(z))
    .map((z) => `${lab(n, attackers.get(z)!)} ${ZONE_TEXT[z]}`);
  return `Pendant la passe, les attaquants de ligne avant se placent : ${parts.join(', ')}.`;
}

function setterText(n: number, touched: PlayerId, setterInFront: boolean): string {
  if (touched === 'P') {
    return `Le passeur (${lab(n, 'P')}) joue la balle : il ne peut pas faire la passe. Le pointu (${lab(n, 'Pt')}), son opposé, la fait depuis le filet.`;
  }
  return setterInFront
    ? `Le passeur (${lab(n, 'P')}) est en ligne avant et n'a pas touché la balle : il se place au point de passe, côté droit du filet.`
    : `Le passeur (${lab(n, 'P')}) est en ligne arrière et n'a pas touché la balle : il se libère vers le filet pour faire la passe.`;
}

const posteOfPlayer = (
  rotation: number,
  libero: boolean,
  id: PlayerId,
  phase: 'defense' | 'reception',
  ownServe = false,
): number => courtSlots(rotation, phase, libero, ownServe).find((s) => s.player === id)!.poste;

function targetOptions(rotation: number, libero: boolean, setter: PlayerId, ownServe = false): Option[] {
  return availableTargets(rotation, libero, setter, ownServe).map((t) => ({ id: t, label: TARGET_LABEL[t] }));
}

function attackNode(
  rotation: number,
  libero: boolean,
  target: AttackTarget,
  setter: PlayerId,
  ownServe = false,
): Node {
  const scene = attackScene(rotation, libero, target, setter, ownServe);
  const s = scene.players.find((p) => p.id === setter)!;
  const returns = s.poste !== null && !isFront(s.poste);
  return {
    title: TARGET_LABEL[target],
    text: TARGET_TEXT[target] + (returns ? ` Le passeur (${lab(rotation, setter)}) a pénétré pour la passe : il retourne défendre au fond.` : ''),
    scene: withPath(scene, [SETTER_TARGET, scene.overlay.angles!.from]),
    question: null,
    options: [],
  };
}

export const BLOCK = 'BLOCK';
export const SOFT_BLOCK_Y = 3.4;

function serviceFlow(setup: FlowSetup, choices: string[]): Node[] {
  const { rotation: n, libero } = setup;
  const nodes: Node[] = [
    {
      title: 'Service',
      text:
        `${rotationText(n, libero)} Nous servons. Règle FIVB 7.4 : l'équipe au service est libre de se placer où elle veut. ` +
        `Chacun prend donc sa zone de jeu habituelle, quel que soit son poste de rotation : R4 à gauche, ` +
        `central au centre, pointu et passeur à droite. Le serveur (${lab(n, lineup(n)[1])}) est derrière la ligne de fond.`,
      scene: withPath(serviceScene(n, libero), [SERVER_XY, SERVE_LANDING]),
      question: "Que fait l'adversaire ? Choisis son attaque.",
      options: DEFENSE_ATTACKS.map((a) => ({ id: a, label: DEFENSE_LABEL[a], hint: DEFENSE_HINT[a] })),
    },
  ];
  if (choices.length < 1) return nodes;

  const attack = choices[0] as DefenseAttack;
  const opp = opponentAt(attack);
  // Échange commencé par notre service : le central du poste 1 reste en jeu, le libéro n'entre pas à sa place.
  const defense = defenseScene(n, libero, attack, undefined, true);
  const setterBack = !isFront(posteOfPlayer(n, libero, 'P', 'defense', true) as Poste);
  nodes.push({
    title: DEFENSE_LABEL[attack],
    text:
      DEFENSE_TEXT[attack] +
      (setterBack ? ` Le passeur (${lab(n, 'P')}) ne défend pas : il se tient à droite, prêt à monter faire la passe. Les deux autres défenseurs arrière décalent pour couvrir tout le fond du terrain.` : ''),
    scene: withPath(defense, [SERVE_LANDING, opp]),
    question: "Quelle est l'intention de l'attaquant adverse ?",
    options: INTENTIONS[attack].map((i) => ({ id: i.id, label: i.label, hint: i.hint })),
  });
  if (choices.length < 2) return nodes;

  const intention = INTENTIONS[attack].find((i) => i.id === choices[1]);
  if (!intention) throw new Error(`Intention invalide : ${choices[1]}`);
  const aimed = defenseScene(n, libero, attack, intention.id, true);
  const blockers = aimed.players.filter((p) => p.onCourt && p.y <= BLOCK_MAX_Y);
  const others = aimed.players
    .filter((p) => p.onCourt && p.y > BLOCK_MAX_Y && p.id !== 'P')
    .sort((a, b) => dist2(a, intention.landing) - dist2(b, intention.landing));
  const options: Option[] = [];
  if (blockers.length > 0) {
    options.push({
      id: BLOCK,
      label: `Contre : ${blockers.map((p) => lab(n, p.id)).join(' + ')}`,
      hint: `bloc à ${blockers.length}`,
    });
  }
  others.forEach((p, i) =>
    options.push({
      id: p.id,
      label: `${lab(n, p.id)} reprend`,
      hint: `poste ${posteOfPlayer(n, libero, p.id, 'defense', true)}${i === 0 ? ', le plus proche de la balle' : ''}`,
    }),
  );
  nodes.push({
    title: `${intention.label}`,
    text:
      `${DEFENSE_LABEL[attack]} : ${intention.hint}. La balle est attendue à la croix rouge. ` +
      `Le défenseur le plus proche (${lab(n, others[0].id)}) démarre vers la balle. ` +
      `Chaque joueur a une action possible : les joueurs au filet contrent, les autres reprennent.`,
    scene: withPath(aimed, [opp, intention.landing]),
    question: 'Qui joue la balle ?',
    options,
  });
  if (choices.length < 3) return nodes;

  if (choices[2] === BLOCK) {
    const bx = blockers.reduce((a, p) => a + p.x, 0) / blockers.length;
    const names = blockers.map((p) => lab(n, p.id)).join(' et ');
    const netPoint = { x: bx, y: 0 };
    nodes.push({
      title: 'Contre',
      text: `${names} contrent : la balle est touchée au filet. Va-t-elle retomber chez l'adversaire (contre gagnant) ou chez nous (contre amorti) ?`,
      scene: {
        ...defense,
        overlay: { ...defense.overlay, opponent: undefined, ball: { x: bx, y: 0.3 }, ballPath: [opp, netPoint] },
      },
      question: 'Quel est le résultat du contre ?',
      options: [
        { id: 'kill', label: 'Contre gagnant', hint: 'point pour nous' },
        { id: 'soft', label: 'Contre amorti', hint: 'la balle retombe chez nous' },
      ],
    });
    if (choices.length < 4) return nodes;

    if (choices[3] === 'kill') {
      nodes.push({
        title: 'Contre gagnant',
        text: `${names} stoppent la balle : elle revient chez l'adversaire. Point pour nous.`,
        scene: {
          ...defense,
          overlay: { ...defense.overlay, opponent: undefined, ball: { x: bx, y: 0.3 }, ballPath: [netPoint, { x: bx, y: -4.5 }] },
        },
        question: null,
        options: [],
      });
      return nodes;
    }

    // Contre amorti : la balle retombe devant nous, près de la ligne des 3 m.
    const soft: Point = { x: bx, y: SOFT_BLOCK_Y };
    const softScene = approachLanding(defense, soft, ['P']);
    const players = defense.players.filter((p) => p.onCourt && p.id !== 'P');
    const relievers = [...players].sort((a, b) => dist2(a, soft) - dist2(b, soft));
    nodes.push({
      title: 'Contre amorti',
      text: `La balle touche le bloc et retombe chez nous, près de la ligne des 3 m. Le joueur le plus proche (${lab(n, relievers[0].id)}) démarre vers elle. Chacun peut la relever, sauf le passeur qui va à la passe.`,
      scene: {
        ...softScene,
        overlay: { ...softScene.overlay, opponent: undefined, ballPath: [netPoint, soft] },
      },
      question: 'Qui relève la balle ?',
      options: relievers.map((p, i) => ({
        id: p.id,
        label: `${lab(n, p.id)} relève`,
        hint: `${p.y <= BLOCK_MAX_Y ? 'au filet' : `poste ${posteOfPlayer(n, libero, p.id, 'defense', true)}`}${i === 0 ? ', le plus proche' : ''}`,
      })),
    });
    if (choices.length < 5) return nodes;
    return digAndAttack(nodes, choices, 4, defense, soft, n, libero, setterBack);
  }

  return digAndAttack(nodes, choices, 2, defense, intention.landing, n, libero, setterBack);
}

/**
 * Joueur qui joue la balle à `landing` (il court la chercher), passe du passeur, puis attaque.
 * `at` est l'indice, dans `choices`, du joueur qui joue la balle.
 */
function digAndAttack(
  nodes: Node[],
  choices: string[],
  at: number,
  base: Scene,
  landing: Point,
  n: number,
  libero: boolean,
  setterBack: boolean,
): Node[] {
  const digger = choices[at] as PlayerId;
  const attackers = frontAttackers(n, libero, 'P', true);
  nodes.push({
    title: `${lab(n, digger)} reprend la balle`,
    text: `${lab(n, digger)} court à la balle. ${setterText(n, digger, !setterBack)} ${attackersText(n, attackers)}`,
    scene: withPath(secondContactScene(base, digger, 'P', landing, attackers), [landing, SETTER_TARGET]),
    question: 'Où passer ? Choisis notre attaque.',
    options: targetOptions(n, libero, 'P', true),
  });
  if (choices.length < at + 2) return nodes;
  nodes.push(attackNode(n, libero, choices[at + 1] as AttackTarget, 'P', true));
  return nodes;
}

function receptionFlow(setup: FlowSetup, choices: string[]): Node[] {
  const { rotation: n, libero, receptionMode: mode } = setup;
  const formation = receptionScene(n, libero, mode);
  const rule =
    "L'équipe en réception doit respecter l'ordre de rotation (règle 7.4) : le passeur se place au filet " +
    "s'il est en ligne avant, derrière son vis-à-vis s'il est en ligne arrière.";
  const slots = courtSlots(n, 'reception', libero);
  const receiving = receivingSlots(slots, mode);
  const receivingIds = receiving.map((s) => s.player);
  const names = (list: PlayerId[]): string => list.map((id) => lab(n, id)).join(', ');
  const idle = slots
    .filter((s) => !receiving.includes(s) && s.player !== 'P')
    .map((s) => s.player);
  const setterInFront = isFront(posteOfPlayer(n, libero, 'P', 'reception') as Poste);
  // Seuls les receveurs du mode jouent le service ; le passeur de ligne arrière peut être visé (le pointu passe).
  const candidates = formation.players.filter(
    (p) => p.onCourt && (receivingIds.includes(p.id) || (p.id === 'P' && !setterInFront)),
  );
  const zones = SERVE_ZONES.map((z) => ({ id: z.id, label: z.label, hint: z.hint, landing: z.landing }));
  if (!setterInFront) {
    const p = formation.players.find((q) => q.id === 'P')!;
    zones.push({ id: 'passeur', label: 'Sur le passeur', hint: 'il est en ligne arrière', landing: { x: p.x, y: p.y } });
  }
  const nodes: Node[] = [
    {
      title: `Réception à ${mode}`,
      text:
        `${rotationText(n, libero)} ` +
        `Réception à ${mode} : ${names(receivingIds)} reçoivent. ` +
        `${idle.length > 0 ? `${names(idle)} ne reçoi${idle.length > 1 ? 'vent' : 't'} pas : ` : ''}` +
        `${idle.length > 0 ? MODE_NOTE[mode] : MODE_NOTE[mode][0].toUpperCase() + MODE_NOTE[mode].slice(1)} ` +
        rule,
      scene: withPath(formation, [OPPONENT_SERVER]),
      question: 'Où le serveur adverse vise-t-il ?',
      options: zones.map((z) => ({ id: z.id, label: z.label, hint: z.hint })),
    },
  ];
  if (choices.length < 1) return nodes;

  const zone = zones.find((z) => z.id === choices[0]);
  if (!zone) throw new Error(`Zone invalide : ${choices[0]}`);
  const receivers = [...candidates].sort((a, b) => dist2(a, zone.landing) - dist2(b, zone.landing));
  const excluded = formation.players.filter((p) => !candidates.includes(p)).map((p) => p.id);
  const aimed = approachLanding(formation, zone.landing, excluded);
  nodes.push({
    title: `Service ${zone.label.toLowerCase()}`,
    text:
      `Le serveur adverse vise ${zone.hint}. La balle est attendue à la croix rouge. ` +
      `Le joueur le plus proche (${lab(n, receivers[0].id)}) démarre vers la balle.`,
    scene: withPath(aimed, [OPPONENT_SERVER, zone.landing]),
    question: 'Qui réceptionne ?',
    options: receivers.map((p, i) => ({
      id: p.id,
      label: `${lab(n, p.id)} réceptionne`,
      hint: `${p.id === 'P' ? 'le pointu fera la passe' : `poste ${posteOfPlayer(n, libero, p.id, 'reception')}`}${i === 0 ? ', le plus proche' : ''}`,
    })),
  });
  if (choices.length < 2) return nodes;

  const receiver = choices[1] as PlayerId;
  const setter = actingSetter(receiver);
  const attackers = frontAttackers(n, libero, setter);
  nodes.push({
    title: `${lab(n, receiver)} réceptionne`,
    text:
      `${lab(n, receiver)} court à la balle. ${setterText(n, receiver, setterInFront)} ${attackersText(n, attackers)}` +
      (n === 1 && setter === 'P'
        ? ` Rotation 1 en réception : le pointu (${lab(n, 'Pt')}) et le R4 (${lab(n, 'R4a')}) ne se croisent pas.`
        : ''),
    scene: withPath(secondContactScene(formation, receiver, setter, zone.landing, attackers), [zone.landing, SETTER_TARGET]),
    question: 'Où passer ? Choisis notre attaque.',
    options: targetOptions(n, libero, setter),
  });
  if (choices.length < 3) return nodes;

  nodes.push(attackNode(n, libero, choices[2] as AttackTarget, setter));
  return nodes;
}

/**
 * Construit l'arbre d'hypothèses jusqu'au coup atteint par `choices`.
 * Service : attaque adverse, joueur qui reprend, attaque. Réception : joueur visé, attaque.
 */
export function buildFlow(setup: FlowSetup, choices: string[]): Node[] {
  const nodes = setup.kind === 'service' ? serviceFlow(setup, choices) : receptionFlow(setup, choices);
  // Chaque choix doit figurer parmi les options du coup précédent.
  choices.forEach((c, i) => {
    if (!nodes[i]?.options.some((o) => o.id === c)) throw new Error(`Choix invalide à l'étape ${i + 1} : ${c}`);
  });
  return nodes;
}
