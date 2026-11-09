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

## À ajouter

| Nom suggéré | Où la prendre |
|---|---|
| `10-jenkins-test-result.png` | Jenkins → build #2 → *Test Result* (65 tests) |
| `11-jenkins-artefacts-trivy.png` | Jenkins → build #2 → artefacts `trivy-report.txt` |
| `12-jenkins-credentials.png` | Manage Jenkins → Credentials (valeurs masquées) |
| `13-jenkins-config-sonarqube.png` | Manage Jenkins → System → SonarQube servers |
| `14-sonarqube-webhook.png` | SonarQube → Administration → Webhooks (dernier envoi en succès) |
| `15-dockerhub-tag.png` | hub.docker.com → `jogoat123/souverainrecrut-backend` → Tags |

Avant d'ajouter une capture : vérifier qu'aucun token, mot de passe ou clé n'est visible.
