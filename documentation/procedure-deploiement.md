# Procédure de déploiement – SouverainRecrut Backend

Procédure reproductible par un tiers, de la machine virtuelle vide jusqu'à l'API en ligne.
Prérequis : une image Backend publiée sur Docker Hub par la pipeline Jenkins
(voir [`../integration-continue/README.md`](../integration-continue/README.md)).

| Étape | Outil | Durée indicative |
|---|---|---|
| 1. Créer la VM Ubuntu Server | VMware Workstation | 30 min |
| 2. Accès SSH par clé + snapshot | OpenSSH, VMware | 15 min |
| 3. Générer l'inventaire | Terraform | 5 min |
| 4. Préparer le serveur | Ansible | 10 min |
| 5. Préparer le projet GitLab et le runner | GitLab | 30 min |
| 6. Déployer | GitLab CI/CD | 5 min |
| 7. Vérifier | navigateur / curl | 5 min |

---

## 1. Créer la machine virtuelle

1. Télécharger **Ubuntu Server 24.04 LTS** (`ubuntu-24.04.x-live-server-amd64.iso`) :
   https://releases.ubuntu.com/24.04/
2. VMware Workstation → **File → New Virtual Machine → Typical** → ISO ci-dessus.
3. Nom `souverainrecrut-srv`, disque **30 Go** (fichier unique).
   **Customize Hardware** : 2 processeurs, 2048 Mo (4096 Mo recommandés si la machine le permet), réseau **NAT**.
4. Installation Ubuntu : langue English, clavier French, type *Ubuntu Server*, réseau DHCP,
   disque entier ; profil `deploy` / `souverainrecrut-srv` ; **cocher « Install OpenSSH server »** ;
   aucun snap.
5. Au message *« Please remove the installation medium »* : Entrée. Décocher ensuite
   *VM → Settings → CD/DVD → Connect at power on*.
6. Se connecter (`deploy`) et relever l'adresse : `ip -4 a show ens33` (ici `192.168.13.129`).
   Vérifier l'accès Internet : `ping -c 3 ubuntu.com`.

> ESXi n'est pas utilisé : la virtualisation imbriquée est indisponible sur le poste (Hyper-V actif)
> et ESXi exige 8 Go de RAM. Voir [`architecture.md`](architecture.md).

## 2. Accès SSH par clé, mise à jour, snapshot

