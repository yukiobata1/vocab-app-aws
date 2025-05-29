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
    }
}
exports.VocabAppStack = VocabAppStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidm9jYWItYXBwLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidm9jYWItYXBwLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQywyQ0FBMkM7QUFDM0MsMkNBQTJDO0FBQzNDLHFEQUFxRDtBQUNyRCxpRUFBaUU7QUFDakUsMkNBQTJDO0FBQzNDLGlEQUFpRDtBQUNqRCx5REFBeUQ7QUFPekQsTUFBYSxhQUFjLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDMUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF5QjtRQUNqRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsV0FBVyxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRTlCLGlCQUFpQjtRQUNqQixNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGdCQUFnQixXQUFXLEVBQUUsRUFBRTtZQUMzRCxNQUFNLEVBQUUsQ0FBQztZQUNULGtCQUFrQixFQUFFLElBQUk7WUFDeEIsZ0JBQWdCLEVBQUUsSUFBSTtZQUN0QixtQkFBbUIsRUFBRTtnQkFDbkI7b0JBQ0UsUUFBUSxFQUFFLEVBQUU7b0JBQ1osSUFBSSxFQUFFLG1CQUFtQixXQUFXLEVBQUU7b0JBQ3RDLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLE1BQU07aUJBQ2xDO2dCQUNEO29CQUNFLFFBQVEsRUFBRSxFQUFFO29CQUNaLElBQUksRUFBRSxvQkFBb0IsV0FBVyxFQUFFO29CQUN2QyxVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxtQkFBbUI7aUJBQy9DO2dCQUNEO29CQUNFLFFBQVEsRUFBRSxFQUFFO29CQUNaLElBQUksRUFBRSxlQUFlLFdBQVcsRUFBRTtvQkFDbEMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCO2lCQUM1QzthQUNGO1NBQ0Ys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LGVBQWUsRUFBRTtZQUN2QyxLQUFLLEVBQUUsR0FBRyxDQUFDLEdBQUc7WUFDZCxXQUFXLEVBQUUsdUJBQXVCLFdBQVcsRUFBRTtTQUNsRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUN0QyxLQUFLLEVBQUUsR0FBRyxDQUFDLFNBQVM7WUFDcEIsV0FBVyxFQUFFLHNCQUFzQixXQUFXLEVBQUU7U0FDakQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUM1QyxLQUFLLEVBQUUsY0FBYyxDQUFDLFNBQVM7WUFDL0IsV0FBVyxFQUFFLHVDQUF1QyxXQUFXLEdBQUc7U0FDbkUsQ0FBQyxDQUFDO1FBRUgsK0JBQStCO1FBQy9CLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDOUMsS0FBSyxFQUFFLGdCQUFnQixDQUFDLFlBQVk7WUFDcEMsV0FBVyxFQUFFLHdDQUF3QyxXQUFXLEVBQUU7U0FDbkUsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUMzQyxLQUFLLEVBQUUsYUFBYSxDQUFDLFlBQVk7WUFDakMsV0FBVyxFQUFFLHFDQUFxQyxXQUFXLEVBQUU7U0FDaEUsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBL2JELHNDQStiQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyByZHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXJkcyc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVm9jYWJBcHBTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBlbnZpcm9ubWVudDogJ2RldicgfCAncHJvZCc7XG59XG5cbmV4cG9ydCBjbGFzcyBWb2NhYkFwcFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFZvY2FiQXBwU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBlbnZpcm9ubWVudCB9ID0gcHJvcHM7XG5cbiAgICAvLyBWUEMgZm9yIEF1cm9yYVxuICAgIGNvbnN0IHZwYyA9IG5ldyBlYzIuVnBjKHRoaXMsIGBWb2NhYkFwcC1WUEMtJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgICBtYXhBenM6IDIsXG4gICAgICBlbmFibGVEbnNIb3N0bmFtZXM6IHRydWUsXG4gICAgICBlbmFibGVEbnNTdXBwb3J0OiB0cnVlLFxuICAgICAgc3VibmV0Q29uZmlndXJhdGlvbjogW1xuICAgICAgICB7XG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICAgIG5hbWU6IGBWb2NhYkFwcC1QdWJsaWMtJHtlbnZpcm9ubWVudH1gLFxuICAgICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBVQkxJQyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcbiAgICAgICAgICBuYW1lOiBgVm9jYWJBcHAtUHJpdmF0ZS0ke2Vudmlyb25tZW50fWAsXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcbiAgICAgICAgICBuYW1lOiBgVm9jYWJBcHAtREItJHtlbnZpcm9ubWVudH1gLFxuICAgICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfSVNPTEFURUQsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gU2VjdXJpdHkgR3JvdXAgZm9yIEF1cm9yYVxuICAgIGNvbnN0IGRiU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCBgVm9jYWJBcHAtREItU0ctJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgICB2cGMsXG4gICAgICBkZXNjcmlwdGlvbjogYFNlY3VyaXR5IGdyb3VwIGZvciBWb2NhYkFwcCBBdXJvcmEgY2x1c3RlciAoJHtlbnZpcm9ubWVudH0pYCxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IGZhbHNlLFxuICAgIH0pO1xuXG4gICAgLy8gQWxsb3cgUG9zdGdyZVNRTC9BdXJvcmEgY29ubmVjdGlvbnMgZnJvbSBWUENcbiAgICBkYlNlY3VyaXR5R3JvdXAuYWRkSW5ncmVzc1J1bGUoXG4gICAgICBlYzIuUGVlci5pcHY0KHZwYy52cGNDaWRyQmxvY2spLFxuICAgICAgZWMyLlBvcnQudGNwKDU0MzIpLFxuICAgICAgJ0FsbG93IFBvc3RncmVTUUwgY29ubmVjdGlvbnMgZnJvbSBWUEMnXG4gICAgKTtcblxuXG4gICAgLy8gRGF0YWJhc2UgY3JlZGVudGlhbHMgc2VjcmV0XG4gICAgY29uc3QgZGJTZWNyZXQgPSBuZXcgc2VjcmV0c21hbmFnZXIuU2VjcmV0KHRoaXMsIGBWb2NhYkFwcC1EQi1TZWNyZXQtJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgICBkZXNjcmlwdGlvbjogYERhdGFiYXNlIGNyZWRlbnRpYWxzIGZvciBWb2NhYkFwcCAoJHtlbnZpcm9ubWVudH0pYCxcbiAgICAgIGdlbmVyYXRlU2VjcmV0U3RyaW5nOiB7XG4gICAgICAgIHNlY3JldFN0cmluZ1RlbXBsYXRlOiBKU09OLnN0cmluZ2lmeSh7IHVzZXJuYW1lOiAndm9jYWJhZG1pbicgfSksXG4gICAgICAgIGdlbmVyYXRlU3RyaW5nS2V5OiAncGFzc3dvcmQnLFxuICAgICAgICBleGNsdWRlQ2hhcmFjdGVyczogJ1wiQC9cXFxcXFwnJyxcbiAgICAgICAgaW5jbHVkZVNwYWNlOiBmYWxzZSxcbiAgICAgICAgcGFzc3dvcmRMZW5ndGg6IDMyLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIERhdGFiYXNlIHN1Ym5ldCBncm91cFxuICAgIGNvbnN0IGRiU3VibmV0R3JvdXAgPSBuZXcgcmRzLlN1Ym5ldEdyb3VwKHRoaXMsIGBWb2NhYkFwcC1EQi1TdWJuZXRHcm91cC0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgIHZwYyxcbiAgICAgIGRlc2NyaXB0aW9uOiBgU3VibmV0IGdyb3VwIGZvciBWb2NhYkFwcCBBdXJvcmEgY2x1c3RlciAoJHtlbnZpcm9ubWVudH0pYCxcbiAgICAgIHZwY1N1Ym5ldHM6IHtcbiAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9JU09MQVRFRCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBdXJvcmEgU2VydmVybGVzcyB2MiBDbHVzdGVyXG4gICAgY29uc3QgY2x1c3RlciA9IG5ldyByZHMuRGF0YWJhc2VDbHVzdGVyKHRoaXMsIGBWb2NhYkFwcC1BdXJvcmEtJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgICBlbmdpbmU6IHJkcy5EYXRhYmFzZUNsdXN0ZXJFbmdpbmUuYXVyb3JhUG9zdGdyZXMoe1xuICAgICAgICB2ZXJzaW9uOiByZHMuQXVyb3JhUG9zdGdyZXNFbmdpbmVWZXJzaW9uLlZFUl8xNV80LFxuICAgICAgfSksXG4gICAgICBjcmVkZW50aWFsczogcmRzLkNyZWRlbnRpYWxzLmZyb21TZWNyZXQoZGJTZWNyZXQpLFxuICAgICAgd3JpdGVyOiByZHMuQ2x1c3Rlckluc3RhbmNlLnNlcnZlcmxlc3NWMihgVm9jYWJBcHAtV3JpdGVyLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgICBzY2FsZVdpdGhXcml0ZXI6IHRydWUsXG4gICAgICB9KSxcbiAgICAgIHJlYWRlcnM6IFtdLFxuICAgICAgc2VydmVybGVzc1YyTWluQ2FwYWNpdHk6IGVudmlyb25tZW50ID09PSAnZGV2JyA/IDAuNSA6IDEsXG4gICAgICBzZXJ2ZXJsZXNzVjJNYXhDYXBhY2l0eTogZW52aXJvbm1lbnQgPT09ICdkZXYnID8gMiA6IDE2LFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtkYlNlY3VyaXR5R3JvdXBdLFxuICAgICAgc3VibmV0R3JvdXA6IGRiU3VibmV0R3JvdXAsXG4gICAgICBkZWZhdWx0RGF0YWJhc2VOYW1lOiAndm9jYWJhcHAnLFxuICAgICAgYmFja3VwOiB7XG4gICAgICAgIHJldGVudGlvbjogZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IGNkay5EdXJhdGlvbi5kYXlzKDcpIDogY2RrLkR1cmF0aW9uLmRheXMoMyksXG4gICAgICAgIHByZWZlcnJlZFdpbmRvdzogJzAzOjAwLTA0OjAwJyxcbiAgICAgIH0sXG4gICAgICBwcmVmZXJyZWRNYWludGVuYW5jZVdpbmRvdzogJ1N1bjowNDowMC1TdW46MDU6MDAnLFxuICAgICAgZGVsZXRpb25Qcm90ZWN0aW9uOiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnLFxuICAgICAgc3RvcmFnZUVuY3J5cHRlZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIFJEUyBQcm94eSBmb3Igc2VjdXJlIGRhdGFiYXNlIGFjY2Vzc1xuICAgIGNvbnN0IHByb3h5Um9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBgVm9jYWJBcHAtUHJveHktUm9sZS0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdyZHMuYW1hem9uYXdzLmNvbScpLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcHJveHkgYWNjZXNzIHRvIHRoZSBzZWNyZXRcbiAgICBkYlNlY3JldC5ncmFudFJlYWQocHJveHlSb2xlKTtcblxuICAgIGNvbnN0IHByb3h5ID0gbmV3IHJkcy5EYXRhYmFzZVByb3h5KHRoaXMsIGBWb2NhYkFwcC1Qcm94eS0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgIHByb3h5VGFyZ2V0OiByZHMuUHJveHlUYXJnZXQuZnJvbUNsdXN0ZXIoY2x1c3RlciksXG4gICAgICBzZWNyZXRzOiBbZGJTZWNyZXRdLFxuICAgICAgdnBjLFxuICAgICAgdnBjU3VibmV0czoge1xuICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgfSxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbZGJTZWN1cml0eUdyb3VwXSxcbiAgICAgIHJvbGU6IHByb3h5Um9sZSxcbiAgICAgIHJlcXVpcmVUTFM6IGZhbHNlLCAvLyBTZXQgdG8gdHJ1ZSBpbiBwcm9kdWN0aW9uXG4gICAgICBpZGxlQ2xpZW50VGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMzApLFxuICAgICAgbWF4Q29ubmVjdGlvbnNQZXJjZW50OiA1MCxcbiAgICAgIG1heElkbGVDb25uZWN0aW9uc1BlcmNlbnQ6IDEwLFxuICAgIH0pO1xuXG4gICAgLy8gRHluYW1vREIgVGFibGUgZm9yIFF1aXogUm9vbXNcbiAgICBjb25zdCBxdWl6Um9vbXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCBgVm9jYWJBcHAtUXVpelJvb21zLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgdGFibGVOYW1lOiBgVm9jYWJBcHAtUXVpelJvb21zLSR7ZW52aXJvbm1lbnR9YCxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAncm9vbUNvZGUnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogJ3R0bCcsXG4gICAgICByZW1vdmFsUG9saWN5OiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IGVudmlyb25tZW50ID09PSAncHJvZCcsXG4gICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgICBzdHJlYW06IGR5bmFtb2RiLlN0cmVhbVZpZXdUeXBlLk5FV19BTkRfT0xEX0lNQUdFUyxcbiAgICB9KTtcblxuICAgIC8vIEdTSSBmb3IgcXVlcnlpbmcgYnkgY3JlYXRlZEJ5ICh0ZWFjaGVyKVxuICAgIHF1aXpSb29tc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ0NyZWF0ZWRCeUluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnY3JlYXRlZEJ5JyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnY3JlYXRlZEF0JyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBEQkVuZHBvaW50YCwge1xuICAgICAgdmFsdWU6IGNsdXN0ZXIuY2x1c3RlckVuZHBvaW50Lmhvc3RuYW1lLFxuICAgICAgZGVzY3JpcHRpb246IGBBdXJvcmEgY2x1c3RlciBlbmRwb2ludCBmb3IgJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYERCUmVhZEVuZHBvaW50YCwge1xuICAgICAgdmFsdWU6IGNsdXN0ZXIuY2x1c3RlclJlYWRFbmRwb2ludC5ob3N0bmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgQXVyb3JhIGNsdXN0ZXIgcmVhZCBlbmRwb2ludCBmb3IgJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYERCU2VjcmV0YCwge1xuICAgICAgdmFsdWU6IGRiU2VjcmV0LnNlY3JldEFybixcbiAgICAgIGRlc2NyaXB0aW9uOiBgRGF0YWJhc2UgY3JlZGVudGlhbHMgc2VjcmV0IEFSTiBmb3IgJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYFZQQ0lkYCwge1xuICAgICAgdmFsdWU6IHZwYy52cGNJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiBgVlBDIElEIGZvciAke2Vudmlyb25tZW50fWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgUHJveHlFbmRwb2ludGAsIHtcbiAgICAgIHZhbHVlOiBwcm94eS5lbmRwb2ludCxcbiAgICAgIGRlc2NyaXB0aW9uOiBgUkRTIFByb3h5IGVuZHBvaW50IGZvciAke2Vudmlyb25tZW50fWAsXG4gICAgfSk7XG5cblxuICAgIC8vIFNlY3VyaXR5IEdyb3VwIGZvciBMYW1iZGEgZnVuY3Rpb25zXG4gICAgY29uc3QgbGFtYmRhU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCBgVm9jYWJBcHAtTGFtYmRhLVNHLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgdnBjLFxuICAgICAgZGVzY3JpcHRpb246IGBTZWN1cml0eSBncm91cCBmb3IgVm9jYWJBcHAgTGFtYmRhIGZ1bmN0aW9ucyAoJHtlbnZpcm9ubWVudH0pYCxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBDb21tb24gTGFtYmRhIGVudmlyb25tZW50IHZhcmlhYmxlc1xuICAgIGNvbnN0IGxhbWJkYUVudmlyb25tZW50ID0ge1xuICAgICAgU0VDUkVUX0FSTjogZGJTZWNyZXQuc2VjcmV0QXJuLFxuICAgICAgUFJPWFlfRU5EUE9JTlQ6IHByb3h5LmVuZHBvaW50LFxuICAgICAgREJfTkFNRTogJ3ZvY2FiYXBwJyxcbiAgICAgIEVOVklST05NRU5UOiBlbnZpcm9ubWVudCxcbiAgICAgIFFVSVpfUk9PTVNfVEFCTEU6IHF1aXpSb29tc1RhYmxlLnRhYmxlTmFtZSxcbiAgICB9O1xuXG4gICAgLy8gQ29tbW9uIExhbWJkYSBjb25maWd1cmF0aW9uXG4gICAgY29uc3QgbGFtYmRhQ29uZmlnID0ge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfOSxcbiAgICAgIHZwYyxcbiAgICAgIHZwY1N1Ym5ldHM6IHtcbiAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgIH0sXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNlY3VyaXR5R3JvdXBdLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgZW52aXJvbm1lbnQ6IGxhbWJkYUVudmlyb25tZW50LFxuICAgICAgbGF5ZXJzOiBbXG4gICAgICAgIG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsIGBWb2NhYkFwcC1Qc3ljb3BnMi1MYXllci0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS1sYXllcnMvcHN5Y29wZzInKSxcbiAgICAgICAgICBjb21wYXRpYmxlUnVudGltZXM6IFtsYW1iZGEuUnVudGltZS5QWVRIT05fM185XSxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ3BzeWNvcGcyIGxheWVyIGZvciBQb3N0Z3JlU1FMIGNvbm5lY3Rpdml0eScsXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICB9O1xuXG4gICAgLy8gQVBJIExhbWJkYSBGdW5jdGlvbnNcbiAgICBjb25zdCBnZXRWb2NhYkxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgYFZvY2FiQXBwLUdldFZvY2FiLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgaGFuZGxlcjogJ2dldF92b2NhYi5sYW1iZGFfaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9hcGknKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2V0IHZvY2FidWxhcnkgd29yZHMgYW5kIHF1ZXN0aW9ucycsXG4gICAgfSk7XG5cbiAgICBjb25zdCBjcmVhdGVWb2NhYkxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgYFZvY2FiQXBwLUNyZWF0ZVZvY2FiLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgaGFuZGxlcjogJ2NyZWF0ZV92b2NhYi5sYW1iZGFfaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9hcGknKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ3JlYXRlIHZvY2FidWxhcnkgYm9va3MgYW5kIHF1ZXN0aW9ucycsXG4gICAgfSk7XG5cbiAgICBjb25zdCB1cGRhdGVWb2NhYkxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgYFZvY2FiQXBwLVVwZGF0ZVZvY2FiLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgaGFuZGxlcjogJ3VwZGF0ZV92b2NhYi5sYW1iZGFfaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9hcGknKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVXBkYXRlIHZvY2FidWxhcnkgd29yZHMgYW5kIHByb2dyZXNzJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IG1pZ3JhdGVMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIGBWb2NhYkFwcC1NaWdyYXRlLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgaGFuZGxlcjogJ21pZ3JhdGUubGFtYmRhX2hhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvYXBpJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ1J1biBkYXRhYmFzZSBtaWdyYXRpb25zJyxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgLy8gRGF0YSBpbXBvcnQgTGFtYmRhIChmb3IgZGV2IGVudmlyb25tZW50KVxuICAgIGlmIChlbnZpcm9ubWVudCA9PT0gJ2RldicpIHtcbiAgICAgIGNvbnN0IGltcG9ydExhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgYFZvY2FiQXBwLUltcG9ydC1MYW1iZGEtJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgICAgaGFuZGxlcjogJ3ZvY2FiLWltcG9ydC5sYW1iZGFfaGFuZGxlcicsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0ltcG9ydCB2b2NhYnVsYXJ5IGRhdGEgZnJvbSBmaWxlcycsXG4gICAgICB9KTtcblxuICAgICAgZGJTZWNyZXQuZ3JhbnRSZWFkKGltcG9ydExhbWJkYSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBJbXBvcnRMYW1iZGFOYW1lYCwge1xuICAgICAgICB2YWx1ZTogaW1wb3J0TGFtYmRhLmZ1bmN0aW9uTmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246IGBJbXBvcnQgTGFtYmRhIGZ1bmN0aW9uIG5hbWUgZm9yICR7ZW52aXJvbm1lbnR9YCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFJvb20gY29kZSBMYW1iZGEgZnVuY3Rpb25zIChEeW5hbW9EQiBvbmx5LCBubyBWUEMgbmVlZGVkKVxuICAgIGNvbnN0IHJvb21Db2RlTGFtYmRhQ29uZmlnID0ge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfOSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFFVSVpfUk9PTVNfVEFCTEU6IHF1aXpSb29tc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgRU5WSVJPTk1FTlQ6IGVudmlyb25tZW50LFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgY29uc3QgY3JlYXRlUm9vbUxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgYFZvY2FiQXBwLUNyZWF0ZVJvb20tJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgICAuLi5yb29tQ29kZUxhbWJkYUNvbmZpZyxcbiAgICAgIGhhbmRsZXI6ICdjcmVhdGVfcm9vbS5sYW1iZGFfaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9yb29tcycpLFxuICAgICAgZGVzY3JpcHRpb246ICdDcmVhdGUgcXVpeiByb29tIHdpdGggcm9vbSBjb2RlJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGdldFJvb21MYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIGBWb2NhYkFwcC1HZXRSb29tLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgLi4ucm9vbUNvZGVMYW1iZGFDb25maWcsXG4gICAgICBoYW5kbGVyOiAnZ2V0X3Jvb20ubGFtYmRhX2hhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvcm9vbXMnKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2V0IHF1aXogcm9vbSBieSByb29tIGNvZGUnLFxuICAgIH0pO1xuXG4gICAgY29uc3Qgam9pblJvb21MYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIGBWb2NhYkFwcC1Kb2luUm9vbS0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgIC4uLnJvb21Db2RlTGFtYmRhQ29uZmlnLFxuICAgICAgaGFuZGxlcjogJ2pvaW5fcm9vbS5sYW1iZGFfaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9yb29tcycpLFxuICAgICAgZGVzY3JpcHRpb246ICdKb2luIHF1aXogcm9vbScsXG4gICAgfSk7XG5cbiAgICBjb25zdCBkZWxldGVSb29tTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBgVm9jYWJBcHAtRGVsZXRlUm9vbS0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgIC4uLnJvb21Db2RlTGFtYmRhQ29uZmlnLFxuICAgICAgaGFuZGxlcjogJ2RlbGV0ZV9yb29tLmxhbWJkYV9oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL3Jvb21zJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ0RlbGV0ZSBxdWl6IHJvb20nLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZ2V0Um9vbVN0YXRzTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBgVm9jYWJBcHAtR2V0Um9vbVN0YXRzLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgLi4ucm9vbUNvZGVMYW1iZGFDb25maWcsXG4gICAgICBoYW5kbGVyOiAnZ2V0X3Jvb21fc3RhdHMubGFtYmRhX2hhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvcm9vbXMnKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2V0IHF1aXogcm9vbSBzdGF0aXN0aWNzJyxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IER5bmFtb0RCIHBlcm1pc3Npb25zIHRvIHJvb20gTGFtYmRhIGZ1bmN0aW9uc1xuICAgIGNvbnN0IHJvb21MYW1iZGFzID0gW2NyZWF0ZVJvb21MYW1iZGEsIGdldFJvb21MYW1iZGEsIGpvaW5Sb29tTGFtYmRhLCBkZWxldGVSb29tTGFtYmRhLCBnZXRSb29tU3RhdHNMYW1iZGFdO1xuICAgIHJvb21MYW1iZGFzLmZvckVhY2goZm4gPT4ge1xuICAgICAgcXVpelJvb21zVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGZuKTtcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IExhbWJkYSBmdW5jdGlvbnMgYWNjZXNzIHRvIHRoZSBkYXRhYmFzZSBzZWNyZXRcbiAgICBbZ2V0Vm9jYWJMYW1iZGEsIGNyZWF0ZVZvY2FiTGFtYmRhLCB1cGRhdGVWb2NhYkxhbWJkYSwgbWlncmF0ZUxhbWJkYV0uZm9yRWFjaChmbiA9PiB7XG4gICAgICBkYlNlY3JldC5ncmFudFJlYWQoZm4pO1xuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYEdldFZvY2FiTGFtYmRhTmFtZWAsIHtcbiAgICAgIHZhbHVlOiBnZXRWb2NhYkxhbWJkYS5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogYEdldCBWb2NhYiBMYW1iZGEgZnVuY3Rpb24gbmFtZSBmb3IgJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYENyZWF0ZVZvY2FiTGFtYmRhTmFtZWAsIHtcbiAgICAgIHZhbHVlOiBjcmVhdGVWb2NhYkxhbWJkYS5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogYENyZWF0ZSBWb2NhYiBMYW1iZGEgZnVuY3Rpb24gbmFtZSBmb3IgJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYFVwZGF0ZVZvY2FiTGFtYmRhTmFtZWAsIHtcbiAgICAgIHZhbHVlOiB1cGRhdGVWb2NhYkxhbWJkYS5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogYFVwZGF0ZSBWb2NhYiBMYW1iZGEgZnVuY3Rpb24gbmFtZSBmb3IgJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYE1pZ3JhdGVMYW1iZGFOYW1lYCwge1xuICAgICAgdmFsdWU6IG1pZ3JhdGVMYW1iZGEuZnVuY3Rpb25OYW1lLFxuICAgICAgZGVzY3JpcHRpb246IGBNaWdyYXRlIExhbWJkYSBmdW5jdGlvbiBuYW1lIGZvciAke2Vudmlyb25tZW50fWAsXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheSBSRVNUIEFQSVxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgYFZvY2FiQXBwLUFQSS0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiBgVm9jYWJBcHAgQVBJICgke2Vudmlyb25tZW50fSlgLFxuICAgICAgZGVzY3JpcHRpb246IGBWb2NhYnVsYXJ5IGFwcCBSRVNUIEFQSSBmb3IgJHtlbnZpcm9ubWVudH0gZW52aXJvbm1lbnRgLFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogWycqJ10sXG4gICAgICAgIGFsbG93TWV0aG9kczogWydHRVQnLCAnUE9TVCcsICdQVVQnLCAnREVMRVRFJywgJ09QVElPTlMnXSxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbJ0NvbnRlbnQtVHlwZScsICdYLUFtei1EYXRlJywgJ0F1dGhvcml6YXRpb24nLCAnWC1BcGktS2V5JywgJ1gtQW16LVNlY3VyaXR5LVRva2VuJ10sXG4gICAgICB9LFxuICAgICAgZGVwbG95T3B0aW9uczoge1xuICAgICAgICBzdGFnZU5hbWU6IGVudmlyb25tZW50LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBHYXRld2F5IExhbWJkYSBpbnRlZ3JhdGlvbnNcbiAgICBjb25zdCBnZXRWb2NhYkludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0Vm9jYWJMYW1iZGEsIHtcbiAgICAgIHByb3h5OiB0cnVlLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY3JlYXRlVm9jYWJJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGNyZWF0ZVZvY2FiTGFtYmRhLCB7XG4gICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7ICdhcHBsaWNhdGlvbi9qc29uJzogJ3sgXCJzdGF0dXNDb2RlXCI6IFwiMjAwXCIgfScgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHVwZGF0ZVZvY2FiSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih1cGRhdGVWb2NhYkxhbWJkYSwge1xuICAgICAgcmVxdWVzdFRlbXBsYXRlczogeyAnYXBwbGljYXRpb24vanNvbic6ICd7IFwic3RhdHVzQ29kZVwiOiBcIjIwMFwiIH0nIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBtaWdyYXRlSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihtaWdyYXRlTGFtYmRhLCB7XG4gICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7ICdhcHBsaWNhdGlvbi9qc29uJzogJ3sgXCJzdGF0dXNDb2RlXCI6IFwiMjAwXCIgfScgfSxcbiAgICB9KTtcblxuICAgIC8vIFJvb20gTGFtYmRhIGludGVncmF0aW9uc1xuICAgIGNvbnN0IGNyZWF0ZVJvb21JbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGNyZWF0ZVJvb21MYW1iZGEsIHtcbiAgICAgIHByb3h5OiB0cnVlLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZ2V0Um9vbUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0Um9vbUxhbWJkYSwge1xuICAgICAgcHJveHk6IHRydWUsXG4gICAgfSk7XG5cbiAgICBjb25zdCBqb2luUm9vbUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oam9pblJvb21MYW1iZGEsIHtcbiAgICAgIHByb3h5OiB0cnVlLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZGVsZXRlUm9vbUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZGVsZXRlUm9vbUxhbWJkYSwge1xuICAgICAgcHJveHk6IHRydWUsXG4gICAgfSk7XG5cbiAgICBjb25zdCBnZXRSb29tU3RhdHNJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGdldFJvb21TdGF0c0xhbWJkYSwge1xuICAgICAgcHJveHk6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgUm91dGVzXG4gICAgY29uc3Qgdm9jYWJSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCd2b2NhYicpO1xuICAgIFxuICAgIC8vIEdFVCAvdm9jYWIgLSBHZXQgYm9va3Mgb3IgcXVlc3Rpb25zXG4gICAgdm9jYWJSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIGdldFZvY2FiSW50ZWdyYXRpb24pO1xuXG4gICAgLy8gUE9TVCAvdm9jYWIgLSBDcmVhdGUgYm9va3Mgb3IgcXVlc3Rpb25zXG4gICAgdm9jYWJSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBjcmVhdGVWb2NhYkludGVncmF0aW9uKTtcblxuICAgIC8vIFBVVCAvdm9jYWIgLSBVcGRhdGUgYm9va3Mgb3IgcXVlc3Rpb25zXG4gICAgdm9jYWJSZXNvdXJjZS5hZGRNZXRob2QoJ1BVVCcsIHVwZGF0ZVZvY2FiSW50ZWdyYXRpb24pO1xuXG4gICAgLy8gUE9TVCAvbWlncmF0ZSAtIFJ1biBkYXRhYmFzZSBtaWdyYXRpb25zXG4gICAgY29uc3QgbWlncmF0ZVJlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ21pZ3JhdGUnKTtcbiAgICBtaWdyYXRlUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbWlncmF0ZUludGVncmF0aW9uKTtcblxuICAgIC8vIFJvb20gQVBJIHJvdXRlc1xuICAgIGNvbnN0IHJvb21SZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCdyb29tJyk7XG4gICAgXG4gICAgLy8gUE9TVCAvcm9vbSAtIENyZWF0ZSByb29tXG4gICAgcm9vbVJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIGNyZWF0ZVJvb21JbnRlZ3JhdGlvbik7XG4gICAgXG4gICAgLy8gR0VUIC9yb29tL3tyb29tQ29kZX0gLSBHZXQgcm9vbVxuICAgIGNvbnN0IHJvb21Db2RlUmVzb3VyY2UgPSByb29tUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tyb29tQ29kZX0nKTtcbiAgICByb29tQ29kZVJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgZ2V0Um9vbUludGVncmF0aW9uKTtcbiAgICBcbiAgICAvLyBERUxFVEUgL3Jvb20ve3Jvb21Db2RlfSAtIERlbGV0ZSByb29tXG4gICAgcm9vbUNvZGVSZXNvdXJjZS5hZGRNZXRob2QoJ0RFTEVURScsIGRlbGV0ZVJvb21JbnRlZ3JhdGlvbik7XG4gICAgXG4gICAgLy8gUE9TVCAvcm9vbS97cm9vbUNvZGV9L2pvaW4gLSBKb2luIHJvb21cbiAgICBjb25zdCBqb2luUm9vbVJlc291cmNlID0gcm9vbUNvZGVSZXNvdXJjZS5hZGRSZXNvdXJjZSgnam9pbicpO1xuICAgIGpvaW5Sb29tUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgam9pblJvb21JbnRlZ3JhdGlvbik7XG4gICAgXG4gICAgLy8gR0VUIC9yb29tL3tyb29tQ29kZX0vc3RhdHMgLSBHZXQgcm9vbSBzdGF0c1xuICAgIGNvbnN0IHJvb21TdGF0c1Jlc291cmNlID0gcm9vbUNvZGVSZXNvdXJjZS5hZGRSZXNvdXJjZSgnc3RhdHMnKTtcbiAgICByb29tU3RhdHNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIGdldFJvb21TdGF0c0ludGVncmF0aW9uKTtcblxuICAgIC8vIEFQSSBHYXRld2F5IG91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgQVBJR2F0ZXdheVVSTGAsIHtcbiAgICAgIHZhbHVlOiBhcGkudXJsLFxuICAgICAgZGVzY3JpcHRpb246IGBBUEkgR2F0ZXdheSBVUkwgZm9yICR7ZW52aXJvbm1lbnR9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBBUElHYXRld2F5SWRgLCB7XG4gICAgICB2YWx1ZTogYXBpLnJlc3RBcGlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiBgQVBJIEdhdGV3YXkgSUQgZm9yICR7ZW52aXJvbm1lbnR9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBRdWl6Um9vbXNUYWJsZU5hbWVgLCB7XG4gICAgICB2YWx1ZTogcXVpelJvb21zVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246IGBEeW5hbW9EQiB0YWJsZSBuYW1lIGZvciBxdWl6IHJvb21zICgke2Vudmlyb25tZW50fSlgLFxuICAgIH0pO1xuXG4gICAgLy8gUm9vbSBMYW1iZGEgZnVuY3Rpb24gb3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBDcmVhdGVSb29tTGFtYmRhTmFtZWAsIHtcbiAgICAgIHZhbHVlOiBjcmVhdGVSb29tTGFtYmRhLmZ1bmN0aW9uTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgQ3JlYXRlIHJvb20gTGFtYmRhIGZ1bmN0aW9uIG5hbWUgZm9yICR7ZW52aXJvbm1lbnR9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBHZXRSb29tTGFtYmRhTmFtZWAsIHtcbiAgICAgIHZhbHVlOiBnZXRSb29tTGFtYmRhLmZ1bmN0aW9uTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgR2V0IHJvb20gTGFtYmRhIGZ1bmN0aW9uIG5hbWUgZm9yICR7ZW52aXJvbm1lbnR9YCxcbiAgICB9KTtcbiAgfVxufSJdfQ==