#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VocabAppStack } from '../lib/vocab-app-stack';

const app = new cdk.App();

// Development Environment
new VocabAppStack(app, 'VocabAppDevStack', {
  environment: 'dev',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});

// Production Environment
new VocabAppStack(app, 'VocabAppProdStack', {
  environment: 'prod',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});