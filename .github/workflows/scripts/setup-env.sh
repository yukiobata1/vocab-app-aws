#!/bin/bash

# Environment setup script for CI/CD
# This script sets up environment-specific configurations

set -e

ENVIRONMENT=$1
if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <environment>"
    echo "Example: $0 dev"
    exit 1
fi

echo "🔧 Setting up environment: $ENVIRONMENT"

# Set AWS CDK context for the environment
case $ENVIRONMENT in
    "dev")
        export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
        export CDK_DEFAULT_REGION=ap-northeast-1
        export STACK_NAME="VocabAppDevStack"
        ;;
    "prod")
        export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
        export CDK_DEFAULT_REGION=ap-northeast-1
        export STACK_NAME="VocabAppProdStack"
        ;;
    *)
        echo "❌ Unknown environment: $ENVIRONMENT"
        exit 1
        ;;
esac

echo "✅ Environment configured:"
echo "   Account: $CDK_DEFAULT_ACCOUNT"
echo "   Region: $CDK_DEFAULT_REGION" 
echo "   Stack: $STACK_NAME"

# Export variables for use in subsequent steps
echo "CDK_DEFAULT_ACCOUNT=$CDK_DEFAULT_ACCOUNT" >> $GITHUB_ENV
echo "CDK_DEFAULT_REGION=$CDK_DEFAULT_REGION" >> $GITHUB_ENV
echo "STACK_NAME=$STACK_NAME" >> $GITHUB_ENV