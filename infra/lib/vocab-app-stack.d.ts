import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
export interface VocabAppStackProps extends cdk.StackProps {
    environment: 'dev' | 'prod';
}
export declare class VocabAppStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: VocabAppStackProps);
}
