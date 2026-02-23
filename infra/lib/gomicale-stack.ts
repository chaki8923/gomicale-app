import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as destinations from 'aws-cdk-lib/aws-lambda-destinations'
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import { Construct } from 'constructs'
import * as path from 'path'

export interface GomicaleStackProps extends cdk.StackProps {
  env: cdk.Environment
}

export class GomicaleStack extends cdk.Stack {
  public readonly processorFunction: lambda.Function

  constructor(scope: Construct, id: string, props: GomicaleStackProps) {
    super(scope, id, props)

    // ── CloudWatch Logs グループ ───────────────────────────────────
    const logGroup = new logs.LogGroup(this, 'ProcessorLogGroup', {
      logGroupName:    '/aws/lambda/gomicale-processor',
      retention:       logs.RetentionDays.ONE_MONTH,
      removalPolicy:   cdk.RemovalPolicy.DESTROY,
    })

    // ── Dead Letter Queue ─────────────────────────────────────────
    const dlq = new sqs.Queue(this, 'ProcessorDLQ', {
      queueName:       'gomicale-processor-dlq',
      retentionPeriod: cdk.Duration.days(14),
      encryption:      sqs.QueueEncryption.KMS_MANAGED,
      visibilityTimeout: cdk.Duration.seconds(330), // Lambda timeout (300s) + バッファ
    })

    // ── IAM Role (最小権限) ───────────────────────────────────────
    const executionRole = new iam.Role(this, 'ProcessorRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    })

    // SSM Parameter Store 読み取り権限
    executionRole.addToPolicy(
      new iam.PolicyStatement({
        actions:   ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: [
          `arn:aws:ssm:${props.env.region}:${props.env.account}:parameter/gomicale/*`,
        ],
      }),
    )

    // DLQ への送信権限
    dlq.grantSendMessages(executionRole)

    // ── Lambda Function ──────────────────────────────────────────
    // 環境変数は SSM からの動的参照ではなく、デプロイ時に設定する
    // 機密値は Lambda 起動時に SSM SDK で取得するか、または
    // Lambda の環境変数として直接 cdk deploy --context で注入する
    this.processorFunction = new lambda.Function(this, 'ProcessorFunction', {
      functionName: 'gomicale-processor',
      runtime:      lambda.Runtime.NODEJS_20_X,
      handler:      'index.handler',
      code:         lambda.Code.fromAsset(
        path.join(__dirname, '../../lambda/dist'),
      ),
      role:         executionRole,
      timeout:      cdk.Duration.minutes(5),
      memorySize:   512,
      logGroup,
      environment: {
        NODE_OPTIONS:              '--enable-source-maps',
        PARSER_PROVIDER:           'gemini',
        R2_BUCKET_NAME:            'gomicale-pdfs',
        // 機密値は CDK デプロイ後に AWS Console か CLI で設定すること:
        //   aws lambda update-function-configuration --function-name gomicale-processor \
        //     --environment Variables="{GEMINI_API_KEY=...,SUPABASE_URL=...,...}"
        GEMINI_API_KEY:            process.env.GEMINI_API_KEY            ?? '',
        SUPABASE_URL:              process.env.SUPABASE_URL               ?? '',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY  ?? '',
        CLOUDFLARE_ACCOUNT_ID:     process.env.CLOUDFLARE_ACCOUNT_ID      ?? '',
        R2_ACCESS_KEY_ID:          process.env.R2_ACCESS_KEY_ID           ?? '',
        R2_SECRET_ACCESS_KEY:      process.env.R2_SECRET_ACCESS_KEY       ?? '',
        GOOGLE_CLIENT_ID:          process.env.GOOGLE_CLIENT_ID           ?? '',
        GOOGLE_CLIENT_SECRET:      process.env.GOOGLE_CLIENT_SECRET       ?? '',
      },
    })

    // 非同期呼び出し失敗時に DLQ へ送信
    new lambda.EventInvokeConfig(this, 'ProcessorEventInvokeConfig', {
      function:    this.processorFunction,
      maxEventAge: cdk.Duration.hours(1),
      retryAttempts: 1,
      onFailure:   new destinations.SqsDestination(dlq),
    })

    // ── Next.js (Vercel) から InvokeFunction できる IAM User ───────
    const invokerUser = new iam.User(this, 'LambdaInvokerUser', {
      userName: 'gomicale-lambda-invoker',
    })
    invokerUser.addToPolicy(
      new iam.PolicyStatement({
        actions:   ['lambda:InvokeFunction'],
        resources: [this.processorFunction.functionArn],
      }),
    )
    const invokerAccessKey = new iam.CfnAccessKey(this, 'InvokerAccessKey', {
      userName: invokerUser.userName,
    })

    // ── Outputs ──────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'LambdaFunctionArn', {
      value:       this.processorFunction.functionArn,
      description: 'Lambda function ARN',
    })
    new cdk.CfnOutput(this, 'InvokerAccessKeyId', {
      value:       invokerAccessKey.ref,
      description: 'AWS_LAMBDA_ACCESS_KEY_ID for Next.js .env',
    })
    new cdk.CfnOutput(this, 'InvokerSecretKey', {
      value:       invokerAccessKey.attrSecretAccessKey,
      description: 'AWS_LAMBDA_SECRET_ACCESS_KEY for Next.js .env',
    })
  }
}
