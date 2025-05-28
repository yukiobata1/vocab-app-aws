"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VocabAppStack = void 0;
const cdk = require("aws-cdk-lib");
const ec2 = require("aws-cdk-lib/aws-ec2");
const rds = require("aws-cdk-lib/aws-rds");
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
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
            },
            deployOptions: {
                stageName: environment,
            },
        });
        // API Gateway Lambda integrations
        const getVocabIntegration = new apigateway.LambdaIntegration(getVocabLambda, {
            requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
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
        // API Routes
        const vocabResource = api.root.addResource('vocab');
        // GET /vocab - Get books or questions
        vocabResource.addMethod('GET', getVocabIntegration, {
            requestParameters: {
                'method.request.querystring.book_id': false,
                'method.request.querystring.limit': false,
                'method.request.querystring.offset': false,
            },
        });
        // POST /vocab - Create books or questions
        vocabResource.addMethod('POST', createVocabIntegration);
        // PUT /vocab - Update books or questions
        vocabResource.addMethod('PUT', updateVocabIntegration);
        // POST /migrate - Run database migrations
        const migrateResource = api.root.addResource('migrate');
        migrateResource.addMethod('POST', migrateIntegration);
        // API Gateway outputs
        new cdk.CfnOutput(this, `APIGatewayURL`, {
            value: api.url,
            description: `API Gateway URL for ${environment}`,
        });
        new cdk.CfnOutput(this, `APIGatewayId`, {
            value: api.restApiId,
            description: `API Gateway ID for ${environment}`,
        });
    }
}
exports.VocabAppStack = VocabAppStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidm9jYWItYXBwLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidm9jYWItYXBwLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQywyQ0FBMkM7QUFDM0MsMkNBQTJDO0FBQzNDLGlFQUFpRTtBQUNqRSwyQ0FBMkM7QUFDM0MsaURBQWlEO0FBQ2pELHlEQUF5RDtBQU96RCxNQUFhLGFBQWMsU0FBUSxHQUFHLENBQUMsS0FBSztJQUMxQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXlCO1FBQ2pFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxXQUFXLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFOUIsaUJBQWlCO1FBQ2pCLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLFdBQVcsRUFBRSxFQUFFO1lBQzNELE1BQU0sRUFBRSxDQUFDO1lBQ1Qsa0JBQWtCLEVBQUUsSUFBSTtZQUN4QixnQkFBZ0IsRUFBRSxJQUFJO1lBQ3RCLG1CQUFtQixFQUFFO2dCQUNuQjtvQkFDRSxRQUFRLEVBQUUsRUFBRTtvQkFDWixJQUFJLEVBQUUsbUJBQW1CLFdBQVcsRUFBRTtvQkFDdEMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsTUFBTTtpQkFDbEM7Z0JBQ0Q7b0JBQ0UsUUFBUSxFQUFFLEVBQUU7b0JBQ1osSUFBSSxFQUFFLG9CQUFvQixXQUFXLEVBQUU7b0JBQ3ZDLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLG1CQUFtQjtpQkFDL0M7Z0JBQ0Q7b0JBQ0UsUUFBUSxFQUFFLEVBQUU7b0JBQ1osSUFBSSxFQUFFLGVBQWUsV0FBVyxFQUFFO29CQUNsQyxVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0I7aUJBQzVDO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFF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LFNBQVMsQ0FBQyxNQUFNLEVBQUUsc0JBQXNCLENBQUMsQ0FBQztRQUV4RCx5Q0FBeUM7UUFDekMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsc0JBQXNCLENBQUMsQ0FBQztRQUV2RCwwQ0FBMEM7UUFDMUMsTUFBTSxlQUFlLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDeEQsZUFBZSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUV0RCxzQkFBc0I7UUFDdEIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDdkMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxHQUFHO1lBQ2QsV0FBVyxFQUFFLHVCQUF1QixXQUFXLEVBQUU7U0FDbEQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDdEMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxTQUFTO1lBQ3BCLFdBQVcsRUFBRSxzQkFBc0IsV0FBVyxFQUFFO1NBQ2pELENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTFURCxzQ0EwVEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgcmRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1yZHMnO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVm9jYWJBcHBTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBlbnZpcm9ubWVudDogJ2RldicgfCAncHJvZCc7XG59XG5cbmV4cG9ydCBjbGFzcyBWb2NhYkFwcFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFZvY2FiQXBwU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBlbnZpcm9ubWVudCB9ID0gcHJvcHM7XG5cbiAgICAvLyBWUEMgZm9yIEF1cm9yYVxuICAgIGNvbnN0IHZwYyA9IG5ldyBlYzIuVnBjKHRoaXMsIGBWb2NhYkFwcC1WUEMtJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgICBtYXhBenM6IDIsXG4gICAgICBlbmFibGVEbnNIb3N0bmFtZXM6IHRydWUsXG4gICAgICBlbmFibGVEbnNTdXBwb3J0OiB0cnVlLFxuICAgICAgc3VibmV0Q29uZmlndXJhdGlvbjogW1xuICAgICAgICB7XG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICAgIG5hbWU6IGBWb2NhYkFwcC1QdWJsaWMtJHtlbnZpcm9ubWVudH1gLFxuICAgICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBVQkxJQyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcbiAgICAgICAgICBuYW1lOiBgVm9jYWJBcHAtUHJpdmF0ZS0ke2Vudmlyb25tZW50fWAsXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcbiAgICAgICAgICBuYW1lOiBgVm9jYWJBcHAtREItJHtlbnZpcm9ubWVudH1gLFxuICAgICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfSVNPTEFURUQsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gU2VjdXJpdHkgR3JvdXAgZm9yIEF1cm9yYVxuICAgIGNvbnN0IGRiU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCBgVm9jYWJBcHAtREItU0ctJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgICB2cGMsXG4gICAgICBkZXNjcmlwdGlvbjogYFNlY3VyaXR5IGdyb3VwIGZvciBWb2NhYkFwcCBBdXJvcmEgY2x1c3RlciAoJHtlbnZpcm9ubWVudH0pYCxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IGZhbHNlLFxuICAgIH0pO1xuXG4gICAgLy8gQWxsb3cgUG9zdGdyZVNRTC9BdXJvcmEgY29ubmVjdGlvbnMgZnJvbSBWUENcbiAgICBkYlNlY3VyaXR5R3JvdXAuYWRkSW5ncmVzc1J1bGUoXG4gICAgICBlYzIuUGVlci5pcHY0KHZwYy52cGNDaWRyQmxvY2spLFxuICAgICAgZWMyLlBvcnQudGNwKDU0MzIpLFxuICAgICAgJ0FsbG93IFBvc3RncmVTUUwgY29ubmVjdGlvbnMgZnJvbSBWUEMnXG4gICAgKTtcblxuXG4gICAgLy8gRGF0YWJhc2UgY3JlZGVudGlhbHMgc2VjcmV0XG4gICAgY29uc3QgZGJTZWNyZXQgPSBuZXcgc2VjcmV0c21hbmFnZXIuU2VjcmV0KHRoaXMsIGBWb2NhYkFwcC1EQi1TZWNyZXQtJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgICBkZXNjcmlwdGlvbjogYERhdGFiYXNlIGNyZWRlbnRpYWxzIGZvciBWb2NhYkFwcCAoJHtlbnZpcm9ubWVudH0pYCxcbiAgICAgIGdlbmVyYXRlU2VjcmV0U3RyaW5nOiB7XG4gICAgICAgIHNlY3JldFN0cmluZ1RlbXBsYXRlOiBKU09OLnN0cmluZ2lmeSh7IHVzZXJuYW1lOiAndm9jYWJhZG1pbicgfSksXG4gICAgICAgIGdlbmVyYXRlU3RyaW5nS2V5OiAncGFzc3dvcmQnLFxuICAgICAgICBleGNsdWRlQ2hhcmFjdGVyczogJ1wiQC9cXFxcXFwnJyxcbiAgICAgICAgaW5jbHVkZVNwYWNlOiBmYWxzZSxcbiAgICAgICAgcGFzc3dvcmRMZW5ndGg6IDMyLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIERhdGFiYXNlIHN1Ym5ldCBncm91cFxuICAgIGNvbnN0IGRiU3VibmV0R3JvdXAgPSBuZXcgcmRzLlN1Ym5ldEdyb3VwKHRoaXMsIGBWb2NhYkFwcC1EQi1TdWJuZXRHcm91cC0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgIHZwYyxcbiAgICAgIGRlc2NyaXB0aW9uOiBgU3VibmV0IGdyb3VwIGZvciBWb2NhYkFwcCBBdXJvcmEgY2x1c3RlciAoJHtlbnZpcm9ubWVudH0pYCxcbiAgICAgIHZwY1N1Ym5ldHM6IHtcbiAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9JU09MQVRFRCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBdXJvcmEgU2VydmVybGVzcyB2MiBDbHVzdGVyXG4gICAgY29uc3QgY2x1c3RlciA9IG5ldyByZHMuRGF0YWJhc2VDbHVzdGVyKHRoaXMsIGBWb2NhYkFwcC1BdXJvcmEtJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgICBlbmdpbmU6IHJkcy5EYXRhYmFzZUNsdXN0ZXJFbmdpbmUuYXVyb3JhUG9zdGdyZXMoe1xuICAgICAgICB2ZXJzaW9uOiByZHMuQXVyb3JhUG9zdGdyZXNFbmdpbmVWZXJzaW9uLlZFUl8xNV80LFxuICAgICAgfSksXG4gICAgICBjcmVkZW50aWFsczogcmRzLkNyZWRlbnRpYWxzLmZyb21TZWNyZXQoZGJTZWNyZXQpLFxuICAgICAgd3JpdGVyOiByZHMuQ2x1c3Rlckluc3RhbmNlLnNlcnZlcmxlc3NWMihgVm9jYWJBcHAtV3JpdGVyLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgICBzY2FsZVdpdGhXcml0ZXI6IHRydWUsXG4gICAgICB9KSxcbiAgICAgIHJlYWRlcnM6IFtdLFxuICAgICAgc2VydmVybGVzc1YyTWluQ2FwYWNpdHk6IGVudmlyb25tZW50ID09PSAnZGV2JyA/IDAuNSA6IDEsXG4gICAgICBzZXJ2ZXJsZXNzVjJNYXhDYXBhY2l0eTogZW52aXJvbm1lbnQgPT09ICdkZXYnID8gMiA6IDE2LFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtkYlNlY3VyaXR5R3JvdXBdLFxuICAgICAgc3VibmV0R3JvdXA6IGRiU3VibmV0R3JvdXAsXG4gICAgICBkZWZhdWx0RGF0YWJhc2VOYW1lOiAndm9jYWJhcHAnLFxuICAgICAgYmFja3VwOiB7XG4gICAgICAgIHJldGVudGlvbjogZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IGNkay5EdXJhdGlvbi5kYXlzKDcpIDogY2RrLkR1cmF0aW9uLmRheXMoMyksXG4gICAgICAgIHByZWZlcnJlZFdpbmRvdzogJzAzOjAwLTA0OjAwJyxcbiAgICAgIH0sXG4gICAgICBwcmVmZXJyZWRNYWludGVuYW5jZVdpbmRvdzogJ1N1bjowNDowMC1TdW46MDU6MDAnLFxuICAgICAgZGVsZXRpb25Qcm90ZWN0aW9uOiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnLFxuICAgICAgc3RvcmFnZUVuY3J5cHRlZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIFJEUyBQcm94eSBmb3Igc2VjdXJlIGRhdGFiYXNlIGFjY2Vzc1xuICAgIGNvbnN0IHByb3h5Um9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBgVm9jYWJBcHAtUHJveHktUm9sZS0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdyZHMuYW1hem9uYXdzLmNvbScpLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcHJveHkgYWNjZXNzIHRvIHRoZSBzZWNyZXRcbiAgICBkYlNlY3JldC5ncmFudFJlYWQocHJveHlSb2xlKTtcblxuICAgIGNvbnN0IHByb3h5ID0gbmV3IHJkcy5EYXRhYmFzZVByb3h5KHRoaXMsIGBWb2NhYkFwcC1Qcm94eS0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgIHByb3h5VGFyZ2V0OiByZHMuUHJveHlUYXJnZXQuZnJvbUNsdXN0ZXIoY2x1c3RlciksXG4gICAgICBzZWNyZXRzOiBbZGJTZWNyZXRdLFxuICAgICAgdnBjLFxuICAgICAgdnBjU3VibmV0czoge1xuICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgfSxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbZGJTZWN1cml0eUdyb3VwXSxcbiAgICAgIHJvbGU6IHByb3h5Um9sZSxcbiAgICAgIHJlcXVpcmVUTFM6IGZhbHNlLCAvLyBTZXQgdG8gdHJ1ZSBpbiBwcm9kdWN0aW9uXG4gICAgICBpZGxlQ2xpZW50VGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMzApLFxuICAgICAgbWF4Q29ubmVjdGlvbnNQZXJjZW50OiA1MCxcbiAgICAgIG1heElkbGVDb25uZWN0aW9uc1BlcmNlbnQ6IDEwLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBEQkVuZHBvaW50YCwge1xuICAgICAgdmFsdWU6IGNsdXN0ZXIuY2x1c3RlckVuZHBvaW50Lmhvc3RuYW1lLFxuICAgICAgZGVzY3JpcHRpb246IGBBdXJvcmEgY2x1c3RlciBlbmRwb2ludCBmb3IgJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYERCUmVhZEVuZHBvaW50YCwge1xuICAgICAgdmFsdWU6IGNsdXN0ZXIuY2x1c3RlclJlYWRFbmRwb2ludC5ob3N0bmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgQXVyb3JhIGNsdXN0ZXIgcmVhZCBlbmRwb2ludCBmb3IgJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYERCU2VjcmV0YCwge1xuICAgICAgdmFsdWU6IGRiU2VjcmV0LnNlY3JldEFybixcbiAgICAgIGRlc2NyaXB0aW9uOiBgRGF0YWJhc2UgY3JlZGVudGlhbHMgc2VjcmV0IEFSTiBmb3IgJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYFZQQ0lkYCwge1xuICAgICAgdmFsdWU6IHZwYy52cGNJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiBgVlBDIElEIGZvciAke2Vudmlyb25tZW50fWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgUHJveHlFbmRwb2ludGAsIHtcbiAgICAgIHZhbHVlOiBwcm94eS5lbmRwb2ludCxcbiAgICAgIGRlc2NyaXB0aW9uOiBgUkRTIFByb3h5IGVuZHBvaW50IGZvciAke2Vudmlyb25tZW50fWAsXG4gICAgfSk7XG5cblxuICAgIC8vIFNlY3VyaXR5IEdyb3VwIGZvciBMYW1iZGEgZnVuY3Rpb25zXG4gICAgY29uc3QgbGFtYmRhU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCBgVm9jYWJBcHAtTGFtYmRhLVNHLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgdnBjLFxuICAgICAgZGVzY3JpcHRpb246IGBTZWN1cml0eSBncm91cCBmb3IgVm9jYWJBcHAgTGFtYmRhIGZ1bmN0aW9ucyAoJHtlbnZpcm9ubWVudH0pYCxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBDb21tb24gTGFtYmRhIGVudmlyb25tZW50IHZhcmlhYmxlc1xuICAgIGNvbnN0IGxhbWJkYUVudmlyb25tZW50ID0ge1xuICAgICAgU0VDUkVUX0FSTjogZGJTZWNyZXQuc2VjcmV0QXJuLFxuICAgICAgUFJPWFlfRU5EUE9JTlQ6IHByb3h5LmVuZHBvaW50LFxuICAgICAgREJfTkFNRTogJ3ZvY2FiYXBwJyxcbiAgICAgIEVOVklST05NRU5UOiBlbnZpcm9ubWVudCxcbiAgICB9O1xuXG4gICAgLy8gQ29tbW9uIExhbWJkYSBjb25maWd1cmF0aW9uXG4gICAgY29uc3QgbGFtYmRhQ29uZmlnID0ge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfOSxcbiAgICAgIHZwYyxcbiAgICAgIHZwY1N1Ym5ldHM6IHtcbiAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgIH0sXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNlY3VyaXR5R3JvdXBdLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgZW52aXJvbm1lbnQ6IGxhbWJkYUVudmlyb25tZW50LFxuICAgICAgbGF5ZXJzOiBbXG4gICAgICAgIG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsIGBWb2NhYkFwcC1Qc3ljb3BnMi1MYXllci0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS1sYXllcnMvcHN5Y29wZzInKSxcbiAgICAgICAgICBjb21wYXRpYmxlUnVudGltZXM6IFtsYW1iZGEuUnVudGltZS5QWVRIT05fM185XSxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ3BzeWNvcGcyIGxheWVyIGZvciBQb3N0Z3JlU1FMIGNvbm5lY3Rpdml0eScsXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICB9O1xuXG4gICAgLy8gQVBJIExhbWJkYSBGdW5jdGlvbnNcbiAgICBjb25zdCBnZXRWb2NhYkxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgYFZvY2FiQXBwLUdldFZvY2FiLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgaGFuZGxlcjogJ2dldF92b2NhYi5sYW1iZGFfaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9hcGknKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2V0IHZvY2FidWxhcnkgd29yZHMgYW5kIHF1ZXN0aW9ucycsXG4gICAgfSk7XG5cbiAgICBjb25zdCBjcmVhdGVWb2NhYkxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgYFZvY2FiQXBwLUNyZWF0ZVZvY2FiLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgaGFuZGxlcjogJ2NyZWF0ZV92b2NhYi5sYW1iZGFfaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9hcGknKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ3JlYXRlIHZvY2FidWxhcnkgYm9va3MgYW5kIHF1ZXN0aW9ucycsXG4gICAgfSk7XG5cbiAgICBjb25zdCB1cGRhdGVWb2NhYkxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgYFZvY2FiQXBwLVVwZGF0ZVZvY2FiLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgaGFuZGxlcjogJ3VwZGF0ZV92b2NhYi5sYW1iZGFfaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9hcGknKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVXBkYXRlIHZvY2FidWxhcnkgd29yZHMgYW5kIHByb2dyZXNzJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IG1pZ3JhdGVMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIGBWb2NhYkFwcC1NaWdyYXRlLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgaGFuZGxlcjogJ21pZ3JhdGUubGFtYmRhX2hhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvYXBpJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ1J1biBkYXRhYmFzZSBtaWdyYXRpb25zJyxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgLy8gRGF0YSBpbXBvcnQgTGFtYmRhIChmb3IgZGV2IGVudmlyb25tZW50KVxuICAgIGlmIChlbnZpcm9ubWVudCA9PT0gJ2RldicpIHtcbiAgICAgIGNvbnN0IGltcG9ydExhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgYFZvY2FiQXBwLUltcG9ydC1MYW1iZGEtJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgICAgaGFuZGxlcjogJ3ZvY2FiLWltcG9ydC5sYW1iZGFfaGFuZGxlcicsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0ltcG9ydCB2b2NhYnVsYXJ5IGRhdGEgZnJvbSBmaWxlcycsXG4gICAgICB9KTtcblxuICAgICAgZGJTZWNyZXQuZ3JhbnRSZWFkKGltcG9ydExhbWJkYSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBJbXBvcnRMYW1iZGFOYW1lYCwge1xuICAgICAgICB2YWx1ZTogaW1wb3J0TGFtYmRhLmZ1bmN0aW9uTmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246IGBJbXBvcnQgTGFtYmRhIGZ1bmN0aW9uIG5hbWUgZm9yICR7ZW52aXJvbm1lbnR9YCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEdyYW50IExhbWJkYSBmdW5jdGlvbnMgYWNjZXNzIHRvIHRoZSBkYXRhYmFzZSBzZWNyZXRcbiAgICBbZ2V0Vm9jYWJMYW1iZGEsIGNyZWF0ZVZvY2FiTGFtYmRhLCB1cGRhdGVWb2NhYkxhbWJkYSwgbWlncmF0ZUxhbWJkYV0uZm9yRWFjaChmbiA9PiB7XG4gICAgICBkYlNlY3JldC5ncmFudFJlYWQoZm4pO1xuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYEdldFZvY2FiTGFtYmRhTmFtZWAsIHtcbiAgICAgIHZhbHVlOiBnZXRWb2NhYkxhbWJkYS5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogYEdldCBWb2NhYiBMYW1iZGEgZnVuY3Rpb24gbmFtZSBmb3IgJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYENyZWF0ZVZvY2FiTGFtYmRhTmFtZWAsIHtcbiAgICAgIHZhbHVlOiBjcmVhdGVWb2NhYkxhbWJkYS5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogYENyZWF0ZSBWb2NhYiBMYW1iZGEgZnVuY3Rpb24gbmFtZSBmb3IgJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYFVwZGF0ZVZvY2FiTGFtYmRhTmFtZWAsIHtcbiAgICAgIHZhbHVlOiB1cGRhdGVWb2NhYkxhbWJkYS5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogYFVwZGF0ZSBWb2NhYiBMYW1iZGEgZnVuY3Rpb24gbmFtZSBmb3IgJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYE1pZ3JhdGVMYW1iZGFOYW1lYCwge1xuICAgICAgdmFsdWU6IG1pZ3JhdGVMYW1iZGEuZnVuY3Rpb25OYW1lLFxuICAgICAgZGVzY3JpcHRpb246IGBNaWdyYXRlIExhbWJkYSBmdW5jdGlvbiBuYW1lIGZvciAke2Vudmlyb25tZW50fWAsXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheSBSRVNUIEFQSVxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgYFZvY2FiQXBwLUFQSS0ke2Vudmlyb25tZW50fWAsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiBgVm9jYWJBcHAgQVBJICgke2Vudmlyb25tZW50fSlgLFxuICAgICAgZGVzY3JpcHRpb246IGBWb2NhYnVsYXJ5IGFwcCBSRVNUIEFQSSBmb3IgJHtlbnZpcm9ubWVudH0gZW52aXJvbm1lbnRgLFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbJ0NvbnRlbnQtVHlwZScsICdYLUFtei1EYXRlJywgJ0F1dGhvcml6YXRpb24nLCAnWC1BcGktS2V5J10sXG4gICAgICB9LFxuICAgICAgZGVwbG95T3B0aW9uczoge1xuICAgICAgICBzdGFnZU5hbWU6IGVudmlyb25tZW50LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBHYXRld2F5IExhbWJkYSBpbnRlZ3JhdGlvbnNcbiAgICBjb25zdCBnZXRWb2NhYkludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0Vm9jYWJMYW1iZGEsIHtcbiAgICAgIHJlcXVlc3RUZW1wbGF0ZXM6IHsgJ2FwcGxpY2F0aW9uL2pzb24nOiAneyBcInN0YXR1c0NvZGVcIjogXCIyMDBcIiB9JyB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgY3JlYXRlVm9jYWJJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGNyZWF0ZVZvY2FiTGFtYmRhLCB7XG4gICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7ICdhcHBsaWNhdGlvbi9qc29uJzogJ3sgXCJzdGF0dXNDb2RlXCI6IFwiMjAwXCIgfScgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHVwZGF0ZVZvY2FiSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih1cGRhdGVWb2NhYkxhbWJkYSwge1xuICAgICAgcmVxdWVzdFRlbXBsYXRlczogeyAnYXBwbGljYXRpb24vanNvbic6ICd7IFwic3RhdHVzQ29kZVwiOiBcIjIwMFwiIH0nIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBtaWdyYXRlSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihtaWdyYXRlTGFtYmRhLCB7XG4gICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7ICdhcHBsaWNhdGlvbi9qc29uJzogJ3sgXCJzdGF0dXNDb2RlXCI6IFwiMjAwXCIgfScgfSxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBSb3V0ZXNcbiAgICBjb25zdCB2b2NhYlJlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3ZvY2FiJyk7XG4gICAgXG4gICAgLy8gR0VUIC92b2NhYiAtIEdldCBib29rcyBvciBxdWVzdGlvbnNcbiAgICB2b2NhYlJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgZ2V0Vm9jYWJJbnRlZ3JhdGlvbiwge1xuICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcbiAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLmJvb2tfaWQnOiBmYWxzZSxcbiAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLmxpbWl0JzogZmFsc2UsXG4gICAgICAgICdtZXRob2QucmVxdWVzdC5xdWVyeXN0cmluZy5vZmZzZXQnOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBQT1NUIC92b2NhYiAtIENyZWF0ZSBib29rcyBvciBxdWVzdGlvbnNcbiAgICB2b2NhYlJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIGNyZWF0ZVZvY2FiSW50ZWdyYXRpb24pO1xuXG4gICAgLy8gUFVUIC92b2NhYiAtIFVwZGF0ZSBib29rcyBvciBxdWVzdGlvbnNcbiAgICB2b2NhYlJlc291cmNlLmFkZE1ldGhvZCgnUFVUJywgdXBkYXRlVm9jYWJJbnRlZ3JhdGlvbik7XG5cbiAgICAvLyBQT1NUIC9taWdyYXRlIC0gUnVuIGRhdGFiYXNlIG1pZ3JhdGlvbnNcbiAgICBjb25zdCBtaWdyYXRlUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnbWlncmF0ZScpO1xuICAgIG1pZ3JhdGVSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBtaWdyYXRlSW50ZWdyYXRpb24pO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkgb3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBBUElHYXRld2F5VVJMYCwge1xuICAgICAgdmFsdWU6IGFwaS51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogYEFQSSBHYXRld2F5IFVSTCBmb3IgJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYEFQSUdhdGV3YXlJZGAsIHtcbiAgICAgIHZhbHVlOiBhcGkucmVzdEFwaUlkLFxuICAgICAgZGVzY3JpcHRpb246IGBBUEkgR2F0ZXdheSBJRCBmb3IgJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuICB9XG59Il19