import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface VocabAppStackProps extends cdk.StackProps {
  environment: 'dev' | 'prod';
}

export class VocabAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: VocabAppStackProps) {
    super(scope, id, props);

    const { environment } = props;

    // VPC for Aurora
    const vpc = new ec2.Vpc(this, `VocabApp-VPC-${environment}`, {
      maxAzs: 2,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: `VocabApp-Public-${environment}`,
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: `VocabApp-Private-${environment}`,
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: `VocabApp-DB-${environment}`,
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Security Group for Aurora
    const dbSecurityGroup = new ec2.SecurityGroup(this, `VocabApp-DB-SG-${environment}`, {
      vpc,
      description: `Security group for VocabApp Aurora cluster (${environment})`,
      allowAllOutbound: false,
    });

    // Allow PostgreSQL/Aurora connections from VPC
    dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL connections from VPC'
    );


    // Database credentials secret
    const dbSecret = new secretsmanager.Secret(this, `VocabApp-DB-Secret-${environment}`, {
      description: `Database credentials for VocabApp (${environment})`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'vocabadmin' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\\'',
        includeSpace: false,
        passwordLength: 32,
      },
    });

    // Database subnet group
    const dbSubnetGroup = new rds.SubnetGroup(this, `VocabApp-DB-SubnetGroup-${environment}`, {
      vpc,
      description: `Subnet group for VocabApp Aurora cluster (${environment})`,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    });

    // Aurora Serverless v2 Cluster
    const cluster = new rds.DatabaseCluster(this, `VocabApp-Aurora-${environment}`, {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      credentials: rds.Credentials.fromSecret(dbSecret),
      writer: rds.ClusterInstance.serverlessV2(`VocabApp-Writer-${environment}`, {
        scaleWithWriter: true,
      }),
      readers: [],
      serverlessV2MinCapacity: environment === 'dev' ? 0.5 : 1,
      serverlessV2MaxCapacity: environment === 'dev' ? 2 : 16,
      vpc,
      securityGroups: [dbSecurityGroup],
      subnetGroup: dbSubnetGroup,
      defaultDatabaseName: 'vocabapp',
      backup: {
        retention: environment === 'prod' ? cdk.Duration.days(7) : cdk.Duration.days(3),
        preferredWindow: '03:00-04:00',
      },
      preferredMaintenanceWindow: 'Sun:04:00-Sun:05:00',
      deletionProtection: environment === 'prod',
      storageEncrypted: true,
    });

    // RDS Proxy for secure database access
    const proxyRole = new iam.Role(this, `VocabApp-Proxy-Role-${environment}`, {
      assumedBy: new iam.ServicePrincipal('rds.amazonaws.com'),
    });

    // Grant proxy access to the secret
    dbSecret.grantRead(proxyRole);

    const proxy = new rds.DatabaseProxy(this, `VocabApp-Proxy-${environment}`, {
      proxyTarget: rds.ProxyTarget.fromCluster(cluster),
      secrets: [dbSecret],
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [dbSecurityGroup],
      role: proxyRole,
      requireTLS: false, // Set to true in production
      idleClientTimeout: cdk.Duration.minutes(30),
      maxConnectionsPercent: 50,
      maxIdleConnectionsPercent: 10,
    });

