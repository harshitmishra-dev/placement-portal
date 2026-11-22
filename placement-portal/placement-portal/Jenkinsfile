pipeline {
    agent any

    environment {
        IMAGE_NAME = 'placement-portal'
        IMAGE_TAG  = "${env.BUILD_NUMBER}"
    }

    stages {
        stage('Checkout') {
            steps { checkout scm }
        }
        stage('Lint') {
            steps { sh 'docker run --rm -v "$PWD":/app -w /app node:20-alpine npm run lint' }
        }
        stage('Test') {
            steps { sh 'docker run --rm -v "$PWD":/app -w /app node:20-alpine npm test' }
        }
        stage('Build Docker Image') {
            steps {
                sh 'docker build -t $IMAGE_NAME:$IMAGE_TAG -t $IMAGE_NAME:latest .'
            }
        }
        stage('Deploy') {
            steps {
                sh '''
                    docker rm -f placement-portal || true
                    docker run -d --name placement-portal -p 3000:3000 \
                        -v portal-data:/app/data $IMAGE_NAME:latest
                '''
            }
        }
        stage('Smoke Test') {
            steps {
                sh 'sleep 5 && curl -f http://localhost:3000/health'
            }
        }
    }

    post {
        success { echo "Build #${env.BUILD_NUMBER} deployed successfully" }
        failure { echo 'Pipeline failed - check the stage logs' }
        always  { sh 'docker image prune -f || true' }
    }
}
