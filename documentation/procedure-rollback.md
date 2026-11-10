# Procédure de rollback – SouverainRecrut Backend

Objectif : revenir rapidement à une **version antérieure identifiée** de l'API lorsqu'une mise en
production pose problème, sans reconstruire d'image.

## 1. Principes

| Principe | Mise en œuvre |
|---|---|
| Chaque version est une image immuable | tag `<version>-<commit>` sur Docker Hub, jamais écrasé, jamais `latest` |
| On sait ce qui tourne et ce qui a tourné | `/opt/souverainrecrut/deploy-history.log` : date, tag, pipeline, auteur |
| Les données sont protégées | sauvegarde `pg_dump` automatique avant chaque déploiement (`backups/`) |
| Le retour arrière est le même geste qu'un déploiement | même job, même vérifications : seul le tag change |

## 2. Quand déclencher un rollback

- `verify-deployment` en échec (API *unhealthy*, `/v1/ready` non `CONNECTED`) ;
- régression fonctionnelle constatée après mise en production ;
- erreurs en hausse dans `docker compose logs api`.

## 3. Identifier la version cible

Sur le serveur :
```bash
cat /opt/souverainrecrut/deploy-history.log
# 2026-11-10T14:05:12Z 1.0.0-aaaaaaa pipeline=101 par=…
# 2026-11-10T15:20:47Z 1.1.0-bbbbbbb pipeline=105 par=…   <- version en cause
docker inspect -f '{{.Config.Image}}' souverainrecrut-api-1   # version réellement en cours
```
Ou côté Jenkins : log du build (`Image publiée : …`) ; côté Docker Hub : onglet *Tags*.

## 4. Rollback via GitLab (méthode nominale)

1. **Build → Pipelines** → ouvrir le dernier pipeline.
2. Job **`rollback-production`** → ▶ (manuel).
   - Sans paramètre : redéploie la **version précédente** lue dans `deploy-history.log`.
   - Pour une version précise : avant ▶, ajouter la variable `ROLLBACK_TAG` = `1.0.0-aaaaaaa`.
3. Le job : valide le format du tag → copie le compose → régénère `.env` avec ce tag → sauvegarde la
   base → `pull` → `up -d` → enregistre le rollback dans l'historique → contrôle `/v1/health`.
4. Alternative équivalente : **Run pipeline** avec `BACKEND_TAG = 1.0.0-aaaaaaa`, puis approbation
   de `deploy-production` (passe aussi par `validate-tag` et `verify-deployment`).

Durée : environ 1 minute (l'image précédente est souvent encore en cache sur le serveur).

## 5. Rollback manuel (GitLab indisponible)

```bash
ssh -i ~/.ssh/souverainrecrut_deploy deploy@192.168.13.129
cd /opt/souverainrecrut
sed -i 's/^BACKEND_TAG=.*/BACKEND_TAG=1.0.0-aaaaaaa/' .env
docker compose pull api
docker compose up -d
docker compose ps
curl -s http://localhost:4000/v1/health
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) 1.0.0-aaaaaaa rollback-manuel par=$USER" >> deploy-history.log
```

## 6. Base de données : ce que le rollback ne fait pas

Le rollback **remplace l'image de l'API, pas le schéma de la base**. Les migrations Prisma sont
appliquées *en avant* (`prisma migrate deploy`) et ne sont pas annulées automatiquement.

| Cas | Conséquence | Conduite à tenir |
|---|---|---|
| La nouvelle version n'a **pas** de migration | rollback sans risque | rollback de l'image seul |
| Migration **additive** (nouvelle table/colonne optionnelle) | l'ancienne version ignore les ajouts | rollback de l'image seul |
| Migration **destructive** (suppression/renommage de colonne) | l'ancienne version peut ne plus fonctionner | restaurer la sauvegarde (ci-dessous) **et** rollback de l'image |

Règle de conception adoptée : migrations **rétrocompatibles** (ajouter d'abord, supprimer dans une
version ultérieure), pour que la version N-1 reste compatible avec le schéma N.

### Restaurer la sauvegarde prise avant le déploiement
```bash
cd /opt/souverainrecrut
ls -1t backups/                                       # avant-<tag>-<date>.sql.gz
docker compose stop api
docker compose exec -T db psql -U souverainrecrut -d postgres -c "DROP DATABASE souverainrecrut WITH (FORCE);"
docker compose exec -T db psql -U souverainrecrut -d postgres -c "CREATE DATABASE souverainrecrut;"
gunzip -c backups/avant-1.1.0-bbbbbbb-<date>.sql.gz | docker compose exec -T db psql -U souverainrecrut -d souverainrecrut
# puis rollback de l'image (section 4 ou 5)
```
⚠️ Les données écrites **après** la sauvegarde sont perdues : à décider explicitement.

## 7. Vérifications après rollback

| Contrôle | Attendu |
|---|---|
| `docker inspect -f '{{.Config.Image}}' souverainrecrut-api-1` | tag cible |
| `docker compose ps` | `api`, `db` *healthy* |
| `GET /v1/health`, `GET /v1/ready` | `UP`, `CONNECTED` |
| `GET /v1/info` | version applicative attendue |
| Données | présentes (volume `pgdata` conservé) |
| `deploy-history.log` | ligne du rollback ajoutée |

## 8. Scénario de test maîtrisé

| # | Action | Résultat attendu |
|---|---|---|
| 1 | Déployer la version **A** (`1.0.0-<sha>`) | `/v1/info` → version 1.0.0 |
| 2 | Créer des données (utilisateur, candidat) | données lisibles |
| 3 | Déployer la version **B** (`1.1.0-<sha>`) | `/v1/info` → version 1.1.0, données conservées |
| 4 | Déclencher `rollback-production` | retour à **A** sans saisie de tag |
| 5 | Contrôles de la section 7 | A en ligne, *healthy*, données conservées, historique à jour |

Résultats du test : voir [`rapport-final.md`](rapport-final.md), section « Vérification et rollback ».
