# ==========================================
# Image Jenkins pour la CI de SouverainRecrut
# ==========================================
# Base : Jenkins LTS officiel (Java 21, Debian 13 "trixie")
# Ajouts :
#   - Node.js 22 + npm  -> npm ci, prisma generate, tests Jest
#   - Docker CLI        -> docker build / push (le moteur est celui de l'hôte, via le socket)
#   - Trivy             -> scan de vulnérabilités de l'image
#   - Plugins Jenkins   -> liste dans plugins.txt
FROM jenkins/jenkins:lts-jdk21

USER root

# Node.js 22 copié depuis l'image officielle Node (pas de script "curl | bash")
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# Docker CLI (dépôt officiel Docker) et Trivy (dépôt officiel Aqua Security)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg openssl \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
      > /etc/apt/sources.list.d/docker.list \
 && curl -fsSL https://aquasecurity.github.io/trivy-repo/deb/public.key | gpg --dearmor -o /etc/apt/keyrings/trivy.gpg \
 && echo "deb [signed-by=/etc/apt/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb generic main" \
      > /etc/apt/sources.list.d/trivy.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends docker-ce-cli docker-buildx-plugin trivy \
 && rm -rf /var/lib/apt/lists/*

USER jenkins

# Plugins installés au build de l'image (reproductible, pas de clic dans l'interface)
COPY --chown=jenkins:jenkins plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt
