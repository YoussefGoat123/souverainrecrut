# Déploiement – SouverainRecrut Backend

Provisionnement et déploiement de l'API Backend sur un serveur Ubuntu, à partir de l'image publiée
par la pipeline d'intégration continue sur Docker Hub. **L'image n'est jamais reconstruite ici.**

```
deploiement/
├── terraform/            description du serveur, génération de l'inventaire Ansible
├── ansible/              préparation du serveur (Docker Engine, Compose, pare-feu, répertoire)
├── deployment/
│   ├── docker-compose.yml   API + PostgreSQL + migrations Prisma
│   └── .env.example         modèle de configuration (le .env réel n'est jamais versionné)
├── scripts/
│   └── verifier-api.sh   vérification fonctionnelle de l'API déployée (endpoints, accès, persistance)
├── .gitlab-ci.yml        pipeline de déploiement (validation, approbation manuelle, vérification, rollback)
└── README.md             ce document
```

Procédure complète pas à pas : [`../documentation/procedure-deploiement.md`](../documentation/procedure-deploiement.md).
Retour arrière : [`../documentation/procedure-rollback.md`](../documentation/procedure-rollback.md).

---

## 1. Environnement

| Élément | Valeur |
|---|---|
| Hyperviseur | VMware Workstation 17.6.4 (Windows) |
| Serveur | VM `souverainrecrut-srv` – Ubuntu Server 24.04.5 LTS – 2 vCPU, 2 Go RAM, 30 Go, réseau NAT |
| Adresse | `192.168.13.129` |
| Accès | SSH, utilisateur `deploy`, clé dédiée `souverainrecrut_deploy` (ed25519) |
| Poste de contrôle Terraform / Ansible | la VM elle-même (voir *Choix* ci-dessous) |
| Image déployée | `jogoat123/souverainrecrut-backend:<version>-<commit>` (Docker Hub) |

**Pourquoi pas ESXi + provider vSphere ?** L'ISO ESXi 8 fourni démarre dans VMware Workstation mais ne
peut pas exécuter de VM : la virtualisation imbriquée (AMD-V) n'est pas transmise car Hyper-V est actif
(requis par Docker Desktop), et ESXi exige 8 Go de RAM pour une machine qui en a 5,9. Conformément au
§4.2 du cahier des charges, la VM est créée manuellement et Terraform est utilisé sur les ressources
disponibles.

**Pourquoi la VM est aussi poste de contrôle ?** Ansible ne s'exécute pas nativement sous Windows et la
mémoire ne permet pas de faire tourner WSL en même temps que la VM (`ERROR_NO_SYSTEM_RESOURCES`).
Ansible se connecte néanmoins en **SSH** au serveur, comme depuis un poste distant.

---

## 2. Terraform – `terraform/`

| Fichier | Contenu |
|---|---|
| `providers.tf` | Terraform ≥ 1.6, provider `hashicorp/local` ~> 2.5 |
| `variables.tf` | IP du serveur (validée), utilisateur SSH, clé, répertoire, port, caractéristiques de la VM |
| `main.tf` | génère `../ansible/inventory.ini` (gabarit `templates/inventory.ini.tftpl`) et `infrastructure.json` |
| `outputs.tf` | `server_ip`, `ssh_command`, `api_url`, `health_url`, `ansible_inventory` |
| `terraform.tfvars.example` | modèle (copier en `terraform.tfvars`, non versionné) |
| `.terraform.lock.hcl` | versions exactes des providers (reproductibilité) |

```bash
cd deploiement/terraform
cp terraform.tfvars.example terraform.tfvars   # renseigner server_ip
terraform init && terraform validate && terraform plan && terraform apply
```
Résultat obtenu : `Plan: 2 to add` → `Apply complete! Resources: 2 added`, inventaire généré avec `192.168.13.129`.

---

## 3. Ansible – `ansible/`

```bash
cd deploiement/ansible
ansible-playbook -i inventory.ini playbook.yml --ask-become-pass
```

