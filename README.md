# Volley 5.1, placements animés

[![CI](https://github.com/petitlouis/volley-51/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/petitlouis/volley-51/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/petitlouis/volley-51?display_name=tag&sort=semver)](https://github.com/petitlouis/volley-51/releases/latest)
[![Licence MIT](https://img.shields.io/github/license/petitlouis/volley-51)](LICENSE)
![Node.js 22+](https://img.shields.io/badge/node-%E2%89%A522-339933)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)

![Démonstration : attaque adverse en 4 le long de la ligne, le libéro couvre le passeur et reprend, passe au passeur, attaque du R4 en 4](docs/demo.gif)

**[Tester en ligne](https://petitlouis.github.io/volley-51/)** ou
**[télécharger la dernière release](https://github.com/petitlouis/volley-51/releases/latest)**.

Application web pour comprendre le système 5.1 (un seul passeur) au volley, avec option libéro :
rotations, service, réception, défense et attaque. On avance coup par coup en choisissant des
hypothèses, comme aux échecs, et on voit les joueurs se déplacer.

Conçue pour Firefox, Chrome et Safari (testée jusqu'ici dans Chromium), sans serveur et sans connexion :
le résultat est un seul fichier HTML.

## Utilisation

Ouvre `dist/index.html` dans un navigateur (voir « Construire » pour le produire).

1. Choisis le départ : **Nous servons** ou **Nous réceptionnons**, la rotation (1 à 6) et le libéro.
2. À chaque coup, l'application propose des hypothèses. Clique sur l'une d'elles.
3. **Changer d'hypothèse** (ou la touche Retour arrière) revient au coup précédent. La liste
   « Coups joués » permet de revenir à n'importe quel coup.

### Nous servons

Service (placement libre, règle FIVB 7.4), attaque adverse (4, 3, 2 ou pipe), intention de l'attaquant
(ligne, grande diagonale, petite diagonale, bidouille), qui joue la balle (contre ou reprise, avec
contre gagnant ou amorti), passe du passeur, attaque avec soutien et angles d'attaque.

### Nous réceptionnons

Réception à 4 ou à 5 dans l'ordre de rotation obligatoire, zone visée par le serveur adverse,
receveur, passe (le pointu passe si le passeur a réceptionné), attaque avec soutien et angles.

### Lire le terrain

- Le numéro d'un rond est le **poste au moment du service** ; le 1 est toujours le serveur.
  Le joueur suit : `P` passeur, `R4a` et `R4b` les deux réceptionneurs-attaquants, `Ca` et `Cb` les deux centraux,
  `Pt` pointu, `L` libéro (numéroté comme le central qu'il remplace, par exemple `6-L`). Les lettres `a` et `b`
  identifient chaque joueur : `Ca` reste `Ca` quand la rotation change son poste (`3-Ca`, puis `2-Ca`, puis `1-Ca`).
- **Couleur claire** : ligne avant. **Couleur foncée** : ligne arrière.
- Un joueur de ligne arrière n'attaque que depuis derrière la ligne des 3 m. Le libéro n'attaque jamais.
- Cercle hachuré : rayon d'action théorique. Croix rouge : point de chute attendu. Balle blanche : sa trajectoire.

## Règles à respecter

Les règles de position viennent du règlement officiel :
[FIVB, règles officielles du volleyball 2025-2028](https://www.fivb.com/wp-content/uploads/2025/01/FIVB-Volleyball_Rules2025_2028-EN.pdf)
(page de référence : [fivb.com, Official Volleyball Rules](https://www.fivb.com/volleyball/the-game/official-volleyball-rules/)).

- **7.4 Positions** : l'équipe au service est libre de se placer ; l'équipe en réception doit être dans l'ordre de rotation au moment de la frappe.
- **12.5 Écran** : l'équipe au service ne doit pas cacher la frappe et la trajectoire du service.

Toute modification de placement doit rester conforme à ces règles.

## Développement

Prérequis : Node.js 22 ou plus récent.

```bash
npm install        # installer les dépendances
npm run dev        # serveur de développement
npm test           # tests unitaires (Vitest)
npm run typecheck  # vérification des types
npm run build      # produit dist/index.html
```

### Publier une release

`dist/index.html` n'est pas versionné : c'est le fichier de la release GitHub. Le numéro de version vient de
`package.json` et s'affiche dans le pied de page de l'application. Pour publier, par exemple, la version 0.2.0 :

```bash
npm version 0.2.0 --no-git-tag-version   # met à jour package.json et package-lock.json
git add package.json package-lock.json
git commit -m "chore(release): v0.2.0"
git tag v0.2.0
git push && git push origin v0.2.0
```

Le workflow `.github/workflows/release.yml` refuse la release si le tag ne correspond pas à `package.json`.
Il vérifie ensuite les types, lance les tests, construit, puis crée la release avec le fichier
`volley-51-v0.2.0.html`.

L'intégration continue (`.github/workflows/ci.yml`) exécute les types, les tests et le build à chaque
push sur `main` et à chaque pull request, et publie `dist/index.html` en artefact.

### Structure

| Chemin | Contenu |
| --- | --- |
| `src/model/rotation.ts` | Ordre de rotation et postes |
| `src/model/roles.ts` | Rôles, étiquettes, couleurs clair/foncé |
| `src/model/libero.ts` | Remplacement du central par le libéro |
| `src/model/overlap.ts` | Ordre de rotation obligatoire en réception (règle 7.4) |
| `src/model/formations.ts` | Coordonnées de tous les placements (service, réception, défense, attaque) |
| `src/model/flow.ts` | Arbre d'hypothèses : coups, choix, trajectoire de la balle |
| `src/view/court.ts` | Rendu SVG du terrain et animations |
| `src/main.ts` | Interface |

Le modèle (`src/model`) ne dépend pas du navigateur et est entièrement couvert par des tests.
Pour corriger un placement, modifie les coordonnées dans `src/model/formations.ts`.

## Limites

Les placements de défense, de soutien et les points de chute sont des conventions courantes, pas des
règles du jeu : à ajuster selon ton équipe. Seules les règles de position au service et en réception
(FIVB 7.4) sont des règles officielles.

## Licence

MIT, voir [`LICENSE`](LICENSE) et [`LICENCES.md`](LICENCES.md).