    // DynamoDB Table for Quiz Rooms
    const quizRoomsTable = new dynamodb.Table(this, `VocabApp-QuizRooms-${environment}`, {
      tableName: `VocabApp-QuizRooms-${environment}`,
      partitionKey: {
        name: 'roomCode',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: environment === 'prod',
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI for querying by createdBy (teacher)
    quizRoomsTable.addGlobalSecondaryIndex({
      indexName: 'CreatedByIndex',
      partitionKey: {
        name: 'createdBy',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Outputs
    new cdk.CfnOutput(this, `DBEndpoint`, {
      value: cluster.clusterEndpoint.hostname,
      description: `Aurora cluster endpoint for ${environment}`,
    });

    new cdk.CfnOutput(this, `DBReadEndpoint`, {
      value: cluster.clusterReadEndpoint.hostname,
      description: `Aurora cluster read endpoint for ${environment}`,
    });

    new cdk.CfnOutput(this, `DBSecret`, {
      value: dbSecret.secretArn,
      description: `Database credentials secret ARN for ${environment}`,
    });

    new cdk.CfnOutput(this, `VPCId`, {
      value: vpc.vpcId,
      description: `VPC ID for ${environment}`,
    });

    new cdk.CfnOutput(this, `ProxyEndpoint`, {
      value: proxy.endpoint,
      description: `RDS Proxy endpoint for ${environment}`,
    });


    // Security Group for Lambda functions
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, `VocabApp-Lambda-SG-${environment}`, {
      vpc,
      description: `Security group for VocabApp Lambda functions (${environment})`,
      allowAllOutbound: true,
    });

    // Common Lambda environment variables
    const lambdaEnvironment = {
      SECRET_ARN: dbSecret.secretArn,
      PROXY_ENDPOINT: proxy.endpoint,
      DB_NAME: 'vocabapp',
      ENVIRONMENT: environment,
      QUIZ_ROOMS_TABLE: quizRoomsTable.tableName,
    };

    // Common Lambda configuration
    const lambdaConfig = {
      runtime: lambda.Runtime.PYTHON_3_9,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [lambdaSecurityGroup],
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: lambdaEnvironment,
      layers: [
        new lambda.LayerVersion(this, `VocabApp-Psycopg2-Layer-${environment}`, {
          code: lambda.Code.fromAsset('lambda-layers/psycopg2'),
          compatibleRuntimes: [lambda.Runtime.PYTHON_3_9],
          description: 'psycopg2 layer for PostgreSQL connectivity',
        }),
      ],
    };

    // API Lambda Functions
    const getVocabLambda = new lambda.Function(this, `VocabApp-GetVocab-${environment}`, {
      ...lambdaConfig,
      handler: 'get_vocab.lambda_handler',
      code: lambda.Code.fromAsset('lambda/api'),
      description: 'Get vocabulary words and questions',
    });

    const createVocabLambda = new lambda.Function(this, `VocabApp-CreateVocab-${environment}`, {
      ...lambdaConfig,
      handler: 'create_vocab.lambda_handler',
      code: lambda.Code.fromAsset('lambda/api'),
      description: 'Create vocabulary books and questions',
    });

    const updateVocabLambda = new lambda.Function(this, `VocabApp-UpdateVocab-${environment}`, {
      ...lambdaConfig,
      handler: 'update_vocab.lambda_handler',
      code: lambda.Code.fromAsset('lambda/api'),
      description: 'Update vocabulary words and progress',
    });

    const migrateLambda = new lambda.Function(this, `VocabApp-Migrate-${environment}`, {
      ...lambdaConfig,
      handler: 'migrate.lambda_handler',
      code: lambda.Code.fromAsset('lambda/api'),
      description: 'Run database migrations',
      timeout: cdk.Duration.minutes(5),
    });

    // Data import Lambda (for dev environment)
    if (environment === 'dev') {
      const importLambda = new lambda.Function(this, `VocabApp-Import-Lambda-${environment}`, {
        ...lambdaConfig,
        handler: 'vocab-import.lambda_handler',
        code: lambda.Code.fromAsset('lambda'),
        timeout: cdk.Duration.minutes(15),
        memorySize: 512,
        description: 'Import vocabulary data from files',
      });

      dbSecret.grantRead(importLambda);

      new cdk.CfnOutput(this, `ImportLambdaName`, {
        value: importLambda.functionName,
        description: `Import Lambda function name for ${environment}`,
      });

      // Cleanup Lambda for deleting small vocabulary books
      const cleanupLambda = new lambda.Function(this, `VocabApp-Cleanup-Lambda-${environment}`, {
        ...lambdaConfig,
        handler: 'cleanup_small_books.lambda_handler',
        code: lambda.Code.fromAsset('lambda'),
        timeout: cdk.Duration.minutes(5),
        memorySize: 256,
        description: 'Cleanup vocabulary books with few questions',
      });

      dbSecret.grantRead(cleanupLambda);

      new cdk.CfnOutput(this, `CleanupLambdaName`, {
        value: cleanupLambda.functionName,
        description: `Cleanup Lambda function name for ${environment}`,
      });
    }

    // Room code Lambda functions (DynamoDB only, no VPC needed)
    const roomCodeLambdaConfig = {
      runtime: lambda.Runtime.PYTHON_3_9,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        QUIZ_ROOMS_TABLE: quizRoomsTable.tableName,
        ENVIRONMENT: environment,
      },
    };

    const createRoomLambda = new lambda.Function(this, `VocabApp-CreateRoom-${environment}`, {
      ...roomCodeLambdaConfig,
      handler: 'create_room.lambda_handler',
      code: lambda.Code.fromAsset('lambda/rooms'),
      description: 'Create quiz room with room code',
    });

    const getRoomLambda = new lambda.Function(this, `VocabApp-GetRoom-${environment}`, {
      ...roomCodeLambdaConfig,
      handler: 'get_room.lambda_handler',
      code: lambda.Code.fromAsset('lambda/rooms'),
      description: 'Get quiz room by room code',
    });

    const joinRoomLambda = new lambda.Function(this, `VocabApp-JoinRoom-${environment}`, {
      ...roomCodeLambdaConfig,
      handler: 'join_room.lambda_handler',
      code: lambda.Code.fromAsset('lambda/rooms'),
      description: 'Join quiz room',
    });

    const deleteRoomLambda = new lambda.Function(this, `VocabApp-DeleteRoom-${environment}`, {
      ...roomCodeLambdaConfig,
      handler: 'delete_room.lambda_handler',
      code: lambda.Code.fromAsset('lambda/rooms'),
      description: 'Delete quiz room',
    });

    const getRoomStatsLambda = new lambda.Function(this, `VocabApp-GetRoomStats-${environment}`, {
      ...roomCodeLambdaConfig,
      handler: 'get_room_stats.lambda_handler',
      code: lambda.Code.fromAsset('lambda/rooms'),
      description: 'Get quiz room statistics',
    });

    // Grant DynamoDB permissions to room Lambda functions
    const roomLambdas = [createRoomLambda, getRoomLambda, joinRoomLambda, deleteRoomLambda, getRoomStatsLambda];
    roomLambdas.forEach(fn => {
      quizRoomsTable.grantReadWriteData(fn);
    });

    // Grant Lambda functions access to the database secret
    [getVocabLambda, createVocabLambda, updateVocabLambda, migrateLambda].forEach(fn => {
      dbSecret.grantRead(fn);
    });

    new cdk.CfnOutput(this, `GetVocabLambdaName`, {
      value: getVocabLambda.functionName,
      description: `Get Vocab Lambda function name for ${environment}`,
    });

    new cdk.CfnOutput(this, `CreateVocabLambdaName`, {
      value: createVocabLambda.functionName,
      description: `Create Vocab Lambda function name for ${environment}`,
    });

    new cdk.CfnOutput(this, `UpdateVocabLambdaName`, {
      value: updateVocabLambda.functionName,
      description: `Update Vocab Lambda function name for ${environment}`,
    });

    new cdk.CfnOutput(this, `MigrateLambdaName`, {
      value: migrateLambda.functionName,
      description: `Migrate Lambda function name for ${environment}`,
    });

    // API Gateway REST API
    const api = new apigateway.RestApi(this, `VocabApp-API-${environment}`, {
      restApiName: `VocabApp API (${environment})`,
      description: `Vocabulary app REST API for ${environment} environment`,
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
      },
      deployOptions: {
        stageName: environment,
      },
    });

    // API Gateway Lambda integrations
    const getVocabIntegration = new apigateway.LambdaIntegration(getVocabLambda, {
      proxy: true,
    });

    const createVocabIntegration = new apigateway.LambdaIntegration(createVocabLambda, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    const updateVocabIntegration = new apigateway.LambdaIntegration(updateVocabLambda, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    const migrateIntegration = new apigateway.LambdaIntegration(migrateLambda, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    // Room Lambda integrations
    const createRoomIntegration = new apigateway.LambdaIntegration(createRoomLambda, {
      proxy: true,
    });

    const getRoomIntegration = new apigateway.LambdaIntegration(getRoomLambda, {
      proxy: true,
    });

    const joinRoomIntegration = new apigateway.LambdaIntegration(joinRoomLambda, {
      proxy: true,
    });

    const deleteRoomIntegration = new apigateway.LambdaIntegration(deleteRoomLambda, {
      proxy: true,
    });

    const getRoomStatsIntegration = new apigateway.LambdaIntegration(getRoomStatsLambda, {
      proxy: true,
    });

    // API Routes
    const vocabResource = api.root.addResource('vocab');
    
    // GET /vocab - Get books or questions
    vocabResource.addMethod('GET', getVocabIntegration);

    // POST /vocab - Create books or questions
    vocabResource.addMethod('POST', createVocabIntegration);

    // PUT /vocab - Update books or questions
    vocabResource.addMethod('PUT', updateVocabIntegration);

    // POST /migrate - Run database migrations
    const migrateResource = api.root.addResource('migrate');
    migrateResource.addMethod('POST', migrateIntegration);

    // Room API routes
    const roomResource = api.root.addResource('room');
    
    // POST /room - Create room
    roomResource.addMethod('POST', createRoomIntegration);
    
    // GET /room/{roomCode} - Get room
    const roomCodeResource = roomResource.addResource('{roomCode}');
    roomCodeResource.addMethod('GET', getRoomIntegration);
    
    // DELETE /room/{roomCode} - Delete room
    roomCodeResource.addMethod('DELETE', deleteRoomIntegration);
    
    // POST /room/{roomCode}/join - Join room
    const joinRoomResource = roomCodeResource.addResource('join');
    joinRoomResource.addMethod('POST', joinRoomIntegration);
    
    // GET /room/{roomCode}/stats - Get room stats
    const roomStatsResource = roomCodeResource.addResource('stats');
    roomStatsResource.addMethod('GET', getRoomStatsIntegration);

    // API Gateway outputs
    new cdk.CfnOutput(this, `APIGatewayURL`, {
      value: api.url,
      description: `API Gateway URL for ${environment}`,
    });

    new cdk.CfnOutput(this, `APIGatewayId`, {
      value: api.restApiId,
      description: `API Gateway ID for ${environment}`,
    });

    new cdk.CfnOutput(this, `QuizRoomsTableName`, {
      value: quizRoomsTable.tableName,
      description: `DynamoDB table name for quiz rooms (${environment})`,
    });

    // Room Lambda function outputs
    new cdk.CfnOutput(this, `CreateRoomLambdaName`, {
      value: createRoomLambda.functionName,
      description: `Create room Lambda function name for ${environment}`,
    });

    new cdk.CfnOutput(this, `GetRoomLambdaName`, {
      value: getRoomLambda.functionName,
      description: `Get room Lambda function name for ${environment}`,
    });

    // S3 bucket for frontend hosting
    const frontendBucket = new s3.Bucket(this, `VocabApp-Frontend-${environment}`, {
      bucketName: `vocab-app-frontend-${environment}-${cdk.Aws.ACCOUNT_ID}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // For SPA routing
      publicReadAccess: true,
      blockPublicAccess: {
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      },
      removalPolicy: environment === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: environment === 'dev',
    });

    // CloudFront distribution for global CDN
    const distribution = new cloudfront.Distribution(this, `VocabApp-CloudFront-${environment}`, {
      defaultBehavior: {
        origin: new origins.S3Origin(frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html', // For SPA routing
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
      comment: `VocabApp Frontend Distribution (${environment})`,
    });

    // Deploy frontend build to S3 (will be built separately)
    // Note: Frontend needs to be built first with: npm run build
    const frontendDeployment = new s3deploy.BucketDeployment(this, `VocabApp-Frontend-Deploy-${environment}`, {
      sources: [s3deploy.Source.asset('../frontend/dist')],
      destinationBucket: frontendBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // Frontend outputs
    new cdk.CfnOutput(this, `FrontendBucketName`, {
      value: frontendBucket.bucketName,
      description: `S3 bucket name for frontend (${environment})`,
    });

    new cdk.CfnOutput(this, `FrontendURL`, {
      value: `https://${distribution.distributionDomainName}`,
      description: `CloudFront URL for frontend (${environment})`,
    });

    new cdk.CfnOutput(this, `CloudFrontDistributionId`, {
      value: distribution.distributionId,
      description: `CloudFront distribution ID for ${environment}`,
    });
  }
}