# SonarQube – configuration, Quality Gate et résultats

## 1. Paramètres d'analyse

Fichier : [`/backend/sonar-project.properties`](../../backend/sonar-project.properties)

```properties
sonar.projectKey=souverainrecrut-backend
sonar.projectName=SouverainRecrut Backend
sonar.projectVersion=1.0.0
sonar.sourceEncoding=UTF-8
sonar.sources=src
sonar.tests=tests
sonar.test.inclusions=tests/**/*.test.ts
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.coverage.exclusions=src/server.ts,src/docs/**,src/swagger/**
sonar.cpd.exclusions=src/docs/**
```

- Aucun token ni URL dans le fichier : fournis par l'environnement (`withSonarQubeEnv` dans Jenkins).
- Exclusions de couverture identiques à `jest.config.js` : démarrage du serveur et documentation
  Swagger, sans logique métier.
- Duplication : les fichiers de documentation OpenAPI (`src/docs/`) sont répétitifs par nature.

## 2. Quality Gate « SouverainRecrut »

Créé à partir des conditions *Clean as You Code* proposées par SonarQube, puis complété par des
conditions sur **l'ensemble du code** (seuils du cours : couverture ≥ 80 %, duplications < 3 %,
aucune vulnérabilité). Associé au seul projet `souverainrecrut-backend` (pas « Set as Default »).

**Conditions sur le code neuf**

| Métrique | Échec si |
|---|---|
| Coverage | < 80 % |
| Duplicated Lines (%) | > 3 % |
| Maintainability Rating | pire que A |
| Reliability Rating | pire que A |
| Security Hotspots Reviewed | < 100 % |
| Security Rating | pire que A |

**Conditions sur l'ensemble du code**

| Métrique | Échec si |
|---|---|
| Coverage | < 80 % |
| Duplicated Lines (%) | > 3 % |
| Reliability Rating | pire que A |
| Security Hotspots Reviewed | < 100 % |
| Security Rating | pire que A |

**Pourquoi des conditions « Overall Code »** : les conditions sur le code neuf ne détectent pas la
dégradation de l'existant (par exemple la suppression de tests sur du code ancien). SonarQube affiche
alors *« You added extra conditions to the Clean as You Code quality gate »* : c'est voulu.

Point de vigilance rencontré : la métrique `Condition Coverage` (couverture des branches seule,
≈ 68 %) avait été choisie par erreur à la place de `Coverage` (lignes + branches, 94,4 %). Elle
aurait fait échouer le gate ; corrigée avant l'analyse.

Captures : [`05`](../../documentation/captures/05-quality-gate-conditions-new-code.png),
[`06`](../../documentation/captures/06-quality-gate-conditions-overall-code.png).

## 3. Résultats

| Indicateur | 1re analyse (gate « Sonar way ») | Analyse finale (gate « SouverainRecrut ») |
|---|---|---|
| Quality Gate | Passed | **Passed** |
| Bugs | 0 (A) | 0 (A) |
| Vulnérabilités | 0 (A) | 0 (A) |
| Security Hotspots | 1 non examiné (**E**) | **0 (A)** |
| Code Smells | 6 (dette 1 h 30, A) | 6 (dette 1 h 30, A) |
| Couverture | 94,4 % sur 503 lignes | 94,4 % |
| Duplications | 0,0 % sur 2,7 k lignes | 0,0 % |

La couverture SonarQube (94,4 %) est inférieure aux 100 % de lignes affichés par Jest car SonarQube
combine lignes **et** conditions (branches à 68 %).

Captures : [`01`](../../documentation/captures/01-sonarqube-1re-analyse-hotspot-E.png),
[`02`](../../documentation/captures/02-sonarqube-1re-analyse-couverture-duplications.png),
[`04`](../../documentation/captures/04-sonarqube-apres-correction-hotspot.png),
[`07`](../../documentation/captures/07-sonarqube-analyse-finale-passed.png).

## 4. Security Hotspot traité

| | |
|---|---|
| Règle | S5689 – *Make sure disclosing the fingerprinting of this web technology is safe here* (priorité LOW) |
| Emplacement | `const app = express();` – `backend/src/app.ts` |
| Risque | Express envoie `X-Powered-By: Express` : révèle la technologie et aide à cibler des failles connues |
| Décision | **Corriger** plutôt que marquer « Safe » |
| Correction | `app.disable("x-powered-by");` |
| Non-régression | Test *« ne révèle pas la technologie du serveur »* dans `backend/tests/health.test.ts` |

Capture : [`03`](../../documentation/captures/03-sonarqube-security-hotspot-x-powered-by.png).

## 5. Warnings d'analyse (sans impact)

| Warning | Explication |
|---|---|
| `SCM provider autodetection failed` | Analyse manuelle : seul `backend/` était monté dans le conteneur du scanner, sans le `.git` de la racine. Dans Jenkins, le dépôt complet est présent. |
| `Node.js version 22 is not recommended` | SonarQube 9.9 a été validé avec Node 16/18 ; l'analyse fonctionne normalement. |

## 6. Pistes d'amélioration (non bloquantes)
- Traiter les 6 code smells (maintenabilité déjà notée A).
- Ajouter un rapport d'exécution des tests au format SonarQube pour afficher le nombre de tests.
- Migrer vers une version active de SonarQube (bandeau « version no longer active » sur la 9.9).
