# Captures d'écran

Toutes les captures sont intégrées dans [`../rapport-final.md`](../rapport-final.md) à l'étape correspondante.
Avant d'ajouter une capture : vérifier qu'aucun token, mot de passe ou clé n'est visible.

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
| `10-jenkins-test-result.png` | Jenkins | Résultats des tests du build #8 : 65 tests, aucun échec |
| `11-jenkins-artefacts-trivy.png` | Jenkins | Rapport Trivy archivé (image `1.1.0-4371f31`) |
| `12-jenkins-credentials.png` | Jenkins | Credentials `sonar-token` et `dockerhub` (valeurs masquées) |
| `13-jenkins-job-quality-gate-tests.png` | Jenkins | Page du job : Quality Gate SonarQube Passed, tendance des 65 tests |
| `14-sonarqube-webhook.png` | SonarQube | Webhook `jenkins`, dernière livraison en succès |
| `15-dockerhub-tags.png` | Docker Hub | Tags `1.0.0-fc7bb2c` et `1.0.0-ad9b7e5` publiés par Jenkins, commandes `docker pull` |
| `16-vmware-esxi-amd-v-non-supporte.png` | VMware | ESXi : virtualisation imbriquée AMD-V indisponible (justifie l'abandon d'ESXi) |
| `17-vm-ubuntu-24.04-connexion.png` | VM | Ubuntu Server 24.04.3 installé, connexion, IP 192.168.13.129 |
| `18-vm-ubuntu-ip-et-acces-internet.png` | VM | `ip a` et `ping ubuntu.com` : réseau et accès Internet |
| `19-vm-ssh-disque-etendu.png` | VM | Connexion SSH depuis Windows, extension du disque (`lvextend`) : 14 → 28 Go |
| `21-ansible-play-recap.png` | Ansible | `PLAY RECAP` ok=18 changed=7 failed=0, Docker 29.9.3, Compose 5.7.0, UFW actif |
| `23-gitlab-runner-cree.png` | GitLab | Runner de projet `souverainrecrut-srv` créé (plateforme Linux) |
| `24-gitlab-runner-enregistre.png` | GitLab | Enregistrement du runner sur le serveur (jeton saisi masqué), `is valid`, service actif |
| `25-gitlab-pipeline-en-cours.png` | GitLab | Pipeline #3049956923 : validate → deploy → verify, `validate-tag` en cours |
| `26-gitlab-pipeline-deploiement-reussi.png` | GitLab | `validate-tag` et `deploy-production` (approuvé) réussis, `verify-deployment` en cours |
| `22-gitlab-variables.png` | GitLab | Variables CI/CD : valeurs masquées, Protected / Masked / File |
| `27-gitlab-pipeline-complet.png` | GitLab | Pipeline #3049956923 terminé : validate, deploy, verify en succès |
| `28-api-health-navigateur.png` | API | `GET /v1/health` : status UP (production) |
| `29a-api-info-avant-1.0.0.png` | Rollback | `/v1/info` avant le scénario : version 1.0.0 |
| `29-api-info-1.1.0.png` | Rollback | `/v1/info` après déploiement de la version B : 1.1.0 |
| `30a-gitlab-pipeline-1.1.0.png` | Rollback | Pipeline #3050242384 : déploiement de 1.1.0-4371f31 |
| `31-api-info-apres-rollback.png` | Rollback | `/v1/info` après rollback : retour à 1.0.0 |

Snapshot VMware : preuve textuelle (`vmrun listSnapshots`) dans le rapport, section 7.1.

## À ajouter

| Nom suggéré | Où la prendre |
|---|---|
| `30-gitlab-rollback.png` | pipeline #3050242384 avec `rollback-production` réussi |
| `32-gitlab-environnement-historique.png` | GitLab → Operate → Environments → production (historique des déploiements) |
