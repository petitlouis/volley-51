# Licences

## Ce projet

Volley 5.1 est publié sous licence **MIT**. Le texte complet est dans le fichier [`LICENSE`](LICENSE).
Copyright (c) 2026 Jean-Louis PETITLAURENT.

## Dépendances

Toutes les dépendances sont des outils de développement. Le fichier `dist/index.html` produit par le build
ne contient aucune bibliothèque tierce : le code de l'application est le seul code embarqué.

| Paquet | Rôle | Licence |
| --- | --- | --- |
| [Vite](https://vite.dev) | Serveur de développement et build | MIT |
| [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile) | Regroupe le build en un seul fichier HTML | MIT |
| [TypeScript](https://www.typescriptlang.org) | Langage typé et vérification des types | Apache-2.0 |
| [Vitest](https://vitest.dev) | Tests unitaires | MIT |

Les dépendances indirectes sont listées dans `package-lock.json`. Pour afficher leurs licences :

```bash
npx license-checker --summary
```

## Règles du volley

Les règles de jeu citées dans l'application (positions au service, ordre de rotation en réception, écran)
viennent des [règles officielles FIVB 2025-2028](https://www.fivb.com/wp-content/uploads/2025/01/FIVB-Volleyball_Rules2025_2028-EN.pdf),
règle 7.4 et règle 12.5. Le règlement n'est pas reproduit dans ce dépôt, seulement référencé.
