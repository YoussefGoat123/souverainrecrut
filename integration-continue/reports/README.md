# Rapports de l'intégration continue

Rapports produits par la chaîne CI, exportés le 09/11/2026 (commit `2d7e00c`).
Aucun secret : les logs Jenkins ont été vérifiés (token Docker Hub masqué par Jenkins).

| Dossier | Contenu | Résumé |
|---|---|---|
| [`tests/`](tests/) | `resultat-tests.txt` (sortie Jest), `junit.xml` (format JUnit lu par Jenkins) | **65 / 65** tests réussis, 9 suites |
| [`couverture/`](couverture/) | `html/index.html` (rapport navigable), `lcov.info` (lu par SonarQube), `coverage-summary.json` | Lignes 100 %, fonctions 100 %, branches 68,11 % |
| [`trivy/`](trivy/) | `trivy-report-1.0.0-2d7e00c.txt` (archivé par le build #2) | `Total: 2 (HIGH: 2, CRITICAL: 0)` |
| [`jenkins/`](jenkins/) | `build-1-console.txt` (échec), `build-2-console.txt` (succès) | Build #1 arrêté avant publication ; build #2 vert, image publiée |
| SonarQube | voir [`../sonar/README.md`](../sonar/README.md) et les captures 01–07 | Quality Gate **Passed** |

## Détail des tests

| Fichier | Tests | Domaine |
|---|---|---|
| `health.test.ts` | 7 | Accueil, info, health, readiness (base OK / KO), 404, absence de `X-Powered-By` |
| `auth.test.ts` | 7 | Connexion, JWT, mot de passe jamais renvoyé, erreurs 401 identiques, profil |
| `access-control.test.ts` | 11 | 401 (sans token, mauvais schéma, token falsifié, expiré), 403 par rôle |
| `candidates.test.ts` | 9 | CRUD, pagination, 404, doublon 409, validation 400 |
| `jobs.test.ts` | 9 | CRUD, pagination, 404, validation 400 |
| `applications.test.ts` | 9 | CRUD, relations, statut invalide 400, `updateStatus` |
| `users.test.ts` | 7 | Création avec hachage bcrypt, doublon 409, validation, CRUD |
| `dashboard.test.ts` | 1 | Statistiques |
| `errors-and-utils.test.ts` | 5 | Erreur 500 sans fuite d'information, pagination |

Les tests utilisent un **faux client Prisma** (`jest.mock`) : ils s'exécutent sans PostgreSQL,
en local comme dans Jenkins.

## Trivy : vulnérabilités restantes (risque accepté)

| Sévérité | Paquet | Version | Correctif | Origine |
|---|---|---|---|---|
| HIGH | `deepmerge-ts` | 7.1.5 | 8.0.0 | dépendance interne de `@prisma/config` 6.16.2 |
| HIGH | `effect` | 3.16.12 | 3.20.0 | dépendance interne de `@prisma/config` 6.16.2 |

Versions imposées par Prisma : la correction passe par une montée de version de Prisma (à planifier).
Ces vulnérabilités ne bloquent pas la publication (seuil bloquant = CRITICAL corrigeable).

Évolution : l'image initiale comptait **1 CRITICAL + 26 HIGH** (`proxy-addr` 2.0.7, `fast-uri`,
`body-parser`, `js-yaml`, npm embarqué…). Corrigé par mise à jour des dépendances transitives
(`npm update`) et suppression de npm de l'image finale.
