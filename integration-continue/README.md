# Intégration continue – SouverainRecrut Backend

Chaîne d'intégration continue de l'API Backend (Node.js 22, Express, TypeScript, Prisma) :
chaque commit sur la branche `Dev` est testé, analysé, conteneurisé, scanné puis publié sur Docker Hub
**uniquement si tous les contrôles réussissent**.

```
GitHub (branche Dev)
   │  pollSCM toutes les 5 min
   ▼
Jenkins ── npm ci ── prisma generate ── tests Jest (65) + couverture
   │
   ├──> SonarQube : analyse + Quality Gate « SouverainRecrut »  ──(webhook)──> Jenkins
   │                                     FAILED => arrêt du pipeline
   ▼
docker build ──> Trivy (CRITICAL corrigeable => arrêt) ──> docker push
                                                              │
                                                              ▼
                                Docker Hub : jogoat123/souverainrecrut-backend:<version>-<commit>
```

---

## 1. Contenu du dossier

```
integration-continue/
├── Jenkinsfile                 pipeline déclaratif (job Jenkins : Script Path = integration-continue/Jenkinsfile)
├── Dockerfile                  image de l'API (multi-stage, non-root, healthcheck) – contexte de build : backend/
├── sonar/
│   ├── sonar-project.properties   paramètres d'analyse SonarQube
│   └── README.md                  Quality Gate, résultats, hotspot traité
├── reports/                    tests, couverture, Trivy, logs Jenkins
├── jenkins/                    image et lancement de Jenkins (Dockerfile, plugins.txt, docker-compose.yml)
└── README.md                   ce document
```

Fichiers liés, restés dans le code applicatif :

| Fichier | Rôle |
|---|---|
| [`/backend/.dockerignore`](../backend/.dockerignore) | Exclut secrets (`.env`), tests et rapports du contexte de build `backend/` |
| [`/backend/tests/`](../backend/tests/) | 9 fichiers, 65 tests (Jest + Supertest) |
| [`/backend/jest.config.js`](../backend/jest.config.js) | Couverture lcov + rapport JUnit |

Commandes équivalentes à la pipeline, depuis la racine du dépôt :
```bash
docker build -f integration-continue/Dockerfile -t souverainrecrut-backend:local backend
cd backend && sonar-scanner -Dproject.settings=../integration-continue/sonar/sonar-project.properties
```

---

## 2. Prérequis

| Outil | Version utilisée | Remarque |
|---|---|---|
| Docker Desktop | moteur 29.9.3 | Fait tourner SonarQube, Jenkins et les builds |
| SonarQube | 9.9.8 LTS Community | Image `sonarqube:lts-community` |
| Jenkins | 2.580.2 LTS (JDK 21) | Image personnalisée `souverainrecrut-jenkins:1.0` |
| Node.js / npm (dans Jenkins) | 22.23.4 / 10.9.9 | Copiés de l'image officielle `node:22` |
| Trivy (dans Jenkins) | 0.76.2 | Dépôt APT officiel Aqua Security |
| SonarScanner CLI | 8.4.0 | Installé automatiquement par Jenkins |
| Comptes | GitHub (fork), Docker Hub | |

Les conteneurs SonarQube et Jenkins partagent le réseau Docker **`cicd-net`** :
Jenkins joint `http://sonarqube:9000`, SonarQube rappelle `http://jenkins:8080/sonarqube-webhook/`.

---

## 3. Mise en place (reproductible)

### 3.1 SonarQube
```bash
docker run -d --name sonarqube --restart unless-stopped -p 9000:9000 sonarqube:lts-community
docker network create cicd-net
docker network connect cicd-net sonarqube
```
Puis dans http://localhost:9000 :
1. changer le mot de passe `admin` ;
2. créer le projet `souverainrecrut-backend` (branche principale `Dev`) ;
3. créer le Quality Gate `SouverainRecrut` et l'associer au projet (voir [`sonar/README.md`](sonar/README.md)) ;
4. générer un **User Token** `jenkins` (My Account → Security) ;
5. créer le webhook `jenkins` → `http://jenkins:8080/sonarqube-webhook/` (Administration → Configuration → Webhooks).

### 3.2 Jenkins
```bash
cd integration-continue/jenkins
docker compose up -d --build
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```
Puis dans http://localhost:8080 : déverrouillage, plugins suggérés, compte administrateur.

L'image ajoute à Jenkins : Node 22, Docker CLI (moteur de l'hôte via `/var/run/docker.sock`),
Trivy et les plugins `git`, `workflow-aggregator`, `pipeline-stage-view`, `credentials-binding`,
`sonar`, `timestamper`, `ws-cleanup`.

### 3.3 Credentials et intégrations (aucun secret dans le dépôt)

| Où | Élément | Valeur |
|---|---|---|
| Manage Jenkins → Credentials | `sonar-token` (Secret text) | User Token SonarQube |
| Manage Jenkins → Credentials | `dockerhub` (Username with password) | identifiant Docker Hub + **Personal Access Token** (Read & Write) |
| Manage Jenkins → System | SonarQube server `sonarqube` | URL `http://sonarqube:9000`, token `sonar-token` |
| Manage Jenkins → Tools | SonarQube Scanner `sonar-scanner` | installation automatique |

### 3.4 Job
New Item → **Pipeline** `souverainrecrut-backend` → *Pipeline script from SCM* :
Git `https://github.com/YoussefGoat123/souverainrecrut.git`, branche `*/Dev`,
Script Path **`integration-continue/Jenkinsfile`**.

