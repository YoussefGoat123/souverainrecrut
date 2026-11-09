// ==========================================================
// Pipeline CI – SouverainRecrut Backend
// ==========================================================
// Branche Dev -> install -> Prisma -> tests -> SonarQube + Quality Gate
//             -> build image -> scan Trivy -> push Docker Hub
// L'image n'est publiée que si TOUTES les étapes précédentes réussissent.
//
// Prérequis Jenkins (voir jenkins/ et process/04-jenkins.md) :
//   - credentials : 'sonar-token' (Secret text), 'dockerhub' (Username + access token)
//   - serveur SonarQube 'sonarqube' et outil 'sonar-scanner'
//   - webhook SonarQube -> http://jenkins:8080/sonarqube-webhook/
// ==========================================================

pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '10'))
    timeout(time: 30, unit: 'MINUTES')
  }

  triggers {
    // Jenkins tourne en local (injoignable par un webhook GitHub) :
    // il interroge le dépôt toutes les 5 minutes et lance un build à chaque nouveau commit.
    pollSCM('H/5 * * * *')
  }

  environment {
    IMAGE_NAME       = 'jogoat123/souverainrecrut-backend'
    // Caches conservés dans le volume jenkins_home : builds plus rapides
    NPM_CONFIG_CACHE = '/var/jenkins_home/.cache/npm'
    TRIVY_CACHE_DIR  = '/var/jenkins_home/.cache/trivy'
  }

  stages {

    stage('Init') {
      steps {
        script {
          // Tag traçable : version applicative + identifiant court du commit (ex. 1.0.0-a1b2c3d)
          env.APP_VERSION = sh(script: "node -p \"require('./backend/package.json').version\"", returnStdout: true).trim()
          env.GIT_SHA     = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
          env.IMAGE_TAG   = "${env.APP_VERSION}-${env.GIT_SHA.substring(0, 7)}"
        }
        echo "Commit ${GIT_SHA} -> image ${IMAGE_NAME}:${IMAGE_TAG}"
        sh 'node -v && npm -v && docker --version && trivy --version | head -1'
      }
    }

    stage('Install') {
      steps {
        dir('backend') {
          sh 'npm ci'
        }
      }
    }

    stage('Prisma generate') {
      steps {
        dir('backend') {
          sh 'npx prisma generate'
        }
      }
    }

    stage('Tests') {
      steps {
        dir('backend') {
          sh 'npm run test:coverage'
        }
      }
      post {
        always {
          junit testResults: 'backend/reports/junit.xml', allowEmptyResults: false
          archiveArtifacts artifacts: 'backend/coverage/lcov-report/**', allowEmptyArchive: true
        }
      }
    }

    stage('SonarQube') {
      steps {
        dir('backend') {
          withSonarQubeEnv('sonarqube') {
            sh "${tool 'sonar-scanner'}/bin/sonar-scanner -Dsonar.projectVersion=${APP_VERSION}"
          }
        }
      }
    }

    stage('Quality Gate') {
      steps {
        // Attend le résultat envoyé par le webhook SonarQube ; FAILED => pipeline arrêté
        timeout(time: 5, unit: 'MINUTES') {
          waitForQualityGate abortPipeline: true
        }
      }
    }

    stage('Build image') {
      steps {
        dir('backend') {
          sh """
            docker build \
              --build-arg VERSION=${APP_VERSION} \
              --build-arg REVISION=${GIT_SHA} \
              -t ${IMAGE_NAME}:${IMAGE_TAG} .
          """
        }
      }
    }

    stage('Trivy scan') {
      steps {
        sh 'mkdir -p reports'
        // 1) Rapport complet HIGH + CRITICAL, archivé (n'arrête pas le pipeline)
        sh "trivy image --no-progress --severity HIGH,CRITICAL --format table --output reports/trivy-report.txt ${IMAGE_NAME}:${IMAGE_TAG}"
        // 2) Seuil bloquant : aucune vulnérabilité CRITICAL ayant un correctif disponible
        sh "trivy image --no-progress --severity CRITICAL --ignore-unfixed --exit-code 1 ${IMAGE_NAME}:${IMAGE_TAG}"
      }
      post {
        always {
          archiveArtifacts artifacts: 'reports/trivy-report.txt', allowEmptyArchive: true
        }
      }
    }

    stage('Push Docker Hub') {
      steps {
        // Le token est injecté et masqué dans les logs ; guillemets simples => pas d'interpolation Groovy du secret
        withCredentials([usernamePassword(credentialsId: 'dockerhub',
                                          usernameVariable: 'DH_USER',
                                          passwordVariable: 'DH_TOKEN')]) {
          sh '''
            echo "$DH_TOKEN" | docker login -u "$DH_USER" --password-stdin
            docker push "$IMAGE_NAME:$IMAGE_TAG"
          '''
        }
      }
    }
  }

  post {
    success {
      echo "Image publiée : ${IMAGE_NAME}:${IMAGE_TAG}"
    }
    failure {
      echo 'Pipeline en échec : image NON publiée.'
    }
    always {
      sh 'docker logout || true'
      sh "docker image rm ${IMAGE_NAME}:${env.IMAGE_TAG ?: 'none'} || true"
      cleanWs()
    }
  }
}
