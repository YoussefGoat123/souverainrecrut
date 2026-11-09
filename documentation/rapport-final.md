# Rapport final – Projet fil rouge CI/CD SouverainRecrut

**Mastère Expert en Développement et Déploiement de Solutions Numériques Sécurisées – RNCP 40166**
Module CI/CD – Sup de Vinci Rennes – Formateur : Alimou Diallo

> **Version de travail.** Partie 1 (intégration continue) rédigée. Partie 2 (provisionnement,
> déploiement, rollback) à compléter : sections marquées *[à venir]*.

---

## 1. Contexte et objectifs

SouverainRecrut est une application de gestion de recrutement. Le projet consiste à industrialiser
le cycle de vie de son **API Backend** (Node.js 22, Express, TypeScript, Prisma, PostgreSQL), le
Frontend étant hors périmètre.

Objectif : construire une chaîne de livraison **automatisée, reproductible, sécurisée, traçable et
documentée**, depuis un commit jusqu'à une API déployée :

1. **Intégration continue** – le code est testé et analysé, une image Docker est construite, scannée
   et publiée sur Docker Hub (Jenkins, SonarQube, Trivy).
2. **Déploiement** – l'image publiée est récupérée par un pipeline GitLab CI/CD et déployée sur un
   serveur Ubuntu préparé avec Ansible (et Terraform selon l'environnement). *[à venir]*

## 2. Démarche

La progression suit le cours : **Manuel → Scripté → Automatisé**.

| Étape | Manuel (comprendre) | Automatisé (industrialiser) |
|---|---|---|
| Tests | `npm run test:coverage` en local | étape *Tests* du Jenkinsfile |
| Qualité | scanner Sonar lancé à la main dans un conteneur | `withSonarQubeEnv` + `waitForQualityGate` |
| Image | `docker build` / `docker run` / scan Trivy en local | étapes *Build image*, *Trivy scan*, *Push* |

Chaque étape a été validée manuellement avant d'être automatisée, ce qui a permis de détecter les
problèmes (route `/v1`, hotspot, vulnérabilités, mémoire) avant qu'ils ne bloquent la pipeline.

Un journal de bord a été tenu tout au long du projet (commandes, résultats, incidents) ; il sert de
base à ce rapport.

## 3. Partie 1 – Intégration continue

### 3.1 Préparation du dépôt
Fork du dépôt officiel, clone, branche `Dev`, `npm ci` (installation reproductible à partir du
lockfile) et `npx prisma generate`.

Constats sur le dépôt fourni : script `test` factice, Dockerfile en Node 20 et exécuté en root,
absence de `.dockerignore`.

### 3.2 Tests Backend
- **Outils** : Jest 30 + ts-jest (TypeScript), Supertest (requêtes HTTP sans ouvrir de port),
  jest-junit (rapport lisible par Jenkins).
- **Isolation** : un faux client Prisma (`jest.mock`) remplace la base ; les tests passent par les
  vraies routes, donc par les middlewares d'authentification, de rôles et de validation.
  Ils s'exécutent sans PostgreSQL, en local comme dans Jenkins.
- **Configuration dédiée** : `tsconfig.test.json` (le `tsconfig.json` de production limite la
  compilation à `src/`), dossier `tests/` hors de l'image Docker.
- **Couverture fonctionnelle** : authentification, gestion des candidats, offres, candidatures,
  utilisateurs, contrôle d'accès (401/403), erreurs 500 sans fuite d'information, pagination.
- **Résultat** : **65 tests**, 100 % des lignes et des fonctions, 68 % des branches.

| Avant | Après |
|---|---|
| 0 test, script `echo "Jest sera configuré plus tard"` | 65 tests, couverture lcov + JUnit |

### 3.3 Qualité avec SonarQube
- SonarQube 9.9 LTS en conteneur ; projet `souverainrecrut-backend` ; configuration versionnée
  (`sonar-project.properties`) sans secret.
- **Security Hotspot S5689** (en-tête `X-Powered-By: Express` révélant la technologie) : **corrigé**
  par `app.disable("x-powered-by")` et protégé par un test de non-régression, plutôt que simplement
  marqué « Safe ».
- **Quality Gate personnalisé « SouverainRecrut »** : conditions sur le code neuf (Clean as You
  Code) **et** sur l'ensemble du code (couverture ≥ 80 %, duplications ≤ 3 %, notes A, hotspots
  100 % examinés), pour empêcher aussi la dégradation de l'existant.
- **Résultat** : Quality Gate **Passed** – 0 bug, 0 vulnérabilité, 0 hotspot, 0 % de duplication,
  couverture 94,4 %.