---

## 4. Le pipeline

| # | Étape | Action | En cas d'échec |
|---|---|---|---|
| 1 | Init | Calcule `IMAGE_TAG = <version package.json>-<commit court>` | arrêt |
| 2 | Install | `npm ci` (versions exactes du lockfile) | arrêt |
| 3 | Prisma generate | `npx prisma generate` | arrêt |
| 4 | Tests | `npm run test:coverage -- --maxWorkers=2` ; publication JUnit, archive de la couverture | arrêt |
| 5 | SonarQube | `sonar-scanner` via `withSonarQubeEnv('sonarqube')` | arrêt |
| 6 | Quality Gate | `waitForQualityGate abortPipeline: true` (résultat reçu par webhook) | **arrêt** |
| 7 | Build image | `docker build` avec labels OCI `version` et `revision` | arrêt |
| 8 | Trivy scan | Rapport HIGH+CRITICAL archivé, puis `--severity CRITICAL --ignore-unfixed --exit-code 1` | **arrêt** |
| 9 | Push Docker Hub | `docker login --password-stdin` + `docker push` | – |
| – | post | `docker logout`, suppression de l'image locale, nettoyage du workspace | – |

**Déclencheur** : `pollSCM('H/5 * * * *')`. Jenkins tourne en local et n'est pas joignable par un
webhook GitHub ; il interroge donc le dépôt toutes les 5 minutes et ne lance un build qu'en cas de
nouveau commit (`scm-polling.log` : *« already built by 2 – No changes »*).

**Tag d'image** : `1.0.0-2d7e00c` = version sémantique + commit Git. Chaque image est reliée à une
version précise du code ; pas de `latest` (réservé aux tests).

**Gestion des secrets** : le Jenkinsfile ne contient que des identifiants de credentials. Le token
Docker Hub est injecté par `withCredentials`, passé par `--password-stdin`, masqué dans les logs
(`Masking supported pattern matches of $DH_TOKEN`), dans un bloc `sh '''…'''` sans interpolation Groovy.

---

## 5. Résultats

| Indicateur | Valeur | Preuve |
|---|---|---|
| Tests | **65 / 65** réussis (9 suites) | [`reports/tests/`](reports/tests/) |
| Couverture (Jest) | 100 % lignes, 100 % fonctions, 68 % branches | [`reports/couverture/`](reports/couverture/) |
| Couverture (SonarQube) | 94,4 % (lignes + conditions) | [`sonar/README.md`](sonar/README.md) |
| Quality Gate | **Passed** (bugs 0, vulnérabilités 0, hotspots 0, duplications 0 %) | captures 04–07 |
| Trivy | **0 CRITICAL**, 2 HIGH (risque accepté, documenté) | [`reports/trivy/`](reports/trivy/) |
| Image publiée | `jogoat123/souverainrecrut-backend:1.0.0-2d7e00c` (≈ 135 Mo) | [`reports/jenkins/build-2-console.txt`](reports/jenkins/build-2-console.txt) |
| Durée du pipeline | ≈ 7 min (build #2) | capture 09 |

---

## 6. Runbook : que faire quand une étape échoue

| Étape en échec | Symptôme dans les logs | Cause probable | Action |
|---|---|---|---|
| Install | `npm ci` : *lockfile out of sync* | `package.json` modifié sans mettre à jour le lockfile | `npm install` en local, committer `package-lock.json` |
| Tests | `Tests: x failed` | Régression | Lire *Test Result* dans Jenkins, corriger, relancer en local `npm test` |
| Tests | Tests très lents, conteneurs qui s'arrêtent | Mémoire saturée | Vérifier `--maxWorkers=2`, `docker stats`, `docker inspect <c> --format '{{.State.OOMKilled}}'` |
| SonarQube | `Failed to query server version … ConnectException` | SonarQube arrêté (ex. OOM) | `docker start sonarqube`, attendre `"status":"UP"` sur `/api/system/status` |
| SonarQube | `Not authorized` | Token expiré ou révoqué | Générer un User Token, mettre à jour le credential `sonar-token` |
| Quality Gate | Bloque puis *timeout* | Webhook absent ou injoignable | Vérifier le webhook Sonar `http://jenkins:8080/sonarqube-webhook/` et le réseau `cicd-net` |
| Quality Gate | `Pipeline aborted due to quality gate failure` | Seuil non respecté | Ouvrir le tableau de bord Sonar, corriger (tests, hotspot, duplication…) |
| Build image | Erreur réseau à `npm ci` | Indisponibilité passagère du registre npm | Relancer le build |
| Trivy scan | `Total: n (CRITICAL: n)`, exit code 1 | Vulnérabilité critique corrigeable | Lire `trivy-report.txt`, mettre à jour la dépendance (`npm update <pkg>`), relancer |
| Démarrage | `docker desktop start` : *Docker Desktop terminated unexpectedly* / `ERROR_NO_SYSTEM_RESOURCES` (après utilisation de la VM VMware) | Machine virtuelle WSL restée bloquée, RAM insuffisante | `wsl --shutdown` puis `docker desktop start` ; en dernier recours, redémarrer Windows |
| Push | `denied: requested access to the resource is denied` | Token Docker Hub invalide ou sans droit d'écriture | Recréer un token Read & Write, mettre à jour le credential `dockerhub` |

Incidents réellement rencontrés et résolus : voir [`../documentation/rapport-final.md`](../documentation/rapport-final.md), section 6.
