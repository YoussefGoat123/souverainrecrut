# Architecture – SouverainRecrut CI/CD

Deux chaînes : **intégration continue** (Jenkins → Docker Hub) et **provisionnement / déploiement**
(VMware, Terraform, Ansible, GitLab CI/CD → serveur Ubuntu). Elles ne communiquent que par
l'image versionnée publiée sur Docker Hub.

## 1. Vue d'ensemble

```
┌───────────────────────────── POSTE DE DÉVELOPPEMENT (Windows + Docker Desktop) ─────────────────────────────┐
│                                                                                                             │
│   git push (branche Dev)                                                                                    │
│        │                                                                                                    │
│        ▼                                  réseau Docker « cicd-net »                                        │
│  ┌──────────────┐  pollSCM /5 min  ┌───────────────────────────────┐   analyse    ┌──────────────────────┐   │
│  │   GitHub     │ ───────────────> │ Jenkins 2.580.2 (:8080)       │ ───────────> │ SonarQube 9.9 (:9000)│   │
│  │ fork, Dev    │                  │ Node 22 · Docker CLI · Trivy  │ <─────────── │ Quality Gate         │   │
│  └──────────────┘                  └──────────────┬────────────────┘   webhook    └──────────────────────┘   │
│                                                   │ /var/run/docker.sock                                    │
│                                                   ▼                                                         │
│                                     moteur Docker de l'hôte : build de l'image                              │
└───────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┘
                                                    │ docker push (si tous les contrôles sont verts)
                                                    ▼
                              Docker Hub : jogoat123/souverainrecrut-backend:<version>-<commit>
                                                    │
                                                    │ docker pull (sans reconstruction)
                                                    ▼
┌──────────────── VMware Workstation · VM « souverainrecrut-srv » · Ubuntu Server 24.04.5 · 192.168.13.129 (NAT) ─┐
│                                                                                                              │
│  Poste de contrôle : Terraform ──génère──> inventory.ini ──> Ansible ──SSH──> Docker, Compose, UFW, /opt/…   │
│                                                                                                              │
│  gitlab-runner (tag souverainrecrut) <──── jobs ──── GitLab.com : projet souverainrecrut-deploiement         │
│        │ validate-tag → deploy-production (manuel) → verify-deployment   |  rollback-production (manuel)       │
│        │ SSH (clé dédiée, known_hosts)                                                                        │
│        ▼                                                                                                     │
│  /opt/souverainrecrut : docker-compose.yml · .env (600) · backups/ · deploy-history.log                      │
│        ┌──────────────────────────── réseau Docker « backend » ──────────────────────────┐                   │
│        │  db : PostgreSQL 16 ── volume pgdata     migrate : prisma migrate deploy        │                   │
│        │  api : image Docker Hub, :4000, healthcheck /v1/health ──> db                    │                   │
│        └──────────────────────────────────────────────────────────────────────────────────┘                   │
│  UFW : 22/tcp, 4000/tcp uniquement                                                                           │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Composants

| Composant | Technologie | Rôle |
|---|---|---|
| Code source | GitHub, branche `Dev` | Fork du dépôt officiel ; déclencheur du pipeline |
| API | Node.js 22, Express 5, TypeScript, Prisma 6 | Application à industrialiser |
| Tests | Jest 30, ts-jest, Supertest, mock Prisma | 65 tests, couverture lcov, rapport JUnit |
| Orchestrateur CI | Jenkins LTS (conteneur, image personnalisée) | Exécute le `Jenkinsfile` |
| Qualité | SonarQube 9.9 LTS Community | Analyse statique, couverture, Quality Gate bloquant |
| Sécurité de l'image | Trivy 0.76 | Scan des vulnérabilités, seuil bloquant CRITICAL |
| Registre | Docker Hub | Stockage des images versionnées |
| Serveur | VMware Workstation 17.6, Ubuntu Server 24.04.5, 2 vCPU / 2 Go / 30 Go | Environnement de production |
| Provisionnement | Terraform 1.9.8 (provider `local`) | Description du serveur, génération de l'inventaire |
| Configuration | Ansible 2.18 | Docker Engine 29.9.3, Compose 5.7.0, UFW, répertoire de déploiement |
| Orchestration du déploiement | GitLab CI/CD + runner local (exécuteur Docker) | Validation, déploiement approuvé, vérification, rollback |
| Exécution | Docker Compose : `db` (PostgreSQL 16), `migrate`, `api` | API + base de données persistante |

## 3. Flux de l'intégration continue

1. Le développeur pousse sur `Dev`.
2. Jenkins détecte le nouveau commit (interrogation toutes les 5 minutes).
3. Installation des dépendances (`npm ci`), génération du client Prisma.
4. Tests unitaires et d'intégration HTTP ; publication des résultats (JUnit) et de la couverture.
5. Analyse SonarQube ; SonarQube calcule le Quality Gate et le renvoie à Jenkins par webhook.
   **Gate en échec → pipeline arrêté.**
6. Construction de l'image Docker, étiquetée `<version>-<commit>`.
7. Scan Trivy. **Vulnérabilité CRITICAL corrigeable → pipeline arrêté.**
8. Publication sur Docker Hub.

## 3 bis. Flux du déploiement

1. Terraform décrit le serveur et génère l'inventaire ; Ansible prépare le serveur en SSH.
2. Un opérateur lance le pipeline GitLab avec le tag publié par Jenkins (`BACKEND_TAG`).
3. `validate-tag` contrôle le format et l'existence du tag sur Docker Hub.
4. **Approbation manuelle** de `deploy-production` : le runner se connecte en SSH au serveur, dépose le
   fichier Compose et le `.env` (généré depuis les variables masquées), sauvegarde la base, tire l'image
   et relance les services. PostgreSQL démarre, les migrations Prisma s'appliquent, puis l'API.
5. `verify-deployment` attend l'état *healthy* et contrôle `/v1/health` et `/v1/ready`.
6. En cas de problème, `rollback-production` redéploie la version précédente de l'historique.

## 4. Choix techniques

| Choix | Alternative écartée | Justification |
|---|---|---|
| Jenkins et SonarQube en conteneurs Docker | Installation native sur Windows | Reproductible, isolé, supprimable sans trace |
| Image Jenkins personnalisée (outils + plugins dans un Dockerfile) | Configuration manuelle par l'interface | Environnement versionné et reconstructible |
| Réseau Docker dédié `cicd-net` | `host.docker.internal` | Communication directe entre conteneurs ; la voie `host.docker.internal` coupait l'envoi du rapport Sonar |
| Accès au moteur Docker de l'hôte (socket) avec `group_add: 0` | Docker-in-Docker, ou Jenkins en root | Plus simple que DinD ; privilège limité au groupe propriétaire du socket |
| `pollSCM` | Webhook GitHub | Jenkins local, non joignable depuis Internet |
| Tag `<version>-<commit>` | `latest` | Traçabilité : chaque image correspond à un commit |
| Tests avec mock Prisma | Base PostgreSQL de test | Pipeline sans dépendance externe, rapide et déterministe |
| Quality Gate avec conditions « Overall Code » | Gate par défaut « Sonar way » | Empêche aussi la dégradation du code existant |
| Seuil Trivy : CRITICAL corrigeable bloquant | Bloquer sur HIGH | HIGH restants imposés par Prisma, sans correctif applicable sans montée de version |
| VM créée manuellement dans VMware Workstation | ESXi + Terraform provider vSphere | Virtualisation imbriquée indisponible (Hyper-V actif pour Docker), ESXi exige 8 Go de RAM (poste : 5,9 Go) ; cas prévu au §4.2 |
| Terraform sur les ressources disponibles (provider `local`) | Pas de Terraform | IP saisie une seule fois ; inventaire Ansible généré, reproductible |
| Poste de contrôle Ansible/Terraform sur la VM | WSL sur le poste Windows | WSL ne démarre pas en même temps que la VM (`ERROR_NO_SYSTEM_RESOURCES`) ; Ansible reste en SSH |
| Runner GitLab local sur le serveur | Runners partagés gitlab.com | Serveur sur réseau NAT privé, injoignable depuis Internet ; le runner initie la connexion |
| Service `migrate` dédié, avant l'API | Migration au démarrage de l'API | L'API ne démarre que si le schéma est à jour ; échec visible et isolé |
| Sauvegarde `pg_dump` avant chaque déploiement | Aucune sauvegarde | Rollback possible même après une migration destructive |
| PostgreSQL non exposé, UFW 22/4000 | Port 5432 publié | Surface d'attaque minimale |

## 5. Sécurité de la chaîne

| Mesure | Mise en œuvre |
|---|---|
| Aucun secret dans le dépôt | Tokens dans les credentials Jenkins ; `.env` exclus par `.gitignore` et `.dockerignore` |
| Secrets masqués | `withCredentials`, `--password-stdin`, masquage automatique dans les logs |
| Tokens à portée limitée | Token Docker Hub Read & Write (pas le mot de passe) ; User Token Sonar dédié à Jenkins |
| Rotation | Un token exposé par erreur a été révoqué et remplacé |
| Image minimale | Multi-stage, dépendances de production seules, npm retiré de l'image finale |
| Exécution non-root | `USER node` dans l'image de l'API ; utilisateur `jenkins` dans Jenkins |
| Analyse statique | SonarQube (hotspot S5689 corrigé : en-tête `X-Powered-By` désactivé) |
| Analyse de l'image | Trivy, seuil bloquant |

## 6. Contraintes matérielles

Poste : 5,9 Go de RAM, dont ≈ 2,8 Go alloués à Docker Desktop. SonarQube (≈ 1,1–2 Go) et Jenkins
tournent en parallèle des builds. Mesures prises : Jest limité à 2 workers, Jenkins limité à
`-Xmx768m`, SonarQube en `restart: unless-stopped`.

Docker Desktop (CI) et la VM (déploiement) ne peuvent pas fonctionner simultanément : les deux chaînes
sont utilisées en alternance. Ce découplage est rendu possible par Docker Hub : la CI publie l'image,
le déploiement la récupère plus tard. VM dimensionnée à 2 Go (4 Go indicatifs dans le cahier des
charges), suffisants pour l'API (~100 Mo) et PostgreSQL.