| Étape du playbook | Détail |
|---|---|
| Système | `apt update` + mise à jour sûre, `ca-certificates`, `curl`, `gnupg`, `ufw` |
| Docker | dépôt officiel Docker (clé GPG), `docker-ce`, `docker-ce-cli`, `containerd.io`, plugins buildx et **compose** |
| Service | `docker` activé au démarrage et démarré ; `deploy` ajouté au groupe `docker` |
| Répertoire | `/opt/souverainrecrut` (propriétaire `deploy`, droits 0750) |
| Pare-feu | UFW : 22/tcp et 4000/tcp autorisés **avant** activation (pas de perte d'accès SSH) |
| Vérifications | versions Docker et Compose, `systemctl is-active docker`, `ufw status` |

Résultat obtenu : `ok=18 changed=7 unreachable=0 failed=0` – Docker 29.9.3 (active), Compose 5.7.0, UFW actif.
Le playbook est **idempotent** : une seconde exécution ne modifie rien d'autre que les vérifications.

---

## 4. Docker Compose – `deployment/`

| Service | Image | Rôle |
|---|---|---|
| `db` | `postgres:16-alpine` | Volume `pgdata` persistant, healthcheck `pg_isready`, **aucun port publié** |
| `migrate` | image Backend | `prisma migrate deploy`, exécuté une fois quand `db` est *healthy* |
| `api` | image Backend | démarre seulement si `migrate` a réussi ; port 4000 ; healthcheck `/v1/health` ; `restart: unless-stopped` |

Variables : voir [`deployment/.env.example`](deployment/.env.example). Les variables indispensables
(`POSTGRES_*`, `JWT_SECRET`, `BACKEND_IMAGE`, `BACKEND_TAG`) sont contrôlées : Compose refuse de démarrer
si l'une manque.

**Stratégie de migration** : migrations Prisma versionnées, appliquées *en avant* par un service dédié
avant le démarrage de l'API ; sauvegarde `pg_dump` automatique avant chaque déploiement (pipeline).

Test réalisé sur le serveur :
```
api       Up (healthy)   0.0.0.0:4000->4000/tcp
db        Up (healthy)   5432/tcp
migrate   Exited (0)     "All migrations have been successfully applied"
GET /v1/health -> "status":"UP"      GET /v1/ready -> "database":"CONNECTED"
Depuis Windows : API joignable sur :4000, PostgreSQL non joignable (attendu)
```

---

## 5. Pipeline GitLab – `.gitlab-ci.yml`

Projet GitLab dédié au déploiement, contenant le contenu de ce dossier.

| Job | Étape | Déclenchement | Action |
|---|---|---|---|
| `validate-tag` | validate | automatique | tag au format `x.y.z-<sha7>` **et** présent sur Docker Hub |
| `deploy-production` | deploy | **manuel (approbation)** | SSH ; copie du compose ; `.env` généré depuis les variables ; sauvegarde `pg_dump` ; `docker login --password-stdin` ; `pull` ; `up -d` ; historique |
| `verify-deployment` | verify | après déploiement | `compose ps`, attente *healthy*, `/v1/health`, `/v1/ready` = CONNECTED, tag réellement déployé |
| `rollback-production` | deploy | manuel | redéploie la version précédente de l'historique, ou `ROLLBACK_TAG` |

**Runner** : runner GitLab installé sur le serveur (tag `souverainrecrut`, exécuteur Docker). Le serveur
est sur un réseau NAT privé, injoignable par les runners partagés de gitlab.com ; le runner, lui, ouvre
la connexion vers GitLab.

**Variables CI/CD** (Settings → CI/CD → Variables) :

| Variable | Type | Masquée | Protégée | Contenu |
|---|---|---|---|---|
| `SERVER_HOST` | Variable | – | oui | `192.168.13.129` |
| `SERVER_USER` | Variable | – | oui | `deploy` |
| `SSH_PRIVATE_KEY` | **File** | – | oui | clé privée `souverainrecrut_deploy` |
| `SSH_KNOWN_HOSTS` | **File** | – | oui | sortie de `ssh-keyscan -t ed25519 192.168.13.129` |
| `DOCKERHUB_USER` | Variable | – | oui | `jogoat123` |
| `DOCKERHUB_TOKEN` | Variable | **oui** | oui | access token Docker Hub (lecture) |
| `POSTGRES_PASSWORD` | Variable | **oui** | oui | `openssl rand -hex 24` |
| `JWT_SECRET` | Variable | **oui** | oui | `openssl rand -hex 32` |
| `BACKEND_TAG` | Variable | – | – | tag à déployer, modifiable au lancement du pipeline |

Aucun secret n'est écrit dans le dépôt ni affiché dans les logs : variables masquées, clé en fichier
temporaire du job, token Docker Hub transmis sur l'entrée standard, `.env` créé côté serveur en `umask 077`.

---

## 6. Sécurité du serveur

| Mesure | Mise en œuvre |
|---|---|
| Authentification SSH par clé | clé dédiée ed25519, empreinte du serveur vérifiée (`known_hosts`) |
| Moindre privilège | `deploy` utilise Docker sans `sudo` ; `sudo` (mot de passe) seulement pour Ansible |
| Pare-feu | UFW : seuls 22/tcp et 4000/tcp entrants |
| Base de données | non exposée, réseau Docker interne `backend` |
| Secrets | `.env` en 600, généré par le pipeline ; jamais versionné |
| Conteneur API | utilisateur non-root, healthcheck, redémarrage automatique |
| Traçabilité | tag `<version>-<commit>`, `deploy-history.log` (date, tag, pipeline, auteur) |