Depuis **Windows (PowerShell)** :
```powershell
ssh deploy@192.168.13.129                    # 1re connexion : accepter l'empreinte (yes)
```
Sur le serveur :
```bash
sudo lvextend -r -l +100%FREE /dev/ubuntu-vg/ubuntu-lv   # utiliser tout le disque (LVM n'en prend que la moitié)
sudo apt update && sudo apt upgrade -y && sudo reboot
```
Clé dédiée au déploiement, créée **sur Windows**, sans passphrase (utilisée par l'automatisation) :
```powershell
ssh-keygen -t ed25519 -f $HOME\.ssh\souverainrecrut_deploy -C "deploy-souverainrecrut"
icacls $HOME\.ssh\souverainrecrut_deploy /inheritance:r /grant:r "$($env:USERNAME):(R,W)"
type $HOME\.ssh\souverainrecrut_deploy.pub | ssh deploy@192.168.13.129 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
ssh -i $HOME\.ssh\souverainrecrut_deploy deploy@192.168.13.129 hostname   # doit répondre sans mot de passe
```
VMware : **VM → Snapshot → Take Snapshot** `01-ubuntu-installe-a-jour` (avant toute configuration).

## 3. Terraform : inventaire

Sur le poste de contrôle (ici la VM ; Terraform 1.9.8 installé dans `~/.local/bin`) :
```bash
cd deploiement/terraform
cp terraform.tfvars.example terraform.tfvars          # server_ip = "192.168.13.129"
terraform init
terraform validate
terraform plan
terraform apply                                       # génère ../ansible/inventory.ini
```

## 4. Ansible : préparation du serveur

```bash
cd ../ansible
ansible app_servers -m ping                                   # attendu : "pong"
ansible-playbook -i inventory.ini playbook.yml --ask-become-pass
```
Attendu : `failed=0`, Docker actif, Docker Compose installé, UFW actif (22 et 4000),
`/opt/souverainrecrut` créé. Vérifier depuis une **nouvelle** session SSH : `docker ps` sans `sudo`.

## 5. Projet GitLab et runner

### 5.1 Projet
1. gitlab.com → **New project → Create blank project** : `souverainrecrut-deploiement`, privé.
2. Publier le contenu du dossier `deploiement/` à la racine du projet, depuis le dépôt principal :
   ```bash
   git remote add gitlab https://gitlab.com/<compte>/souverainrecrut-deploiement.git
   git subtree push --prefix deploiement gitlab main
   ```

### 5.2 Runner (sur le serveur)
Le serveur est sur un réseau privé : un runner local ouvre la connexion vers GitLab.
1. GitLab : **Settings → CI/CD → Runners → New project runner** : tag `souverainrecrut`,
   cocher *Run untagged jobs* : non. Copier le jeton `glrt-…` (secret).
2. Sur le serveur :
   ```bash
   curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | sudo bash
   sudo apt install -y gitlab-runner
   sudo gitlab-runner register --non-interactive \
     --url https://gitlab.com --token <glrt-…> \
     --executor docker --docker-image alpine:3.20 --description souverainrecrut-srv
   sudo gitlab-runner status
   ```
3. GitLab : le runner apparaît en vert (*online*).

### 5.3 Variables CI/CD
**Settings → CI/CD → Variables → Add variable** (détail des types dans
[`../deploiement/README.md`](../deploiement/README.md#5-pipeline-gitlab--gitlab-ciyml)) :

| Variable | Valeur / origine |
|---|---|
| `SERVER_HOST` | `192.168.13.129` |
| `SERVER_USER` | `deploy` |
| `SSH_PRIVATE_KEY` (File) | contenu de `souverainrecrut_deploy` (clé privée) |
| `SSH_KNOWN_HOSTS` (File) | `ssh-keyscan -t ed25519 192.168.13.129` |
| `DOCKERHUB_USER` | identifiant Docker Hub |
| `DOCKERHUB_TOKEN` (masquée) | access token Docker Hub, droit lecture |
| `POSTGRES_PASSWORD` (masquée) | `openssl rand -hex 24` |
| `JWT_SECRET` (masquée) | `openssl rand -hex 32` |
| `BACKEND_TAG` | tag publié par Jenkins, ex. `1.0.0-a1b2c3d` |

## 6. Déployer

1. GitLab : **Build → Pipelines → Run pipeline** (branche `main`). Pour déployer une autre version,
   renseigner `BACKEND_TAG` dans le formulaire.
2. `validate-tag` s'exécute : format du tag et présence sur Docker Hub.
3. **Approbation** : cliquer ▶ sur `deploy-production`.
4. `verify-deployment` s'enchaîne automatiquement.

Ce que fait `deploy-production` sur le serveur :
1. copie `deployment/docker-compose.yml` dans `/opt/souverainrecrut` ;
2. crée `.env` à partir des variables (droits 600) ;
3. sauvegarde la base (`pg_dump`) dans `backups/` si elle existe ;
4. `docker login` (token sur l'entrée standard), `docker compose pull`, `docker compose up -d` :
   PostgreSQL → migrations Prisma → API ;
5. ajoute une ligne à `deploy-history.log` (date, tag, pipeline, auteur).

## 7. Vérifier

| Vérification | Commande | Attendu |
|---|---|---|
| Conteneurs | `docker compose ps` (dans `/opt/souverainrecrut`) | `api` et `db` *healthy*, `migrate` *Exited (0)* |
| API | `curl http://192.168.13.129:4000/v1/health` | `"status":"UP"` |
| Base de données | `curl http://192.168.13.129:4000/v1/ready` | `"database":"CONNECTED"` |
| Version déployée | `docker inspect -f '{{.Config.Image}}' souverainrecrut-api-1` | le tag demandé |
| Persistance | `docker compose restart` puis relecture des données | données conservées (volume `pgdata`) |
| Journaux | `docker compose logs -f api` | pas d'erreur |
| Historique | `cat /opt/souverainrecrut/deploy-history.log` | une ligne par déploiement |

Vérification fonctionnelle complète (sur le serveur, après copie de `deploiement/scripts/verifier-api.sh`) :
```bash
bash verifier-api.sh < /dev/null
```
Le script crée un administrateur de test, teste santé, authentification, contrôle d'accès (401),
création de candidat / offre / candidature, erreurs 400 / 404 / 409, statistiques, puis redémarre la
pile (`down` / `up` sans `-v`) et vérifie que les données sont conservées.

## Déploiement manuel de secours (sans GitLab)
```bash
ssh -i ~/.ssh/souverainrecrut_deploy deploy@192.168.13.129
cd /opt/souverainrecrut
cp .env.example .env && nano .env        # BACKEND_TAG, mots de passe, JWT_SECRET
docker compose pull && docker compose up -d && docker compose ps
```

## En cas d'échec

| Symptôme | Cause probable | Action |
|---|---|---|
| `validate-tag` : *introuvable sur Docker Hub* | tag mal saisi ou build Jenkins non terminé | vérifier le tag dans le log Jenkins (`Image publiée : …`) |
| Job en attente *pending* | runner hors ligne | `sudo gitlab-runner status` / `restart` sur le serveur |
| `Permission denied (publickey)` | `SSH_PRIVATE_KEY` incorrecte ou non *File* | recoller la clé privée complète (lignes BEGIN/END incluses) |
| `Host key verification failed` | `SSH_KNOWN_HOSTS` absente ou obsolète | régénérer avec `ssh-keyscan` |
| `migrate` *Exited (1)* | base inaccessible ou migration invalide | `docker compose logs migrate` ; restaurer la sauvegarde si besoin |
| `api` *unhealthy* | variable manquante, base indisponible | `docker compose logs api` ; vérifier `.env` |
| `docker compose` : *variable is missing* | secret absent | compléter la variable GitLab correspondante |
