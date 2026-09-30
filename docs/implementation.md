# Règles et intentions de jeu : cahier des charges de l'implémentation

Ce document définit **toutes les règles de jeu** et **toutes les intentions de jeu** que l'application doit modéliser
pour le volley en **système 5-1** (un passeur, un pointu, deux réceptionneurs-attaquants R4, deux centraux, un libéro
optionnel). Il sert de référence pour le code (`src/model/`) et pour les tests.

Chaque règle porte un identifiant (`RJ-xx`) et un **statut** :

| Statut | Sens |
| --- | --- |
| **Fait** | Implémenté et couvert par des tests |
| **À faire** | Décidé avec l'équipe, pas encore implémenté |
| **À valider** | Proposition à confirmer avant de coder |

## 1. Sources et ordre de priorité

En cas de conflit entre deux sources, la plus haute l'emporte.

1. **Règlement officiel FIVB 2025-2028** : [règles officielles](https://www.fivb.com/wp-content/uploads/2025/01/FIVB-Volleyball_Rules2025_2028-EN.pdf), règle 7.4 (positions), règle 12.5 (écran).
2. **Décisions de l'équipe** (joueurs loisir compétition) prises pendant la conception de l'application.
3. **Littérature 5-1** : [Le 5-1 : le positionnement, Paul Bert Volley 37](https://paul-bert-volley-37.fr/wp-content/uploads/2020/10/5-1-placement.pdf). Décrit les six rotations d'un vrai 5-1 (positions théoriques, service, réception, jeu). L'ordre des postes est identique à celui de l'application.
4. **Documents de travail du club** (6-2 pénétrant et 4-2, hors dépôt) : bases de défense « base 1 » et « base 2 », relance. Utiles pour la défense, pas pour l'ordre des rôles (ils décrivent deux passeurs).
5. **Conventions du modèle** : coordonnées, rayons d'action, points de chute. Ce sont des conventions, pas des règles : à ajuster avec l'équipe.

## 2. Vocabulaire et notation

| Terme | Sens |
| --- | --- |
| **P** | Passeur (un seul) |
| **Pt** | Pointu, opposé au passeur |
| **R4** (R4a, R4b) | Réceptionneur-attaquant ; appelé `AR` dans la littérature française |
| **C** (Ca, Cb) | Central |
| **L** | Libéro, optionnel |
| **Postes 1 à 6** | 1 arrière droit, 2 avant droit, 3 avant centre, 4 avant gauche, 5 arrière gauche, 6 arrière centre |
| **Ligne avant** | Postes 2, 3, 4 (couleur claire à l'écran) |
| **Ligne arrière** | Postes 5, 6, 1 (couleur foncée) |
| **Étiquette** `poste-joueur` | Le numéro est le **poste au moment du service** (fixe pendant l'échange). Le serveur est toujours le `1-…`. Les deux R4 et les deux centraux portent une lettre qui les identifie : `R4a`, `R4b`, `Ca`, `Cb` (`Ca` reste `Ca` quand la rotation change son poste : `3-Ca`, `2-Ca`, `1-Ca`). Le libéro porte le poste du central qu'il remplace (`6-L`). |

**Repère en mètres** (notre demi-terrain, 9 m x 9 m), filet en haut :

- `x` : 0 = ligne gauche (côté postes 4 et 5), 9 = ligne droite (côté postes 2 et 1).
- `y` : 0 = filet, 3 = ligne des 3 m, 9 = ligne de fond. `y` négatif = terrain adverse.
- Notre droite est la gauche de l'adversaire : son poste 4 fait face à notre poste 2.

## 3. Règles de jeu

### 3.1 Rotation

| Id | Règle | Statut |
| --- | --- | --- |
| RJ-01 | Sens de rotation : le joueur du poste 2 passe au 1, le 1 au 6, le 6 au 5, le 5 au 4, le 4 au 3, le 3 au 2. | **Fait** |
| RJ-02 | Rotation 1, du poste 1 au poste 6 : `P, R4a, Ca, Pt, R4b, Cb`. Opposés : P/Pt, R4a/R4b, Ca/Cb. | **Fait** |
| RJ-03 | Le serveur est le joueur du poste 1. Le numéro affiché est le poste au moment du service. | **Fait** |

Les six rotations (postes 4, 3, 2 devant, puis 5, 6, 1 derrière) :

| Rotation | Ligne avant (4, 3, 2) | Ligne arrière (5, 6, 1) | Sert | Passeur |
| --- | --- | --- | --- | --- |
| 1 | Pt, C, R4 | R4, C, **P** | P | arrière (1) |
| 2 | R4, Pt, C | C, **P**, R4 | R4 | arrière (6) |
| 3 | C, R4, Pt | **P**, R4, C | C | arrière (5) |
| 4 | **P**, C, R4 | R4, C, Pt | Pt | avant (4) |
| 5 | R4, **P**, C | C, Pt, R4 | R4 | avant (3) |
| 6 | C, R4, **P** | Pt, R4, C | C | avant (2) |

Cette table coïncide avec la littérature (passeur arrière en poste 1, 6, 5, puis avant en poste 4, 3, 2).

### 3.2 Lignes avant et arrière

| Id | Règle | Statut |
| --- | --- | --- |
| RJ-04 | Le statut avant ou arrière d'un joueur est fixé par son poste de rotation. | **Fait** |
| RJ-05 | Un joueur de ligne arrière ne contre pas et n'attaque qu'en s'élançant de derrière la ligne des 3 m. | **Fait** |
| RJ-06 | Le libéro n'attaque jamais et n'occupe jamais un poste de ligne avant. | **Fait** |

### 3.3 Positions au moment du service (règle FIVB 7.4)

| Id | Règle | Statut |
| --- | --- | --- |
| RJ-07 | Les positions sont contrôlées **au moment où le serveur frappe le ballon**, pas au coup de sifflet de l'arbitre, d'après le dernier contact des pieds avec le sol. Après la frappe, tous sont libres. | **Fait** (modélisé) |
| RJ-08 | **L'équipe au service est libre** de se placer : chacun prend sa zone de jeu par rôle (R4 à gauche, central au centre, pointu et passeur à droite), quel que soit son poste. Seul le serveur est hors du terrain, derrière la ligne de fond. Pas d'écart minimal imposé. | **Fait** |
| RJ-09 | **L'équipe en réception respecte l'ordre de rotation** : chaque joueur arrière est derrière son vis-à-vis avant (5 derrière 4, 6 derrière 3, 1 derrière 2) et, dans chaque ligne, l'ordre latéral 4 < 3 < 2 et 5 < 6 < 1. | **Fait** (`overlap.ts`) |
| RJ-10 | L'équipe au service ne doit pas cacher le service (règle 12.5) : pas de regroupement ni de mouvement qui masque la frappe et la trajectoire. | Information, non modélisé |

Placement de l'équipe au service (RJ-08), selon le rôle et la ligne :

| Rôle | Ligne avant | Ligne arrière |
| --- | --- | --- |
| R4 | (1,5 ; 1) | (1,5 ; 6) |
| Central, libéro | (4,5 ; 1) | (4,5 ; 7) |
| Passeur, pointu | (7,5 ; 1) | (7,5 ; 6,5) |
| Serveur | | (7,5 ; 10,2), derrière la ligne de fond |

### 3.4 Libéro

| Id | Règle | Statut |
| --- | --- | --- |
| RJ-11 | Le libéro remplace le central de ligne arrière, jamais celui de ligne avant. | **Fait** |
| RJ-12 | Le libéro ne sert jamais et ne joue jamais à un poste de ligne avant. | **Fait** |
| RJ-13 | Un libéro n'entre et ne sort qu'**entre deux échanges**. Quand **nous servons**, le central du poste 1 sert et reste en jeu tout l'échange (rotations 3 et 6 : pas de libéro). | **Fait** (`ownServe`) |
| RJ-14 | Quand **l'adversaire sert**, le libéro remplace aussi le central du poste 1 (`1-L`) et peut réceptionner. Aux postes 5 et 6, il remplace toujours. | **Fait** |
| RJ-15 | Cycle d'un central : 4, 3, 2 (ligne avant), 1 (il sert), 6 (le libéro entre), 5 (le libéro), puis 4. Chaque central joue 4 rotations sur 6, le libéro 4 sur 6 quand nous servons. | **Fait** |

### 3.5 Passeur

| Id | Règle | Statut |
| --- | --- | --- |
| RJ-16 | **Ligne arrière** : il ne réceptionne pas, il ne défend pas, il se tient à droite prêt à monter. Il pénètre au filet pour la passe. | **Fait** |
| RJ-17 | Après la passe, le passeur de ligne arrière « retourne défendre en 1 » (littérature) : à l'étape d'attaque il quitte le filet pour le premier emplacement libre du fond, en commençant par (7,6 ; 6,6). De ligne avant, il reste au filet. | **Fait** |
| RJ-18 | **Ligne avant** : il est au filet, il ne réceptionne pas et passe depuis le filet. Il n'y a alors que deux attaquants devant. | **Fait** |
| RJ-19 | Si le passeur joue la balle (service sur lui, en ligne arrière), le **pointu** fait la passe. | **Fait** |
| RJ-20 | Le point de passe est (6,6 ; 0,9) : côté droit du filet, entre les postes 2 et 3. | **Fait** |

### 3.6 Pointu

| Id | Règle | Statut |
| --- | --- | --- |
| RJ-21 | Le pointu **ne réceptionne pas** : il ne le fait qu'en renfort quand la réception n'est pas assez solide. Il n'a pas de « miroir » comme les deux R4. | **Fait** |
| RJ-22 | Il attaque en **zone 2** (droite). Exception de la rotation 1 en **réception** : il reste en poste 4 (gauche) et le R4 reste en 2 (droite), sans croisement. Après **notre** service en rotation 1, ils échangent (le pointu va en 2). L'exception ne vaut pas si le pointu fait la passe. | **Fait** |
| RJ-23 | Quand il est en **ligne arrière** (rotations 4, 5, 6), il attaque depuis derrière la ligne des 3 m (pipe) et défend en 1. Dans les rotations 1 à 3, le pipe revient au R4 de ligne arrière. **Simplification** : le pointu frappe le pipe au centre (4,5 ; 4,6) ; la littérature le place plutôt à droite, derrière les 3 m (voir section 7). | **Fait** (simplifié) |

### 3.7 Réception : qui reçoit

Décision de l'équipe : trois modes, le pointu ne rejoignant la réception qu'en dernier renfort.

| Mode | Receveurs | Statut |
| --- | --- | --- |
| **À 3** (référence, mode par défaut) | R4, R4 et central de ligne arrière (ou libéro) | **Fait** |
| **À 4** | + le central de ligne avant | **Fait** |
| **À 5** | + le pointu, en renfort | **Fait** |

Ne reçoit jamais : le passeur (en ligne avant il est au filet ; en ligne arrière il n'est proposé que si le service vise
sa place, RJ-19). Le pointu ne reçoit qu'à 5. Ceux qui ne reçoivent pas se placent au filet s'ils sont en ligne avant
(emplacements candidats : (4,3 ; 1,1), (3 ; 1), (5,6 ; 1), (2 ; 1), (1 ; 1), (7,2 ; 1)) ou, pour le pointu de ligne
arrière, derrière les receveurs ((7,8 ; 7,6), (1,2 ; 7,6), (4,5 ; 8,2), (6,3 ; 8), (2,7 ; 8)).

Méthode de placement (RJ-09) : parmi tous les placements possibles respectant l'ordre de rotation et un écart d'affichage
d'au moins 1 m, on retient le plus proche des postes nominaux. Positions candidates des receveurs :

- En W à 5 : (1,2 ; 3,2), (2,9 ; 6,6), (4,5 ; 3,8), (6,1 ; 6,6), (7,8 ; 3,2).
- En arc à 4 : (1,5 ; 3,5), (3,2 ; 6,6), (5,8 ; 6,6), (7,5 ; 3,5), plus (3 ; 3,4), (4,5 ; 3,6), (6 ; 3,4).
- À 3 : les emplacements de l'arc à 4, plus (1,4 ; 4,4), (7,6 ; 4,4), (4,5 ; 6,8).
- Passeur en ligne avant : au filet, (6,8 ; 1) en priorité. En ligne arrière : derrière son vis-à-vis, par exemple (8,3 ; 4,6).

### 3.8 Attaque et soutien

| Id | Règle | Statut |
| --- | --- | --- |
| RJ-24 | Zones d'attaque de ligne avant : R4 en 4, central en 3, pointu en 2 (préférence par rôle), sauf l'exception RJ-22. Avec le passeur devant, deux zones seulement. | **Fait** |
| RJ-25 | Positions d'attaque : zone 4 (1,3 ; 2,2), zone 3 (4,3 ; 2), zone 2 (7,8 ; 2,2), pipe (4,5 ; 4,6). | **Fait** |
| RJ-26 | **Pendant la passe**, les attaquants de ligne avant se placent déjà à leur zone : le central au centre, le R4 à gauche, le pointu à droite. Le choix de la passe ne déplace ensuite que le soutien et l'attaquant qui s'élance. | **Fait** |
| RJ-27 | Soutien : les joueurs qui ne sont ni au filet ni à l'attaque forment un demi-cercle derrière l'attaquant, à 4,4 m et 5,8 m du filet. Pipe : (2,6 ; 5,8), (6,4 ; 5,8), (4,5 ; 7,2). | **Fait** |
| RJ-28 | Le pipe est frappé par un joueur de ligne arrière, jamais le libéro ni le passeur : le pointu en priorité, puis un R4, puis un central. | **Fait** |

### 3.9 Défense

| Id | Règle | Statut |
| --- | --- | --- |
| RJ-29 | Défense « en rotation » : les joueurs de ligne avant bloquent ou reculent sur la ligne des 3 m, ceux de ligne arrière défendent au fond. | **Fait** |
| RJ-30 | **Bloc selon l'attaque adverse** : à deux joueurs contre une attaque en 4 (postes 2 et 3) ou en 2 (postes 4 et 3), à un joueur (poste 3) contre une attaque au centre ou un pipe. | **Fait** |
| RJ-31 | Quand le passeur est en ligne arrière, les deux autres défenseurs arrière **décalent** pour couvrir tout le fond du terrain. | **Fait** |
| RJ-32 | Au service (équipe libre), la défense de départ correspond à la « base 1 » des documents du club : R, C, P au filet, C et P à mi-terrain, R au fond. | **À valider** (l'application place aujourd'hui par rôle, sans reproduire exactement la base 1) |

Positions de défense par poste (x ; y) :

| Attaque adverse | Poste 2 | Poste 3 | Poste 4 | Poste 1 | Poste 6 | Poste 5 |
| --- | --- | --- | --- | --- | --- | --- |
| En 4 (vers notre droite) | (7,2 ; 1) | (5,6 ; 1) | (3,6 ; 3) | (8 ; 5,5) | (6 ; 7,5) | (2 ; 6) |
| En 2 (vers notre gauche) | (5,4 ; 3) | (3,4 ; 1) | (1,8 ; 1) | (7 ; 6) | (3 ; 7,5) | (1 ; 5,5) |
| Au centre | (7 ; 3) | (4,5 ; 1) | (2 ; 3) | (7 ; 6,5) | (4,5 ; 7,5) | (2 ; 6,5) |
| Pipe | (6,5 ; 3) | (4,5 ; 1) | (2,5 ; 3) | (6,5 ; 5) | (4,5 ; 6) | (2,5 ; 5) |

Passeur de ligne arrière en défense : il attend en (7,9 ; 4). Les deux autres défenseurs arrière prennent les points
suivants (le plus proche de leur place habituelle) : en 4 (7,2 ; 5,8) et (3,4 ; 6,8) ; en 2 (1,8 ; 5,8) et (5,6 ; 6,8) ; au
centre (3,2 ; 6,5) et (5,8 ; 6,5) ; pipe (3 ; 5) et (6 ; 5).

### 3.10 Contre

| Id | Règle | Statut |
| --- | --- | --- |
| RJ-33 | Les joueurs au filet (y au plus 1,5 m) contrent. Le contre est un choix de ceux qui sont au bloc. | **Fait** |
| RJ-34 | **Contre gagnant** : la balle revient chez l'adversaire, point pour nous, fin de l'échange. | **Fait** |
| RJ-35 | **Contre amorti** : la balle retombe chez nous près de la ligne des 3 m (à 3,4 m du filet, à l'abscisse moyenne des bloqueurs) et peut être relevée par tout joueur sauf le passeur. | **Fait** |

## 4. Intentions de jeu (arbre d'hypothèses)

L'application déroule un échange comme un jeu d'échecs : à chaque coup, elle propose les hypothèses possibles et
l'utilisateur en choisit une. Le joueur choisi se déplace, la balle suit sa trajectoire. On peut revenir à tout coup.

### 4.1 Nous servons

1. **Service** : placement de l'équipe (RJ-08), balle du serveur vers le terrain adverse.
2. **Attaque adverse** : en 4, en 3, en 2 ou pipe.
3. **Intention de l'attaquant adverse** (et point de chute dans notre terrain) :

| Attaque | Intention | Point de chute (x ; y) |
| --- | --- | --- |
| En 4 | Ligne (côté droit) | (8,3 ; 6,8) |
| En 4 | Grande diagonale (fond gauche) | (0,9 ; 7,6) |
| En 4 | Petite diagonale (angle court, milieu) | (3,8 ; 4,6) |
| En 4 | Bidouille (derrière le bloc) | (6,4 ; 2,4) |
| En 2 | Ligne, grande diagonale, petite diagonale, bidouille | symétrique de l'attaque en 4 (x devient 9 - x) |
| En 3 | Angle gauche | (1,5 ; 7) |
| En 3 | Milieu | (4,5 ; 7,5) |
| En 3 | Angle droit | (7,5 ; 7) |
| En 3 | Bidouille | (4,5 ; 2,4) |
| Pipe | Diagonale gauche | (2 ; 6,5) |
| Pipe | Milieu | (4,5 ; 7) |
| Pipe | Diagonale droite | (7 ; 6,5) |
| Pipe | Courte | (4,5 ; 4) |

   Le défenseur le plus proche du point de chute démarre à mi-chemin vers la balle.

4. **Qui joue la balle** : *Contre* (joueurs au filet) ou *reprise* par un joueur, classés du plus proche au plus éloigné. Le passeur n'est jamais proposé : il est à la passe. Le libéro n'est jamais proposé au poste 1 quand nous servons (RJ-13).
5. **Contre** : gagnant (fin) ou amorti. Après un amorti, *qui relève la balle*.
6. **Reprise** : le joueur court au point de chute, le passeur monte au point de passe (RJ-20), les attaquants de ligne avant se placent (RJ-26).
7. **Passe** : en 4, 3, 2 ou pipe, parmi les zones réellement attaquables (RJ-24 et RJ-28).
8. **Attaque** : attaquant, soutien et angles d'attaque (4.3).

### 4.2 Nous réceptionnons

1. **Réception** à 3, 4 ou 5 receveurs (3.7), dans l'ordre de rotation (RJ-09). La balle part du serveur adverse.
2. **Où le serveur adverse vise-t-il ?**

| Zone visée | Point de chute (x ; y) |
| --- | --- |
| Zone 1 (fond, côté droit) | (7,5 ; 7,2) |
| Zone 6 (fond, au centre) | (4,5 ; 7,5) |
| Zone 5 (fond, côté gauche) | (1,5 ; 7,2) |
| Zone 2 (court, côté droit) | (7,5 ; 2,6) |
| Zone 3 (court, au centre) | (4,5 ; 2,6) |
| Zone 4 (court, côté gauche) | (1,5 ; 2,6) |
| Sur le passeur (s'il est en ligne arrière) | sa propre place |

3. **Qui réceptionne** : les receveurs du mode choisi, classés du plus proche au plus éloigné. Un passeur en ligne avant n'est jamais proposé.
4. **Passe** : le passeur monte au point de passe (le pointu si le passeur a réceptionné) et les attaquants se placent.
5. **Attaque** : comme en 4.1.

### 4.3 Angles d'attaque

Depuis le point de frappe (au filet pour les zones 2, 3, 4 ; à 3,2 m pour le pipe) :

| Attaque | Angles proposés |
| --- | --- |
| En 4 | Ligne (0,6 ; -9), diagonale (8,4 ; -9), diagonale courte (5,5 ; -3,2), feinte (2,8 ; -2,2) |
| En 2 | Symétrique de l'attaque en 4 |
| En 3 | Angle gauche (1 ; -9), centre (4,5 ; -9), angle droit (8 ; -9), feinte (4,5 ; -2) |
| Pipe | Diagonale gauche (1 ; -9), centre (4,5 ; -9), diagonale droite (8 ; -9), courte (4,5 ; -3,5) |

## 5. Ce que la littérature 5-1 ajoute (à implémenter)

Extraits de [Paul Bert Volley 37](https://paul-bert-volley-37.fr/wp-content/uploads/2020/10/5-1-placement.pdf) :

| Rotation (passeur) | Réception | Service |
| --- | --- | --- |
| 1 (poste 1) | Réception à 3 : AR* protège P, qui ne réceptionne pas ; C* prend les balles très courtes. AR* reste en 2 et Pt en 4. | Après le service, L et AR échangent leur position, ainsi que Pt et AR*. |
| 2 (poste 6) | P ne réceptionne pas et C* prend les balles très courtes. AR en 4 et Pt en 2, après la réception. | Au service, P se place directement à 3 m. Après le service Pt va en 2. Pas de faute entre AR* et P, car AR* sert. |
| 3 (poste 5) | Le passeur ne réceptionne pas. | P se déplace après le service. C et AR échangent leur position. |
| 4 (poste 4) | Pt ne réceptionne pas. Pour que AR puisse réceptionner, P et C se placent au plus près du bord gauche. | P et AR échangent leur position. L se déplace après le service. |
| 5 (poste 3) | Pt ne réceptionne pas. Pt et C se déplacent après le service. | P et C échangent leur position. Pt se déplace après le service. |
| 6 (poste 2) | Pt ne réceptionne pas. Pt, C et L se déplacent après le service. | AR* et C* échangent leur position. Pt se déplace après le service. |

Pour la ligne arrière : « P pénètre pour la passe et retourne défendre en 1. L est en poste 5 » (rotations 1 et 3), et
« Pt attaque à 3 m et défend en 1 » (rotations 4 à 6).

## 6. Suivi de l'implémentation

| À faire | Règle | Fichiers concernés |
| --- | --- | --- |
| Défense de départ au service alignée sur la « base 1 » | RJ-32 | `formations.ts`, à valider |

Faits récemment : modes de réception à 3, 4 et 5 (RJ-21), zones d'attaque de la rotation 1 en réception (RJ-22), pipe du
pointu en ligne arrière (RJ-23), retour du passeur en défense après la passe (RJ-17).

Les tests qui verrouillent les règles déjà implémentées : `src/model/rotation.test.ts` (RJ-01 à RJ-06),
`src/model/libero.test.ts` (RJ-11 à RJ-15), `src/model/formations.test.ts` (RJ-08, RJ-09, RJ-16 à RJ-18,
RJ-24 à RJ-31), `src/model/flow.test.ts` (intentions, arbre d'hypothèses, RJ-19, RJ-26, RJ-33 à RJ-35).

## 7. Points à valider avec l'équipe

1. **Rotation 1 en réception** : le pointu est à gauche et le R4 à droite, d'après la littérature. Cela contredit la règle « le pointu est toujours à droite » : à confirmer que l'exception est bien voulue.
2. **Service** : le placement libre par rôle (RJ-08) place le passeur et le pointu à droite. La littérature place parfois le passeur directement à 3 m (rotation 2) : à valider.
3. **Défense de départ** : reproduire exactement la « base 1 » des documents du club (RJ-32) ou garder le placement par rôle.
4. **Coordonnées** : défense, soutien, points de chute et zones de service sont des conventions à ajuster.
5. **Attaques arrière par zone** (choix de stratégie de l'équipe, non traité) : tout joueur de ligne arrière peut attaquer depuis les postes 1, 5 ou 6 en s'élançant de derrière les 3 m. Le mot « pipe » désigne strictement l'attaque du poste 6 (centre). La littérature 5-1 dit « Pt attaque à 3 m » et place le pointu à droite (poste 1), alors que l'application n'a qu'une cible « pipe » au centre. Options envisagées : ajouter « arrière en 1 » pour le pointu, et éventuellement « arrière en 5 », en gardant le pipe central pour les R4. À décider avec l'équipe avant de coder.