### 3.4 Jenkins
- Jenkins en conteneur, à partir d'une **image personnalisée** (`jenkins/Dockerfile`) contenant
  Node 22, Docker CLI, Trivy et les plugins (`plugins.txt`) : l'environnement de build est décrit
  en code et reconstructible.
- Accès au moteur Docker de l'hôte via le socket, avec ajout du seul groupe propriétaire
  (`group_add: "0"`) plutôt que d'exécuter Jenkins en root.
- Réseau Docker `cicd-net` partagé avec SonarQube (analyse dans un sens, webhook dans l'autre).
- **Credentials** : `sonar-token` (User Token dédié) et `dockerhub` (Personal Access Token
  Read & Write) ; aucun secret dans le dépôt.

### 3.5 Pipeline (Jenkinsfile)
Checkout de `Dev` → `npm ci` → `prisma generate` → tests (JUnit + couverture) → analyse SonarQube →
**Quality Gate bloquant** → build de l'image → **Trivy bloquant** → push Docker Hub.
Déclenchement automatique toutes les 5 minutes en cas de nouveau commit (`pollSCM`).

### 3.6 Image Docker et publication
Dockerfile du Backend revu :

| Problème | Correction |
|---|---|
| Node 20 (exigence : 22+) | `node:22-alpine` |
| Exécution en root | `USER node` |
| Pas de `.dockerignore` (risque d'embarquer `.env`) | `.dockerignore` créé |
| `COPY . .` | copies ciblées, meilleur cache |
| Pas de contrôle de santé | `HEALTHCHECK` sur `/v1/health` |
| Pas de traçabilité | labels OCI `version` / `revision` |
| npm présent à l'exécution | supprimé de l'image finale |

**Scan Trivy** : l'image initiale présentait **1 CRITICAL** (`proxy-addr`, usurpation d'adresse IP)
et 26 HIGH. Après mise à jour des dépendances transitives (sans changer les versions déclarées) et
suppression de npm de l'image : **0 CRITICAL, 2 HIGH**. Les 2 HIGH restants proviennent de versions
imposées par Prisma ; risque accepté et documenté, correction = montée de version de Prisma.

**Seuils** : CRITICAL corrigeable → bloquant ; HIGH → signalé dans le rapport archivé.

**Publication** : `jogoat123/souverainrecrut-backend:1.0.0-2d7e00c` – le tag associe la version
applicative (`1.0.0`) et le commit (`2d7e00c`).

## 4. Résultats de la partie 1

| Exigence du cahier des charges | Résultat | Preuve |
|---|---|---|
| Jenkinsfile opérationnel | Build #2 vert de bout en bout (≈ 7 min) | capture 09, `reports/jenkins/build-2-console.txt` |
| Tests Backend exécutables | 65 / 65 | `reports/tests/` |
| Rapport de couverture | 100 % lignes (Jest), 94,4 % (SonarQube) | `reports/couverture/` |
| Résultats SonarQube | Quality Gate Passed | captures 01–07, `sonar/README.md` |
| Résultats Trivy | 0 CRITICAL, 2 HIGH | `reports/trivy/` |
| Image versionnée sur Docker Hub | `1.0.0-2d7e00c` | log du build #2, Docker Hub |
| Publication conditionnée | Build #1 en échec → **aucune image publiée** | capture 09 |

## 5. Sécurité de la chaîne

- **Secrets** : uniquement dans les credentials Jenkins ; injectés par `withCredentials`, passés
  par `--password-stdin`, masqués dans les logs. `.env` exclus de Git et de l'image.
- **Tokens à portée minimale** : token Docker Hub plutôt que mot de passe, User Token Sonar dédié.
- **Rotation** : un token SonarQube communiqué par erreur en clair a été considéré comme compromis,
  révoqué et remplacé.
- **Défense en profondeur** : tests de sécurité (JWT falsifié/expiré, rôles, absence de fuite
  d'erreur), analyse statique, scan de l'image, exécution non-root.

## 6. Incidents rencontrés et résolutions

| # | Incident | Diagnostic | Résolution |
|---|---|---|---|
| 1 | Premier test vide / route introuvable | Fichier non sauvegardé ; routes préfixées par `/${API_VERSION}` (`/v1`) | Test corrigé sur `/v1/health` |
| 2 | Avertissement ts-jest `TS151002` | Projet en `module: NodeNext` | `isolatedModules: true` dans `tsconfig.test.json` |
| 3 | Docker indisponible (`500 … dockerDesktopLinuxEngine`) | Mise à jour de Docker Desktop en cours | Attente de la fin de la mise à jour |
| 4 | Rapport Sonar non reçu (`unexpected end of stream`) | Envoi coupé via `host.docker.internal` ; SonarQube sain | Réseau Docker dédié `cicd-net` |
| 5 | `Condition Coverage` au lieu de `Coverage` dans le gate | Mauvaise métrique (branches seules, 68 %) | Condition remplacée avant l'analyse |
| 6 | Token SonarQube exposé | Collé dans un échange en clair | Révocation et remplacement |
| 7 | Échec ponctuel de `npm ci` au build Docker | Erreur réseau passagère | Build relancé à l'identique : succès |
| 8 | Build #1 : `Failed to query server version` | SonarQube **tué par manque de mémoire** (`OOMKilled`) pendant les tests : Jest lançait 15 processus (16 cœurs) sur ≈ 2,8 Go | Jest à 2 workers, Jenkins `-Xmx768m`, SonarQube en redémarrage automatique. Tests : 6 min 30 → 9 s |

L'incident 8 illustre le rôle de la pipeline : l'échec a stoppé la chaîne **avant** la publication ;
aucune image non contrôlée n'a atteint Docker Hub.

## 7. Partie 2 – Provisionnement et déploiement *[à venir]*

- 4.1 Machine virtuelle Ubuntu Server 24.04 (VMware), SSH, snapshot
- 4.2 Terraform
- 4.3 Ansible (Docker Engine, Docker Compose, répertoire de déploiement)
- 4.4 / 5.3 Pipeline GitLab CI/CD (validation du tag, SSH, pull de l'image, approbation manuelle)
- 5.2 Docker Compose : API + PostgreSQL, volume, healthchecks, migrations Prisma
- 5.4 Vérification et procédure de rollback

Point d'attention identifié : le poste dispose de 5,9 Go de RAM ; la VM sera dimensionnée en
conséquence et SonarQube/Jenkins arrêtés pendant le déploiement.

## 8. Conformité aux exigences de qualité et de sécurité (§7)

| Exigence | Statut | Éléments |
|---|---|---|
| Reproductibilité | ✅ partie 1 | Procédures dans `integration-continue/README.md`, image Jenkins et pipeline en code |
| Qualité logicielle | ✅ | Tests exécutés à chaque build, couverture et SonarQube consultables |
| Sécurité | ✅ | Secrets protégés, image scannée par Trivy avec seuil bloquant |
| Traçabilité | ✅ | Tag `<version>-<commit>`, labels OCI, logs de build archivés |
| Déploiement | ⏳ | Partie 2 |
| Continuité (rollback) | ⏳ | Partie 2 – les tags versionnés permettent déjà de cibler une version antérieure |
| Documentation | ✅ partie 1 | README du pipeline, architecture, runbook, ce rapport |

## 9. Limites et pistes d'amélioration
- Monter de version Prisma pour supprimer les 2 vulnérabilités HIGH restantes.
- Ajouter une validation Zod sur `POST /auth/login` (seule route sans schéma).
- Traiter les 6 code smells SonarQube ; migrer vers une version active de SonarQube.
- Ajouter des scanners complémentaires vus en cours : `gitleaks` (secrets dans Git), `npm audit`.
- Exposer Jenkins (tunnel) pour remplacer le `pollSCM` par un webhook GitHub instantané.

## Annexe A – Historique Git (branche `Dev`)

| Commit | Contenu |
|---|---|
| `28f6d56` | Mise en place de Jest |
| `810164c` | 64 tests Backend (mock Prisma) |
| `0b9185f` | Configuration SonarQube, correction du hotspot `X-Powered-By` |
| `9b39b01` | Image Jenkins (Dockerfile, plugins, docker-compose) |
| `03eeb89` | Jenkinsfile, Dockerfile Backend sécurisé, rapport JUnit |
| `2d7e00c` | Limites mémoire (Jest, Jenkins) – build #2 vert, image publiée |

## Annexe B – Organisation du livrable

```
Jenkinsfile                      pipeline CI (lu par Jenkins à la racine)
backend/                         API, tests, Dockerfile, .dockerignore, sonar-project.properties
jenkins/                         image et lancement de Jenkins
integration-continue/
  README.md                      documentation du pipeline + runbook
  sonar/README.md                Quality Gate, résultats, hotspot
  reports/                       tests, couverture, Trivy, logs Jenkins
deploiement/                     [à venir] terraform, ansible, deployment/, .gitlab-ci.yml
documentation/
  architecture.md
  rapport-final.md               ce document
  procedure-deploiement.md       [à venir]
  procedure-rollback.md          [à venir]
  captures/                      captures d'écran
```
