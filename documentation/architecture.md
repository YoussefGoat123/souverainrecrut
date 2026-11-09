# Architecture – SouverainRecrut CI/CD

> Statut : partie **intégration continue** réalisée. La partie **provisionnement et déploiement**
> (VMware, Terraform, Ansible, GitLab CI/CD, Docker Compose + PostgreSQL) sera complétée à l'étape suivante.

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
                              Docker Hub : jogoat123/souverainrecrut-backend:1.0.0-<commit>
                                                    │
                                                    │ docker pull (sans reconstruction)
                                                    ▼
                    [à venir] GitLab CI/CD ──SSH──> VM Ubuntu Server 24.04 (Ansible, Docker Compose)
                                                    API Backend + PostgreSQL
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
| Déploiement *(à venir)* | VMware, Terraform, Ansible, GitLab CI/CD, Docker Compose, PostgreSQL | Mise en service sur serveur |

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

Poste : 5,9 Go de RAM, dont ≈ 2,8 Go alloués à Docker. SonarQube (≈ 1,1–2 Go) et Jenkins tournent
en parallèle des builds. Mesures prises : Jest limité à 2 workers, Jenkins limité à `-Xmx768m`,
SonarQube en `restart: unless-stopped`. Pour la partie déploiement, SonarQube et Jenkins seront
arrêtés pendant l'utilisation de la VM.
