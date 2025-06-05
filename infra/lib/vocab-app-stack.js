"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VocabAppStack = void 0;
const cdk = require("aws-cdk-lib");
const ec2 = require("aws-cdk-lib/aws-ec2");
const rds = require("aws-cdk-lib/aws-rds");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const secretsmanager = require("aws-cdk-lib/aws-secretsmanager");
const iam = require("aws-cdk-lib/aws-iam");
const lambda = require("aws-cdk-lib/aws-lambda");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const s3 = require("aws-cdk-lib/aws-s3");
const cloudfront = require("aws-cdk-lib/aws-cloudfront");
const origins = require("aws-cdk-lib/aws-cloudfront-origins");
const s3deploy = require("aws-cdk-lib/aws-s3-deployment");
class VocabAppStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        dbSecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(5432), 'Allow PostgreSQL connections from VPC');
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
            requireTLS: false,
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
            websiteErrorDocument: 'index.html',
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
exports.VocabAppStack = VocabAppStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidm9jYWItYXBwLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidm9jYWItYXBwLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQywyQ0FBMkM7QUFDM0MsMkNBQTJDO0FBQzNDLHFEQUFxRDtBQUNyRCxpRUFBaUU7QUFDakUsMkNBQTJDO0FBQzNDLGlEQUFpRDtBQUNqRCx5REFBeUQ7QUFDekQseUNBQXlDO0FBQ3pDLHlEQUF5RDtBQUN6RCw4REFBOEQ7QUFDOUQsMERBQTBEO0FBTzFELE1BQWEsYUFBYyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzFDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBeUI7UUFDakUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLFdBQVcsRUFBRSxHQUFHLEtBQUssQ0FBQztRQUU5QixpQkFBaUI7UUFDakIsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxnQkFBZ0IsV0FBVyxFQUFFLEVBQUU7WUFDM0QsTUFBTSxFQUFFLENBQUM7WUFDVCxrQkFBa0IsRUFBRSxJQUFJO1lBQ3hCLGdCQUFnQixFQUFFLElBQUk7WUFDdEIsbUJBQW1CLEVBQUU7Z0JBQ25CO29CQUNFLFFBQVEsRUFBRSxFQUFFO29CQUNaLElBQUksRUFBRSxtQkFBbUIsV0FBVyxFQUFFO29CQUN0QyxVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNO2lCQUNsQztnQkFDRDtvQkFDRSxRQUFRLEVBQUUsRUFBRTtvQkFDWixJQUFJLEVBQUUsb0JBQW9CLFdBQVcsRUFBRTtvQkFDdkMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsbUJBQW1CO2lCQUMvQztnQkFDRDtvQkFDRSxRQUFRLEVBQUUsRUFBRTtvQkFDWixJQUFJLEVBQUUsZUFBZSxXQUFXLEVBQUU7b0JBQ2xDLFVB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QUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDckMsS0FBSyxFQUFFLFdBQVcsWUFBWSxDQUFDLHNCQUFzQixFQUFFO1lBQ3ZELFdBQVcsRUFBRSxnQ0FBZ0MsV0FBVyxHQUFHO1NBQzVELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsMEJBQTBCLEVBQUU7WUFDbEQsS0FBSyxFQUFFLFlBQVksQ0FBQyxjQUFjO1lBQ2xDLFdBQVcsRUFBRSxrQ0FBa0MsV0FBVyxFQUFFO1NBQzdELENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQWxoQkQsc0NBa2hCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyByZHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXJkcyc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcbmltcG9ydCAqIGFzIHMzZGVwbG95IGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMy1kZXBsb3ltZW50JztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFZvY2FiQXBwU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgZW52aXJvbm1lbnQ6ICdkZXYnIHwgJ3Byb2QnO1xufVxuXG5leHBvcnQgY2xhc3MgVm9jYWJBcHBTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBWb2NhYkFwcFN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgZW52aXJvbm1lbnQgfSA9IHByb3BzO1xuXG4gICAgLy8gVlBDIGZvciBBdXJvcmFcbiAgICBjb25zdCB2cGMgPSBuZXcgZWMyLlZwYyh0aGlzLCBgVm9jYWJBcHAtVlBDLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgbWF4QXpzOiAyLFxuICAgICAgZW5hYmxlRG5zSG9zdG5hbWVzOiB0cnVlLFxuICAgICAgZW5hYmxlRG5zU3VwcG9ydDogdHJ1ZSxcbiAgICAgIHN1Ym5ldENvbmZpZ3VyYXRpb246IFtcbiAgICAgICAge1xuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcbiAgICAgICAgICBuYW1lOiBgVm9jYWJBcHAtUHVibGljLSR7ZW52aXJvbm1lbnR9YCxcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QVUJMSUMsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBjaWRyTWFzazogMjQsXG4gICAgICAgICAgbmFtZTogYFZvY2FiQXBwLVByaXZhdGUtJHtlbnZpcm9ubWVudH1gLFxuICAgICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBjaWRyTWFzazogMjQsXG4gICAgICAgICAgbmFtZTogYFZvY2FiQXBwLURCLSR7ZW52aXJvbm1lbnR9YCxcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVELFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIFNlY3VyaXR5IEdyb3VwIGZvciBBdXJvcmFcbiAgICBjb25zdCBkYlNlY3VyaXR5R3JvdXAgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgYFZvY2FiQXBwLURCLVNHLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgdnBjLFxuICAgICAgZGVzY3JpcHRpb246IGBTZWN1cml0eSBncm91cCBmb3IgVm9jYWJBcHAgQXVyb3JhIGNsdXN0ZXIgKCR7ZW52aXJvbm1lbnR9KWAsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiBmYWxzZSxcbiAgICB9KTtcblxuICAgIC8vIEFsbG93IFBvc3RncmVTUUwvQXVyb3JhIGNvbm5lY3Rpb25zIGZyb20gVlBDXG4gICAgZGJTZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgZWMyLlBlZXIuaXB2NCh2cGMudnBjQ2lkckJsb2NrKSxcbiAgICAgIGVjMi5Qb3J0LnRjcCg1NDMyKSxcbiAgICAgICdBbGxvdyBQb3N0Z3JlU1FMIGNvbm5lY3Rpb25zIGZyb20gVlBDJ1xuICAgICk7XG5cblxuICAgIC8vIERhdGFiYXNlIGNyZWRlbnRpYWxzIHNlY3JldFxuICAgIGNvbnN0IGRiU2VjcmV0ID0gbmV3IHNlY3JldHNtYW5hZ2VyLlNlY3JldCh0aGlzLCBgVm9jYWJBcHAtREItU2VjcmV0LSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgZGVzY3JpcHRpb246IGBEYXRhYmFzZSBjcmVkZW50aWFscyBmb3IgVm9jYWJBcHAgKCR7ZW52aXJvbm1lbnR9KWAsXG4gICAgICBnZW5lcmF0ZVNlY3JldFN0cmluZzoge1xuICAgICAgICBzZWNyZXRTdHJpbmdUZW1wbGF0ZTogSlNPTi5zdHJpbmdpZnkoeyB1c2VybmFtZTogJ3ZvY2FiYWRtaW4nIH0pLFxuICAgICAgICBnZW5lcmF0ZVN0cmluZ0tleTogJ3Bhc3N3b3JkJyxcbiAgICAgICAgZXhjbHVkZUNoYXJhY3RlcnM6ICdcIkAvXFxcXFxcJycsXG4gICAgICAgIGluY2x1ZGVTcGFjZTogZmFsc2UsXG4gICAgICAgIHBhc3N3b3JkTGVuZ3RoOiAzMixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBEYXRhYmFzZSBzdWJuZXQgZ3JvdXBcbiAgICBjb25zdCBkYlN1Ym5ldEdyb3VwID0gbmV3IHJkcy5TdWJuZXRHcm91cCh0aGlzLCBgVm9jYWJBcHAtREItU3VibmV0R3JvdXAtJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgICB2cGMsXG4gICAgICBkZXNjcmlwdGlvbjogYFN1Ym5ldCBncm91cCBmb3IgVm9jYWJBcHAgQXVyb3JhIGNsdXN0ZXIgKCR7ZW52aXJvbm1lbnR9KWAsXG4gICAgICB2cGNTdWJuZXRzOiB7XG4gICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfSVNPTEFURUQsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQXVyb3JhIFNlcnZlcmxlc3MgdjIgQ2x1c3RlclxuICAgIGNvbnN0IGNsdXN0ZXIgPSBuZXcgcmRzLkRhdGFiYXNlQ2x1c3Rlcih0aGlzLCBgVm9jYWJBcHAtQXVyb3JhLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgZW5naW5lOiByZHMuRGF0YWJhc2VDbHVzdGVyRW5naW5lLmF1cm9yYVBvc3RncmVzKHtcbiAgICAgICAgdmVyc2lvbjogcmRzLkF1cm9yYVBvc3RncmVzRW5naW5lVmVyc2lvbi5WRVJfMTVfNCxcbiAgICAgIH0pLFxuICAgICAgY3JlZGVudGlhbHM6IHJkcy5DcmVkZW50aWFscy5mcm9tU2VjcmV0KGRiU2VjcmV0KSxcbiAgICAgIHdyaXRlcjogcmRzLkNsdXN0ZXJJbnN0YW5jZS5zZXJ2ZXJsZXNzVjIoYFZvY2FiQXBwLVdyaXRlci0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgICAgc2NhbGVXaXRoV3JpdGVyOiB0cnVlLFxuICAgICAgfSksXG4gICAgICByZWFkZXJzOiBbXSxcbiAgICAgIHNlcnZlcmxlc3NWMk1pbkNhcGFjaXR5OiBlbnZpcm9ubWVudCA9PT0gJ2RldicgPyAwLjUgOiAxLFxuICAgICAgc2VydmVybGVzc1YyTWF4Q2FwYWNpdHk6IGVudmlyb25tZW50ID09PSAnZGV2JyA/IDIgOiAxNixcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbZGJTZWN1cml0eUdyb3VwXSxcbiAgICAgIHN1Ym5ldEdyb3VwOiBkYlN1Ym5ldEdyb3VwLFxuICAgICAgZGVmYXVsdERhdGFiYXNlTmFtZTogJ3ZvY2FiYXBwJyxcbiAgICAgIGJhY2t1cDoge1xuICAgICAgICByZXRlbnRpb246IGVudmlyb25tZW50ID09PSAncHJvZCcgPyBjZGsuRHVyYXRpb24uZGF5cyg3KSA6IGNkay5EdXJhdGlvbi5kYXlzKDMpLFxuICAgICAgICBwcmVmZXJyZWRXaW5kb3c6ICcwMzowMC0wNDowMCcsXG4gICAgICB9LFxuICAgICAgcHJlZmVycmVkTWFpbnRlbmFuY2VXaW5kb3c6ICdTdW46MDQ6MDAtU3VuOjA1OjAwJyxcbiAgICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogZW52aXJvbm1lbnQgPT09ICdwcm9kJyxcbiAgICAgIHN0b3JhZ2VFbmNyeXB0ZWQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBSRFMgUHJveHkgZm9yIHNlY3VyZSBkYXRhYmFzZSBhY2Nlc3NcbiAgICBjb25zdCBwcm94eVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgYFZvY2FiQXBwLVByb3h5LVJvbGUtJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgncmRzLmFtYXpvbmF3cy5jb20nKSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHByb3h5IGFjY2VzcyB0byB0aGUgc2VjcmV0XG4gICAgZGJTZWNyZXQuZ3JhbnRSZWFkKHByb3h5Um9sZSk7XG5cbiAgICBjb25zdCBwcm94eSA9IG5ldyByZHMuRGF0YWJhc2VQcm94eSh0aGlzLCBgVm9jYWJBcHAtUHJveHktJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgICBwcm94eVRhcmdldDogcmRzLlByb3h5VGFyZ2V0LmZyb21DbHVzdGVyKGNsdXN0ZXIpLFxuICAgICAgc2VjcmV0czogW2RiU2VjcmV0XSxcbiAgICAgIHZwYyxcbiAgICAgIHZwY1N1Ym5ldHM6IHtcbiAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgIH0sXG4gICAgICBzZWN1cml0eUdyb3VwczogW2RiU2VjdXJpdHlHcm91cF0sXG4gICAgICByb2xlOiBwcm94eVJvbGUsXG4gICAgICByZXF1aXJlVExTOiBmYWxzZSwgLy8gU2V0IHRvIHRydWUgaW4gcHJvZHVjdGlvblxuICAgICAgaWRsZUNsaWVudFRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDMwKSxcbiAgICAgIG1heENvbm5lY3Rpb25zUGVyY2VudDogNTAsXG4gICAgICBtYXhJZGxlQ29ubmVjdGlvbnNQZXJjZW50OiAxMCxcbiAgICB9KTtcblxuICAgIC8vIER5bmFtb0RCIFRhYmxlIGZvciBRdWl6IFJvb21zXG4gICAgY29uc3QgcXVpelJvb21zVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgYFZvY2FiQXBwLVF1aXpSb29tcy0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgIHRhYmxlTmFtZTogYFZvY2FiQXBwLVF1aXpSb29tcy0ke2Vudmlyb25tZW50fWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3Jvb21Db2RlJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnLFxuICAgICAgcmVtb3ZhbFBvbGljeTogZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnLFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgc3RyZWFtOiBkeW5hbW9kYi5TdHJlYW1WaWV3VHlwZS5ORVdfQU5EX09MRF9JTUFHRVMsXG4gICAgfSk7XG5cbiAgICAvLyBHU0kgZm9yIHF1ZXJ5aW5nIGJ5IGNyZWF0ZWRCeSAodGVhY2hlcilcbiAgICBxdWl6Um9vbXNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdDcmVhdGVkQnlJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ2NyZWF0ZWRCeScsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ2NyZWF0ZWRBdCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgREJFbmRwb2ludGAsIHtcbiAgICAgIHZhbHVlOiBjbHVzdGVyLmNsdXN0ZXJFbmRwb2ludC5ob3N0bmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgQXVyb3JhIGNsdXN0ZXIgZW5kcG9pbnQgZm9yICR7ZW52aXJvbm1lbnR9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBEQlJlYWRFbmRwb2ludGAsIHtcbiAgICAgIHZhbHVlOiBjbHVzdGVyLmNsdXN0ZXJSZWFkRW5kcG9pbnQuaG9zdG5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogYEF1cm9yYSBjbHVzdGVyIHJlYWQgZW5kcG9pbnQgZm9yICR7ZW52aXJvbm1lbnR9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBEQlNlY3JldGAsIHtcbiAgICAgIHZhbHVlOiBkYlNlY3JldC5zZWNyZXRBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogYERhdGFiYXNlIGNyZWRlbnRpYWxzIHNlY3JldCBBUk4gZm9yICR7ZW52aXJvbm1lbnR9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBWUENJZGAsIHtcbiAgICAgIHZhbHVlOiB2cGMudnBjSWQsXG4gICAgICBkZXNjcmlwdGlvbjogYFZQQyBJRCBmb3IgJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYFByb3h5RW5kcG9pbnRgLCB7XG4gICAgICB2YWx1ZTogcHJveHkuZW5kcG9pbnQsXG4gICAgICBkZXNjcmlwdGlvbjogYFJEUyBQcm94eSBlbmRwb2ludCBmb3IgJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG5cbiAgICAvLyBTZWN1cml0eSBHcm91cCBmb3IgTGFtYmRhIGZ1bmN0aW9uc1xuICAgIGNvbnN0IGxhbWJkYVNlY3VyaXR5R3JvdXAgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgYFZvY2FiQXBwLUxhbWJkYS1TRy0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgIHZwYyxcbiAgICAgIGRlc2NyaXB0aW9uOiBgU2VjdXJpdHkgZ3JvdXAgZm9yIFZvY2FiQXBwIExhbWJkYSBmdW5jdGlvbnMgKCR7ZW52aXJvbm1lbnR9KWAsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gQ29tbW9uIExhbWJkYSBlbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAgICBjb25zdCBsYW1iZGFFbnZpcm9ubWVudCA9IHtcbiAgICAgIFNFQ1JFVF9BUk46IGRiU2VjcmV0LnNlY3JldEFybixcbiAgICAgIFBST1hZX0VORFBPSU5UOiBwcm94eS5lbmRwb2ludCxcbiAgICAgIERCX05BTUU6ICd2b2NhYmFwcCcsXG4gICAgICBFTlZJUk9OTUVOVDogZW52aXJvbm1lbnQsXG4gICAgICBRVUlaX1JPT01TX1RBQkxFOiBxdWl6Um9vbXNUYWJsZS50YWJsZU5hbWUsXG4gICAgfTtcblxuICAgIC8vIENvbW1vbiBMYW1iZGEgY29uZmlndXJhdGlvblxuICAgIGNvbnN0IGxhbWJkYUNvbmZpZyA9IHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzksXG4gICAgICB2cGMsXG4gICAgICB2cGNTdWJuZXRzOiB7XG4gICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MsXG4gICAgICB9LFxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTZWN1cml0eUdyb3VwXSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGVudmlyb25tZW50OiBsYW1iZGFFbnZpcm9ubWVudCxcbiAgICAgIGxheWVyczogW1xuICAgICAgICBuZXcgbGFtYmRhLkxheWVyVmVyc2lvbih0aGlzLCBgVm9jYWJBcHAtUHN5Y29wZzItTGF5ZXItJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEtbGF5ZXJzL3BzeWNvcGcyJyksXG4gICAgICAgICAgY29tcGF0aWJsZVJ1bnRpbWVzOiBbbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfOV0sXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdwc3ljb3BnMiBsYXllciBmb3IgUG9zdGdyZVNRTCBjb25uZWN0aXZpdHknLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfTtcblxuICAgIC8vIEFQSSBMYW1iZGEgRnVuY3Rpb25zXG4gICAgY29uc3QgZ2V0Vm9jYWJMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIGBWb2NhYkFwcC1HZXRWb2NhYi0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGhhbmRsZXI6ICdnZXRfdm9jYWIubGFtYmRhX2hhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvYXBpJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ0dldCB2b2NhYnVsYXJ5IHdvcmRzIGFuZCBxdWVzdGlvbnMnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY3JlYXRlVm9jYWJMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIGBWb2NhYkFwcC1DcmVhdGVWb2NhYi0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGhhbmRsZXI6ICdjcmVhdGVfdm9jYWIubGFtYmRhX2hhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvYXBpJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ0NyZWF0ZSB2b2NhYnVsYXJ5IGJvb2tzIGFuZCBxdWVzdGlvbnMnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdXBkYXRlVm9jYWJMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIGBWb2NhYkFwcC1VcGRhdGVWb2NhYi0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGhhbmRsZXI6ICd1cGRhdGVfdm9jYWIubGFtYmRhX2hhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvYXBpJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ1VwZGF0ZSB2b2NhYnVsYXJ5IHdvcmRzIGFuZCBwcm9ncmVzcycsXG4gICAgfSk7XG5cbiAgICBjb25zdCBtaWdyYXRlTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBgVm9jYWJBcHAtTWlncmF0ZS0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGhhbmRsZXI6ICdtaWdyYXRlLmxhbWJkYV9oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2FwaScpLFxuICAgICAgZGVzY3JpcHRpb246ICdSdW4gZGF0YWJhc2UgbWlncmF0aW9ucycsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIC8vIERhdGEgaW1wb3J0IExhbWJkYSAoZm9yIGRldiBlbnZpcm9ubWVudClcbiAgICBpZiAoZW52aXJvbm1lbnQgPT09ICdkZXYnKSB7XG4gICAgICBjb25zdCBpbXBvcnRMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIGBWb2NhYkFwcC1JbXBvcnQtTGFtYmRhLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICAgIGhhbmRsZXI6ICd2b2NhYi1pbXBvcnQubGFtYmRhX2hhbmRsZXInLFxuICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygxNSksXG4gICAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgICAgZGVzY3JpcHRpb246ICdJbXBvcnQgdm9jYWJ1bGFyeSBkYXRhIGZyb20gZmlsZXMnLFxuICAgICAgfSk7XG5cbiAgICAgIGRiU2VjcmV0LmdyYW50UmVhZChpbXBvcnRMYW1iZGEpO1xuXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgSW1wb3J0TGFtYmRhTmFtZWAsIHtcbiAgICAgICAgdmFsdWU6IGltcG9ydExhbWJkYS5mdW5jdGlvbk5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgSW1wb3J0IExhbWJkYSBmdW5jdGlvbiBuYW1lIGZvciAke2Vudmlyb25tZW50fWAsXG4gICAgICB9KTtcblxuICAgICAgLy8gQ2xlYW51cCBMYW1iZGEgZm9yIGRlbGV0aW5nIHNtYWxsIHZvY2FidWxhcnkgYm9va3NcbiAgICAgIGNvbnN0IGNsZWFudXBMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIGBWb2NhYkFwcC1DbGVhbnVwLUxhbWJkYS0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgICBoYW5kbGVyOiAnY2xlYW51cF9zbWFsbF9ib29rcy5sYW1iZGFfaGFuZGxlcicsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQ2xlYW51cCB2b2NhYnVsYXJ5IGJvb2tzIHdpdGggZmV3IHF1ZXN0aW9ucycsXG4gICAgICB9KTtcblxuICAgICAgZGJTZWNyZXQuZ3JhbnRSZWFkKGNsZWFudXBMYW1iZGEpO1xuXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgQ2xlYW51cExhbWJkYU5hbWVgLCB7XG4gICAgICAgIHZhbHVlOiBjbGVhbnVwTGFtYmRhLmZ1bmN0aW9uTmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246IGBDbGVhbnVwIExhbWJkYSBmdW5jdGlvbiBuYW1lIGZvciAke2Vudmlyb25tZW50fWAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBSb29tIGNvZGUgTGFtYmRhIGZ1bmN0aW9ucyAoRHluYW1vREIgb25seSwgbm8gVlBDIG5lZWRlZClcbiAgICBjb25zdCByb29tQ29kZUxhbWJkYUNvbmZpZyA9IHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzksXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBRVUlaX1JPT01TX1RBQkxFOiBxdWl6Um9vbXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEVOVklST05NRU5UOiBlbnZpcm9ubWVudCxcbiAgICAgIH0sXG4gICAgfTtcblxuICAgIGNvbnN0IGNyZWF0ZVJvb21MYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIGBWb2NhYkFwcC1DcmVhdGVSb29tLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgLi4ucm9vbUNvZGVMYW1iZGFDb25maWcsXG4gICAgICBoYW5kbGVyOiAnY3JlYXRlX3Jvb20ubGFtYmRhX2hhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvcm9vbXMnKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ3JlYXRlIHF1aXogcm9vbSB3aXRoIHJvb20gY29kZScsXG4gICAgfSk7XG5cbiAgICBjb25zdCBnZXRSb29tTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBgVm9jYWJBcHAtR2V0Um9vbS0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgIC4uLnJvb21Db2RlTGFtYmRhQ29uZmlnLFxuICAgICAgaGFuZGxlcjogJ2dldF9yb29tLmxhbWJkYV9oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL3Jvb21zJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ0dldCBxdWl6IHJvb20gYnkgcm9vbSBjb2RlJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGpvaW5Sb29tTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBgVm9jYWJBcHAtSm9pblJvb20tJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgICAuLi5yb29tQ29kZUxhbWJkYUNvbmZpZyxcbiAgICAgIGhhbmRsZXI6ICdqb2luX3Jvb20ubGFtYmRhX2hhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvcm9vbXMnKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnSm9pbiBxdWl6IHJvb20nLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZGVsZXRlUm9vbUxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgYFZvY2FiQXBwLURlbGV0ZVJvb20tJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgICAuLi5yb29tQ29kZUxhbWJkYUNvbmZpZyxcbiAgICAgIGhhbmRsZXI6ICdkZWxldGVfcm9vbS5sYW1iZGFfaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9yb29tcycpLFxuICAgICAgZGVzY3JpcHRpb246ICdEZWxldGUgcXVpeiByb29tJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGdldFJvb21TdGF0c0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgYFZvY2FiQXBwLUdldFJvb21TdGF0cy0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgIC4uLnJvb21Db2RlTGFtYmRhQ29uZmlnLFxuICAgICAgaGFuZGxlcjogJ2dldF9yb29tX3N0YXRzLmxhbWJkYV9oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL3Jvb21zJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ0dldCBxdWl6IHJvb20gc3RhdGlzdGljcycsXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBEeW5hbW9EQiBwZXJtaXNzaW9ucyB0byByb29tIExhbWJkYSBmdW5jdGlvbnNcbiAgICBjb25zdCByb29tTGFtYmRhcyA9IFtjcmVhdGVSb29tTGFtYmRhLCBnZXRSb29tTGFtYmRhLCBqb2luUm9vbUxhbWJkYSwgZGVsZXRlUm9vbUxhbWJkYSwgZ2V0Um9vbVN0YXRzTGFtYmRhXTtcbiAgICByb29tTGFtYmRhcy5mb3JFYWNoKGZuID0+IHtcbiAgICAgIHF1aXpSb29tc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShmbik7XG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBMYW1iZGEgZnVuY3Rpb25zIGFjY2VzcyB0byB0aGUgZGF0YWJhc2Ugc2VjcmV0XG4gICAgW2dldFZvY2FiTGFtYmRhLCBjcmVhdGVWb2NhYkxhbWJkYSwgdXBkYXRlVm9jYWJMYW1iZGEsIG1pZ3JhdGVMYW1iZGFdLmZvckVhY2goZm4gPT4ge1xuICAgICAgZGJTZWNyZXQuZ3JhbnRSZWFkKGZuKTtcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBHZXRWb2NhYkxhbWJkYU5hbWVgLCB7XG4gICAgICB2YWx1ZTogZ2V0Vm9jYWJMYW1iZGEuZnVuY3Rpb25OYW1lLFxuICAgICAgZGVzY3JpcHRpb246IGBHZXQgVm9jYWIgTGFtYmRhIGZ1bmN0aW9uIG5hbWUgZm9yICR7ZW52aXJvbm1lbnR9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBDcmVhdGVWb2NhYkxhbWJkYU5hbWVgLCB7XG4gICAgICB2YWx1ZTogY3JlYXRlVm9jYWJMYW1iZGEuZnVuY3Rpb25OYW1lLFxuICAgICAgZGVzY3JpcHRpb246IGBDcmVhdGUgVm9jYWIgTGFtYmRhIGZ1bmN0aW9uIG5hbWUgZm9yICR7ZW52aXJvbm1lbnR9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBVcGRhdGVWb2NhYkxhbWJkYU5hbWVgLCB7XG4gICAgICB2YWx1ZTogdXBkYXRlVm9jYWJMYW1iZGEuZnVuY3Rpb25OYW1lLFxuICAgICAgZGVzY3JpcHRpb246IGBVcGRhdGUgVm9jYWIgTGFtYmRhIGZ1bmN0aW9uIG5hbWUgZm9yICR7ZW52aXJvbm1lbnR9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBNaWdyYXRlTGFtYmRhTmFtZWAsIHtcbiAgICAgIHZhbHVlOiBtaWdyYXRlTGFtYmRhLmZ1bmN0aW9uTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgTWlncmF0ZSBMYW1iZGEgZnVuY3Rpb24gbmFtZSBmb3IgJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkgUkVTVCBBUElcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsIGBWb2NhYkFwcC1BUEktJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgICByZXN0QXBpTmFtZTogYFZvY2FiQXBwIEFQSSAoJHtlbnZpcm9ubWVudH0pYCxcbiAgICAgIGRlc2NyaXB0aW9uOiBgVm9jYWJ1bGFyeSBhcHAgUkVTVCBBUEkgZm9yICR7ZW52aXJvbm1lbnR9IGVudmlyb25tZW50YCxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IFsnKiddLFxuICAgICAgICBhbGxvd01ldGhvZHM6IFsnR0VUJywgJ1BPU1QnLCAnUFVUJywgJ0RFTEVURScsICdPUFRJT05TJ10sXG4gICAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnWC1BbXotRGF0ZScsICdBdXRob3JpemF0aW9uJywgJ1gtQXBpLUtleScsICdYLUFtei1TZWN1cml0eS1Ub2tlbiddLFxuICAgICAgfSxcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcbiAgICAgICAgc3RhZ2VOYW1lOiBlbnZpcm9ubWVudCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheSBMYW1iZGEgaW50ZWdyYXRpb25zXG4gICAgY29uc3QgZ2V0Vm9jYWJJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGdldFZvY2FiTGFtYmRhLCB7XG4gICAgICBwcm94eTogdHJ1ZSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNyZWF0ZVZvY2FiSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjcmVhdGVWb2NhYkxhbWJkYSwge1xuICAgICAgcmVxdWVzdFRlbXBsYXRlczogeyAnYXBwbGljYXRpb24vanNvbic6ICd7IFwic3RhdHVzQ29kZVwiOiBcIjIwMFwiIH0nIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCB1cGRhdGVWb2NhYkludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odXBkYXRlVm9jYWJMYW1iZGEsIHtcbiAgICAgIHJlcXVlc3RUZW1wbGF0ZXM6IHsgJ2FwcGxpY2F0aW9uL2pzb24nOiAneyBcInN0YXR1c0NvZGVcIjogXCIyMDBcIiB9JyB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgbWlncmF0ZUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obWlncmF0ZUxhbWJkYSwge1xuICAgICAgcmVxdWVzdFRlbXBsYXRlczogeyAnYXBwbGljYXRpb24vanNvbic6ICd7IFwic3RhdHVzQ29kZVwiOiBcIjIwMFwiIH0nIH0sXG4gICAgfSk7XG5cbiAgICAvLyBSb29tIExhbWJkYSBpbnRlZ3JhdGlvbnNcbiAgICBjb25zdCBjcmVhdGVSb29tSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjcmVhdGVSb29tTGFtYmRhLCB7XG4gICAgICBwcm94eTogdHJ1ZSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGdldFJvb21JbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGdldFJvb21MYW1iZGEsIHtcbiAgICAgIHByb3h5OiB0cnVlLFxuICAgIH0pO1xuXG4gICAgY29uc3Qgam9pblJvb21JbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGpvaW5Sb29tTGFtYmRhLCB7XG4gICAgICBwcm94eTogdHJ1ZSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGRlbGV0ZVJvb21JbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGRlbGV0ZVJvb21MYW1iZGEsIHtcbiAgICAgIHByb3h5OiB0cnVlLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZ2V0Um9vbVN0YXRzSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnZXRSb29tU3RhdHNMYW1iZGEsIHtcbiAgICAgIHByb3h5OiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIFJvdXRlc1xuICAgIGNvbnN0IHZvY2FiUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgndm9jYWInKTtcbiAgICBcbiAgICAvLyBHRVQgL3ZvY2FiIC0gR2V0IGJvb2tzIG9yIHF1ZXN0aW9uc1xuICAgIHZvY2FiUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBnZXRWb2NhYkludGVncmF0aW9uKTtcblxuICAgIC8vIFBPU1QgL3ZvY2FiIC0gQ3JlYXRlIGJvb2tzIG9yIHF1ZXN0aW9uc1xuICAgIHZvY2FiUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgY3JlYXRlVm9jYWJJbnRlZ3JhdGlvbik7XG5cbiAgICAvLyBQVVQgL3ZvY2FiIC0gVXBkYXRlIGJvb2tzIG9yIHF1ZXN0aW9uc1xuICAgIHZvY2FiUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCB1cGRhdGVWb2NhYkludGVncmF0aW9uKTtcblxuICAgIC8vIFBPU1QgL21pZ3JhdGUgLSBSdW4gZGF0YWJhc2UgbWlncmF0aW9uc1xuICAgIGNvbnN0IG1pZ3JhdGVSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCdtaWdyYXRlJyk7XG4gICAgbWlncmF0ZVJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG1pZ3JhdGVJbnRlZ3JhdGlvbik7XG5cbiAgICAvLyBSb29tIEFQSSByb3V0ZXNcbiAgICBjb25zdCByb29tUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgncm9vbScpO1xuICAgIFxuICAgIC8vIFBPU1QgL3Jvb20gLSBDcmVhdGUgcm9vbVxuICAgIHJvb21SZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBjcmVhdGVSb29tSW50ZWdyYXRpb24pO1xuICAgIFxuICAgIC8vIEdFVCAvcm9vbS97cm9vbUNvZGV9IC0gR2V0IHJvb21cbiAgICBjb25zdCByb29tQ29kZVJlc291cmNlID0gcm9vbVJlc291cmNlLmFkZFJlc291cmNlKCd7cm9vbUNvZGV9Jyk7XG4gICAgcm9vbUNvZGVSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIGdldFJvb21JbnRlZ3JhdGlvbik7XG4gICAgXG4gICAgLy8gREVMRVRFIC9yb29tL3tyb29tQ29kZX0gLSBEZWxldGUgcm9vbVxuICAgIHJvb21Db2RlUmVzb3VyY2UuYWRkTWV0aG9kKCdERUxFVEUnLCBkZWxldGVSb29tSW50ZWdyYXRpb24pO1xuICAgIFxuICAgIC8vIFBPU1QgL3Jvb20ve3Jvb21Db2RlfS9qb2luIC0gSm9pbiByb29tXG4gICAgY29uc3Qgam9pblJvb21SZXNvdXJjZSA9IHJvb21Db2RlUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2pvaW4nKTtcbiAgICBqb2luUm9vbVJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIGpvaW5Sb29tSW50ZWdyYXRpb24pO1xuICAgIFxuICAgIC8vIEdFVCAvcm9vbS97cm9vbUNvZGV9L3N0YXRzIC0gR2V0IHJvb20gc3RhdHNcbiAgICBjb25zdCByb29tU3RhdHNSZXNvdXJjZSA9IHJvb21Db2RlUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3N0YXRzJyk7XG4gICAgcm9vbVN0YXRzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBnZXRSb29tU3RhdHNJbnRlZ3JhdGlvbik7XG5cbiAgICAvLyBBUEkgR2F0ZXdheSBvdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYEFQSUdhdGV3YXlVUkxgLCB7XG4gICAgICB2YWx1ZTogYXBpLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiBgQVBJIEdhdGV3YXkgVVJMIGZvciAke2Vudmlyb25tZW50fWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgQVBJR2F0ZXdheUlkYCwge1xuICAgICAgdmFsdWU6IGFwaS5yZXN0QXBpSWQsXG4gICAgICBkZXNjcmlwdGlvbjogYEFQSSBHYXRld2F5IElEIGZvciAke2Vudmlyb25tZW50fWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgUXVpelJvb21zVGFibGVOYW1lYCwge1xuICAgICAgdmFsdWU6IHF1aXpSb29tc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgRHluYW1vREIgdGFibGUgbmFtZSBmb3IgcXVpeiByb29tcyAoJHtlbnZpcm9ubWVudH0pYCxcbiAgICB9KTtcblxuICAgIC8vIFJvb20gTGFtYmRhIGZ1bmN0aW9uIG91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgQ3JlYXRlUm9vbUxhbWJkYU5hbWVgLCB7XG4gICAgICB2YWx1ZTogY3JlYXRlUm9vbUxhbWJkYS5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogYENyZWF0ZSByb29tIExhbWJkYSBmdW5jdGlvbiBuYW1lIGZvciAke2Vudmlyb25tZW50fWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgR2V0Um9vbUxhbWJkYU5hbWVgLCB7XG4gICAgICB2YWx1ZTogZ2V0Um9vbUxhbWJkYS5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogYEdldCByb29tIExhbWJkYSBmdW5jdGlvbiBuYW1lIGZvciAke2Vudmlyb25tZW50fWAsXG4gICAgfSk7XG5cbiAgICAvLyBTMyBidWNrZXQgZm9yIGZyb250ZW5kIGhvc3RpbmdcbiAgICBjb25zdCBmcm9udGVuZEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgYFZvY2FiQXBwLUZyb250ZW5kLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgYnVja2V0TmFtZTogYHZvY2FiLWFwcC1mcm9udGVuZC0ke2Vudmlyb25tZW50fS0ke2Nkay5Bd3MuQUNDT1VOVF9JRH1gLFxuICAgICAgd2Vic2l0ZUluZGV4RG9jdW1lbnQ6ICdpbmRleC5odG1sJyxcbiAgICAgIHdlYnNpdGVFcnJvckRvY3VtZW50OiAnaW5kZXguaHRtbCcsIC8vIEZvciBTUEEgcm91dGluZ1xuICAgICAgcHVibGljUmVhZEFjY2VzczogdHJ1ZSxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiB7XG4gICAgICAgIGJsb2NrUHVibGljQWNsczogZmFsc2UsXG4gICAgICAgIGJsb2NrUHVibGljUG9saWN5OiBmYWxzZSxcbiAgICAgICAgaWdub3JlUHVibGljQWNsczogZmFsc2UsXG4gICAgICAgIHJlc3RyaWN0UHVibGljQnVja2V0czogZmFsc2UsXG4gICAgICB9LFxuICAgICAgcmVtb3ZhbFBvbGljeTogZW52aXJvbm1lbnQgPT09ICdkZXYnID8gY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSA6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiBlbnZpcm9ubWVudCA9PT0gJ2RldicsXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBmb3IgZ2xvYmFsIENETlxuICAgIGNvbnN0IGRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCBgVm9jYWJBcHAtQ2xvdWRGcm9udC0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKGZyb250ZW5kQnVja2V0KSxcbiAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0dFVF9IRUFEX09QVElPTlMsXG4gICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfT1BUSU1JWkVELFxuICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OiBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQ09SU19TM19PUklHSU4sXG4gICAgICB9LFxuICAgICAgZGVmYXVsdFJvb3RPYmplY3Q6ICdpbmRleC5odG1sJyxcbiAgICAgIGVycm9yUmVzcG9uc2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDQsXG4gICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJywgLy8gRm9yIFNQQSByb3V0aW5nXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDMsXG4gICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBjb21tZW50OiBgVm9jYWJBcHAgRnJvbnRlbmQgRGlzdHJpYnV0aW9uICgke2Vudmlyb25tZW50fSlgLFxuICAgIH0pO1xuXG4gICAgLy8gRGVwbG95IGZyb250ZW5kIGJ1aWxkIHRvIFMzICh3aWxsIGJlIGJ1aWx0IHNlcGFyYXRlbHkpXG4gICAgLy8gTm90ZTogRnJvbnRlbmQgbmVlZHMgdG8gYmUgYnVpbHQgZmlyc3Qgd2l0aDogbnBtIHJ1biBidWlsZFxuICAgIGNvbnN0IGZyb250ZW5kRGVwbG95bWVudCA9IG5ldyBzM2RlcGxveS5CdWNrZXREZXBsb3ltZW50KHRoaXMsIGBWb2NhYkFwcC1Gcm9udGVuZC1EZXBsb3ktJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgICBzb3VyY2VzOiBbczNkZXBsb3kuU291cmNlLmFzc2V0KCcuLi9mcm9udGVuZC9kaXN0JyldLFxuICAgICAgZGVzdGluYXRpb25CdWNrZXQ6IGZyb250ZW5kQnVja2V0LFxuICAgICAgZGlzdHJpYnV0aW9uLFxuICAgICAgZGlzdHJpYnV0aW9uUGF0aHM6IFsnLyonXSxcbiAgICB9KTtcblxuICAgIC8vIEZyb250ZW5kIG91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgRnJvbnRlbmRCdWNrZXROYW1lYCwge1xuICAgICAgdmFsdWU6IGZyb250ZW5kQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogYFMzIGJ1Y2tldCBuYW1lIGZvciBmcm9udGVuZCAoJHtlbnZpcm9ubWVudH0pYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBGcm9udGVuZFVSTGAsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly8ke2Rpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lfWAsXG4gICAgICBkZXNjcmlwdGlvbjogYENsb3VkRnJvbnQgVVJMIGZvciBmcm9udGVuZCAoJHtlbnZpcm9ubWVudH0pYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBDbG91ZEZyb250RGlzdHJpYnV0aW9uSWRgLCB7XG4gICAgICB2YWx1ZTogZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkLFxuICAgICAgZGVzY3JpcHRpb246IGBDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBJRCBmb3IgJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuICB9XG59Il19