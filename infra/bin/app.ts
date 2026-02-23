#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { GomicaleStack } from '../lib/gomicale-stack'

const app = new cdk.App()

new GomicaleStack(app, 'GomicaleStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region:  process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
  },
  description: 'Gomicale - ゴミ出しカレンダー自動登録サービス',
  tags: {
    Project:     'gomicale',
    Environment: 'production',
  },
})
