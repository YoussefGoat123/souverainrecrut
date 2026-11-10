# Captures d'écran

## Disponibles

| Fichier | Étape | Ce qu'elle montre |
|---|---|---|
| `01-sonarqube-1re-analyse-hotspot-E.png` | SonarQube | 1re analyse : Quality Gate Passed, 1 Security Hotspot non examiné (note E) |
| `02-sonarqube-1re-analyse-couverture-duplications.png` | SonarQube | Couverture 94,4 %, duplications 0 % |
| `03-sonarqube-security-hotspot-x-powered-by.png` | SonarQube | Détail du hotspot S5689 sur `src/app.ts` |
| `04-sonarqube-apres-correction-hotspot.png` | SonarQube | Après correction : Security Review A |
| `05-quality-gate-conditions-new-code.png` | SonarQube | Quality Gate SouverainRecrut, conditions sur le code neuf |
| `06-quality-gate-conditions-overall-code.png` | SonarQube | Conditions sur l'ensemble du code |
| `07-sonarqube-analyse-finale-passed.png` | SonarQube | Analyse finale Passed avec le gate personnalisé |
| `08-jenkins-build-1-en-cours.png` | Jenkins | Premier build en cours (Stage View) |
| `09-jenkins-build-1-echec-build-2-succes.png` | Jenkins | Build #1 en échec (rien publié), build #2 vert de bout en bout |
| `16-vmware-esxi-amd-v-non-supporte.png` | VMware | ESXi : virtualisation imbriquée AMD-V indisponible (justifie l'abandon d'ESXi) |
| `17-vm-ubuntu-24.04-connexion.png` | VM | Ubuntu Server 24.04.3 installé, connexion, IP 192.168.13.129 |
| `18-vm-ubuntu-ip-et-acces-internet.png` | VM | `ip a` et `ping ubuntu.com` : réseau et accès Internet |
| `21-ansible-play-recap.png` | Ansible | `PLAY RECAP` ok=18 changed=7 failed=0, Docker 29.9.3, Compose 5.7.0, UFW actif |

## À ajouter

| Nom suggéré | Où la prendre |
|---|---|
| `10-jenkins-test-result.png` | Jenkins → build #2 → *Test Result* (65 tests) |
| `11-jenkins-artefacts-trivy.png` | Jenkins → build #2 → artefacts `trivy-report.txt` |
| `12-jenkins-credentials.png` | Manage Jenkins → Credentials (valeurs masquées) |
| `13-jenkins-config-sonarqube.png` | Manage Jenkins → System → SonarQube servers |
| `14-sonarqube-webhook.png` | SonarQube → Administration → Webhooks (dernier envoi en succès) |
| `15-dockerhub-tag.png` | hub.docker.com → `jogoat123/souverainrecrut-backend` → Tags |
| `19-vmware-snapshot.png` | VMware → VM → Snapshot → Snapshot Manager |
| `20-terraform-apply.png` | sortie de `terraform apply` (outputs) |
| `22-docker-compose-ps.png` | `docker compose ps` sur le serveur (api/db healthy) |
| `23-gitlab-variables.png` | GitLab → Settings → CI/CD → Variables (valeurs masquées) |
| `24-gitlab-runner-online.png` | GitLab → Settings → CI/CD → Runners |
| `25-gitlab-pipeline-deploiement.png` | pipeline validate → deploy (manuel) → verify en vert |
| `26-api-health-navigateur.png` | `http://192.168.13.129:4000/v1/health` dans le navigateur |
| `27-rollback.png` | job `rollback-production` + `/v1/info` après retour arrière |

Avant d'ajouter une capture : vérifier qu'aucun token, mot de passe ou clé n'est visible.
