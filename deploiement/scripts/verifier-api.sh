#!/usr/bin/env bash
# ==========================================================
# Vérification fonctionnelle de l'API déployée (à exécuter SUR le serveur).
# Usage : bash verifier-api.sh < /dev/null
#   (< /dev/null : "docker compose exec" lit sinon l'entrée standard du script)
# Crée un administrateur de test (mot de passe aléatoire dans ~/.admin-test-password, 600),
# teste santé, authentification, contrôle d'accès, CRUD, puis la persistance après down/up.
# ==========================================================
set -euo pipefail
cd /opt/souverainrecrut
API=http://localhost:4000/v1
json() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(sys.argv[1]))" "$1"; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

# 1. Compte administrateur de test (mot de passe aléatoire, conservé en 600 sur le serveur, jamais affiché)
umask 077
[ -f ~/.admin-test-password ] || openssl rand -hex 16 > ~/.admin-test-password
PASS=$(cat ~/.admin-test-password)
docker compose exec -T -e P="$PASS" api node -e '
const { PrismaClient } = require("@prisma/client"); const bcrypt = require("bcrypt");
const p = new PrismaClient();
(async () => {
  const password = await bcrypt.hash(process.env.P, 10);
  const u = await p.user.upsert({ where: { email: "admin@souverainrecrut.test" },
    update: { password, role: "ADMIN" },
    create: { firstName: "Admin", lastName: "Test", email: "admin@souverainrecrut.test", password, role: "ADMIN" } });
  console.log("Administrateur de test prêt :", u.email, u.role);
  await p.$disconnect();
})();'

echo "=== 1. Santé"
echo "GET /health  -> $(curl -s $API/health | json 'd["data"]["status"]')"
echo "GET /ready   -> $(curl -s $API/ready | json 'd["data"]["database"]')"
echo "GET /info    -> $(curl -s $API/info | json 'd["data"]["name"] + " v" + d["data"]["version"] + " (" + d["data"]["environment"] + ")"')"

echo "=== 2. Authentification"
LOGIN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"admin@souverainrecrut.test\",\"password\":\"$PASS\"}")
TOKEN=$(echo "$LOGIN" | json 'd["data"]["token"]')
echo "POST /auth/login (bon mot de passe)    -> JWT reçu (${#TOKEN} caractères), mot de passe absent de la réponse : $(echo "$LOGIN" | json '"password" not in d["data"]["user"]')"
echo "POST /auth/login (mauvais mot de passe) -> HTTP $(code -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@souverainrecrut.test","password":"faux"}')"
AUTH="Authorization: Bearer $TOKEN"
ME=$(curl -s $API/auth/me -H "$AUTH")
ADMIN_ID=$(echo "$ME" | json 'd["data"]["id"]')
echo "GET /auth/me -> $(echo "$ME" | json 'd["data"]["email"] + " / " + d["data"]["role"]')"

echo "=== 3. Contrôle d'accès"
echo "GET /candidates sans token     -> HTTP $(code $API/candidates)"
echo "GET /candidates token falsifié -> HTTP $(code $API/candidates -H 'Authorization: Bearer abc.def.ghi')"

echo "=== 4. Candidats, offres, candidatures"
SUFFIX=$(date +%s)
CAND=$(curl -s -X POST $API/candidates -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"fullName\":\"Jean Dupont\",\"email\":\"Jean.Dupont.$SUFFIX@Mail.fr\",\"phone\":\"0601020304\"}")
CAND_ID=$(echo "$CAND" | json 'd["data"]["id"]')
echo "POST /candidates -> créé, email normalisé : $(echo "$CAND" | json 'd["data"]["email"]')"
echo "POST /candidates (même email) -> HTTP $(code -X POST $API/candidates -H "$AUTH" -H 'Content-Type: application/json' -d "{\"fullName\":\"Jean Dupont\",\"email\":\"jean.dupont.$SUFFIX@mail.fr\"}")"
echo "POST /candidates (données invalides) -> HTTP $(code -X POST $API/candidates -H "$AUTH" -H 'Content-Type: application/json' -d '{"fullName":"Jo","email":"pas-un-email"}')"
JOB=$(curl -s -X POST $API/jobs -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"title\":\"Développeur Backend\",\"description\":\"API Node.js, TypeScript et Prisma\",\"location\":\"Rennes\",\"company\":\"SouverainRecrut\",\"recruiterId\":\"$ADMIN_ID\"}")
JOB_ID=$(echo "$JOB" | json 'd["data"]["id"]')
echo "POST /jobs -> créée : $(echo "$JOB" | json 'd["data"]["title"]')"
APP=$(curl -s -X POST $API/applications -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"candidate\":{\"connect\":{\"id\":\"$CAND_ID\"}},\"job\":{\"connect\":{\"id\":\"$JOB_ID\"}},\"candidateId\":\"$CAND_ID\",\"jobId\":\"$JOB_ID\"}")
APP_ID=$(echo "$APP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id','ECHEC: '+json.dumps(d)[:200]))")
echo "POST /applications -> $APP_ID"
echo "PUT /applications/:id statut ACCEPTED -> $(curl -s -X PUT $API/applications/$APP_ID -H "$AUTH" -H 'Content-Type: application/json' -d '{"status":"ACCEPTED"}' | json 'd.get("data",{}).get("status", d)')"
echo "GET /candidates/inconnu -> HTTP $(code $API/candidates/inconnu -H "$AUTH")"
echo "GET /dashboard/stats -> $(curl -s $API/dashboard/stats -H "$AUTH" | json 'd["data"]')"

echo "=== 5. Persistance (redémarrage complet de la pile)"
BEFORE=$(curl -s "$API/candidates?limit=100" -H "$AUTH" | json 'd["pagination"]["total"]')
docker compose down >/dev/null 2>&1          # sans -v : le volume pgdata est conservé
docker compose up -d >/dev/null 2>&1
for i in $(seq 1 30); do [ "$(docker inspect -f '{{.State.Health.Status}}' souverainrecrut-api-1 2>/dev/null)" = healthy ] && break; sleep 3; done
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"admin@souverainrecrut.test\",\"password\":\"$PASS\"}" | json 'd["data"]["token"]')
AFTER=$(curl -s "$API/candidates?limit=100" -H "Authorization: Bearer $TOKEN" | json 'd["pagination"]["total"]')
echo "Candidats avant : $BEFORE / après down + up : $AFTER  -> $( [ "$BEFORE" = "$AFTER" ] && echo 'données conservées' || echo 'PERTE DE DONNÉES')"
docker compose ps --format "{{.Service}} | {{.Status}}"
