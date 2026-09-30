# Volley 5.1

Application web statique (TypeScript + Vite, rendu SVG, sans framework) qui anime les placements du
système 5.1 au volley. Livrable : un seul fichier `dist/index.html`. L'utilisateur est débutant en
front-end et joue en loisir compétition : garde le code simple et l'explication en français.

## Commandes

```bash
npm test           # Vitest, doit rester vert
npm run typecheck  # tsc --noEmit
npm run build      # typecheck puis dist/index.html (vite-plugin-singlefile)
npm run dev        # développement
```

La CI (`.github/workflows/ci.yml`) lance typecheck, tests et build. `dist/` n'est jamais commité : le fichier
`dist/index.html` est publié en release GitHub par `.github/workflows/release.yml` quand on pousse un tag `v*`.
`index.html` à la racine est la source (point d'entrée de Vite), pas le produit.
Le numéro de version vient de `package.json` (injecté au build en `__APP_VERSION__`, affiché dans le pied de page) ;
le tag `vX.Y.Z` doit lui être égal, sinon le workflow de release échoue. Procédure dans le README.

## Règles de jeu à respecter

Source : [règlement FIVB 2025-2028](https://www.fivb.com/wp-content/uploads/2025/01/FIVB-Volleyball_Rules2025_2028-EN.pdf)
(règle 7.4 positions, règle 12.5 écran). En cas de doute sur une règle, la vérifier dans ce texte et non de mémoire.

**Cahier des charges complet : [`docs/implementation.md`](docs/implementation.md)** (règles `RJ-xx` avec leur statut
Fait, À faire ou À valider, intentions de jeu, coordonnées). Le consulter avant toute modification de placement et le
tenir à jour quand une règle change.

- **Rotation** : sens 2→1→6→5→4→3→2. Rotation 1, du poste 1 au poste 6 : `P, R4a, Ca, Pt, R4b, Cb`.
  Opposés : P/Pt, R4a/R4b, Ca/Cb.
- **Étiquette** `poste-joueur` (`3-Ca`, `2-R4a`, `1-P`, `4-Pt`, `6-L`) : le numéro est le poste **au moment du service** (le serveur est toujours
  le 1), pas le poste d'origine. Il reste fixe pendant l'échange. Le libéro porte le poste du central qu'il remplace (`5-L`, `6-L`).
- **Ligne avant** = postes 2, 3, 4 (couleur claire). **Ligne arrière** = 5, 6, 1 (couleur foncée).
  Un joueur de ligne arrière n'attaque que depuis derrière la ligne des 3 m (pipe). Le libéro n'attaque jamais.
- **Service (règle 7.4)** : l'équipe au service est libre de se placer (placement par rôle, pas par poste).
  L'équipe en **réception** doit respecter l'ordre de rotation (`src/model/overlap.ts`). Il n'y a pas
  d'écart minimal de 1 m dans le règlement : ne pas le réintroduire comme règle.
- **Libéro** : remplace le central de ligne arrière, jamais le central de ligne avant. Il ne sert jamais et
  n'occupe jamais un poste de ligne avant. Il ne peut entrer ou sortir qu'entre deux échanges : quand **nous
  servons**, le central du poste 1 sert et reste en jeu tout l'échange (rotations 3 et 6 : pas de libéro, paramètre
  `ownServe`). Quand l'**adversaire sert**, le libéro remplace aussi le central du poste 1 (`1-L`). Aux postes 5 et 6,
  il remplace toujours. Chaque central joue donc 4 rotations sur 6 et le libéro 4 sur 6 quand nous servons.
- **Passe** : pendant la passe, les attaquants de ligne avant se placent déjà à leur zone (central au centre, R4 à
  gauche, pointu à droite, seulement deux si le passeur est en ligne avant).
- **Passeur** : il ne défend pas en ligne arrière, il est à la passe. Il ne réceptionne que s'il est en
  ligne arrière ; le pointu fait alors la passe. Après la passe, le passeur de ligne arrière retourne défendre.
- **Pointu** : il attaque en zone 2 (sauf rotation 1 en réception, où il reste en 4). Il ne réceptionne pas, sauf en
  renfort à 5 receveurs. En ligne arrière (rotations 4 à 6), c'est lui qui attaque le pipe.
- **Réception** : à 3 receveurs (les deux R4 et le central arrière ou le libéro, mode par défaut), à 4 (+ central
  avant), à 5 (+ pointu en renfort).

## Architecture

- `src/model/` : logique pure, sans DOM, entièrement testée. `formations.ts` contient toutes les
  coordonnées (mètres, repère : x 0 à 9 gauche-droite, y 0 = filet, y 9 = fond, y négatif = terrain adverse).
  `flow.ts` construit l'arbre d'hypothèses (`buildFlow(setup, choices)`).
- `src/view/court.ts` : rendu SVG, transitions CSS pour les joueurs, Web Animations pour la balle.
- `src/main.ts` : interface et état (`setup`, `choices`).

## Conventions

- Commentaires, textes affichés et messages en français.
- Toute règle ou tout placement ajouté vient avec un test dans `src/model/*.test.ts`.
- Les tests parcourent toutes les rotations, avec et sans libéro. Une correction de placement doit
  garder tous les tests verts, y compris l'écart d'affichage d'au moins 1 m entre ronds.
- Les coordonnées de défense, soutien et points de chute sont des conventions courantes, pas des règles :
  les ajuster à la demande de l'utilisateur.

## Commits

Toujours utiliser [Conventional Commits](https://www.conventionalcommits.org/fr/v1.0.0/) :

```text
type(portée optionnelle): description courte en français
```

- **Types** : `feat` (nouvelle fonctionnalité), `fix` (correction), `docs`, `style`, `refactor`, `perf`,
  `test`, `build`, `ci`, `chore`, `revert`.
- **Portées usuelles** : `model`, `view`, `flow`, `ci`, `readme`. Exemple : `fix(model): écarter les bloqueurs du point de passe`.
- Description à l'infinitif ou au présent, sans point final, 72 caractères au plus. Détails éventuels dans le corps du message.
- Changement incompatible : ajouter `!` après le type (`feat(model)!: ...`) et un pied `BREAKING CHANGE:`.
- Un commit = un changement cohérent, avec ses tests. Ne jamais commiter `dist/`.
- Ne pas réécrire l'historique déjà poussé : les deux premiers commits (`8666692`, `90f7121`) sont antérieurs à cette règle.
