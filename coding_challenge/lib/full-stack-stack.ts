import * as cdk from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { table } from 'console';
import * as logs from 'aws-cdk-lib/aws-logs';


export class FullStackStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Creating an S3 bucket with CORS configuration
    const bucket = new s3.Bucket(this, 'MyFirstBucket', {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      cors: [
        {
          allowedOrigins: ["*"],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
          allowedHeaders: [
            'Content-Type',
            'Accept',
            'Origin',
          ],
          maxAge: 3000
        },
      ],
    });

   // Defining an IAM role that will be granted s3:PutObject permission
   const myRole = new iam.Role(this, 'MyRole', {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'), 
  });

  // Defining an IAM policy statement for s3:PutObject
  const putObjectPolicy = new iam.PolicyStatement({
    actions: ['s3:Put*', 's3:GetObject'],
    resources: [bucket.bucketArn + '/*', bucket.bucketArn], 
    effect: iam.Effect.ALLOW,
    principals: [myRole]
  });

    // Adding the IAM policy statement to allow s3:PutObject
    bucket.addToResourcePolicy(putObjectPolicy);

    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
    });

    const scriptPath = path.join(__dirname, '..', 'scripts', 'script2.sh');


    new s3deploy.BucketDeployment(this, 'ScriptFile', {
      sources: [s3deploy.Source.asset(path.dirname(scriptPath))],
      destinationBucket: bucket,
      destinationKeyPrefix: 'scripts', 
    });

    // DynamoDB table to store file data
    const fileTable = new dynamodb.Table(this, 'FileTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, 
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
    });

    // Output the table name
    new cdk.CfnOutput(this, 'TableName', {
      value: fileTable.tableName,
    });

    const lambdaCodePath = path.join(__dirname,'..', 'lambda');

    // Define the Lambda function for generating presigned URLs
    const generatePresignedUrlHandler = new lambda.Function(this, 'GeneratePresignedUrlHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'presign.handler',
      code: lambda.Code.fromAsset(lambdaCodePath), 
      environment: {
        FILE_TABLE_NAME: fileTable.tableName,
        BUCKET_NAME: bucket.bucketName,
      },
    });

    // Granting permissions to the Lambda function to write to the DynamoDB table and access S3
    fileTable.grantWriteData(generatePresignedUrlHandler);
    bucket.grantReadWrite(generatePresignedUrlHandler);

    const apipresign = new apigateway.RestApi(this, 'ApiPresign', {
      defaultCorsPreflightOptions: {
        allowOrigins: ['http://localhost:3000'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Accept',
          'Origin',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Amz-User-Agent',
        ],
      },
    });

    const generatePresignedUrlResource = apipresign.root.addResource('generate-presigned-url');
    const generatePresignedUrlIntegration = new apigateway.LambdaIntegration(generatePresignedUrlHandler);

    generatePresignedUrlResource.addMethod('POST', generatePresignedUrlIntegration);

    // Output the API Gateway endpoint URL
    new cdk.CfnOutput(this, 'ApiPresignEndpoint', {
      value: apipresign.url,
    });
    

    const fileUploadHandler = new lambda.Function(this, 'FileUploadHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(lambdaCodePath),
      environment: {
        FILE_TABLE_NAME: fileTable.tableName,
      },
    });

    fileTable.grantWriteData(fileUploadHandler);

    const api = new apigateway.RestApi(this, 'FileUploadApi', {
      defaultCorsPreflightOptions: {
        allowOrigins: ['http://localhost:3000'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Accept',
          'Origin',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Amz-User-Agent',
        ],
      }
    });

    const logGroup = new logs.LogGroup(this, 'ApiGatewayAccessLogs', {
      retention: logs.RetentionDays.ONE_WEEK, 
    });

    const fileUploadResource = api.root.addResource('upload');
    const fileUploadIntegration = new apigateway.LambdaIntegration(fileUploadHandler);
    fileUploadResource.addMethod('POST', fileUploadIntegration);

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
    });

    // Define the IAM role with the required policies
    const myEC2Role = new iam.Role(this, 'MyEC2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'), // Allow EC2 instances to assume this role
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'),
      ],
    });

    // Create an IAM instance profile
    const instanceProfile = new iam.CfnInstanceProfile(this, 'MyInstanceProfile', {
      roles: [myEC2Role.roleName], // Assign the role to the instance profile
    });

    // Output the ARN of the IAM instance profile
    new cdk.CfnOutput(this, 'InstanceProfileARN', {
      value: instanceProfile.attrArn, // Access the ARN attribute of the instance profile
    });
    
    const eventHandler = new lambda.Function(this, 'DynamoDBEventHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'ec2.handler',
      code: lambda.Code.fromAsset(lambdaCodePath),
      environment: {
        // INSTANCE_ID: instance,
        INSTANCE_TYPE: 't2.micro', 
        S3_BUCKET_NAME: bucket.bucketName,
        TABLE_NAME: fileTable.tableName,
        INSTANCE_PROFILE: instanceProfile.attrArn
      },
      timeout: cdk.Duration.seconds(900)
    });

    fileTable.grantReadData(eventHandler);
    fileTable.grantStreamRead(eventHandler);

    fileUploadHandler.addPermission('InvokeDynamoDBEventHandler', {
      action: 'lambda:InvokeFunction',
      principal: new iam.ServicePrincipal('lambda.amazonaws.com'),
      sourceArn: eventHandler.functionArn,
    });

    generatePresignedUrlHandler.addPermission('InvokeDynamoDBEventHandler', {
      action: 'lambda:InvokeFunction',
      principal: new iam.ServicePrincipal('lambda.amazonaws.com'),
      sourceArn: eventHandler.functionArn,
    });

    eventHandler.addEventSourceMapping('DynamoDBStreamMapping', {
      eventSourceArn: fileTable.tableStreamArn,
      batchSize: 1,
      startingPosition: lambda.StartingPosition.LATEST,
    });


    const instanceStartPolicyStatement = new iam.PolicyStatement({
      actions: ['ec2:RunInstances','s3:HeadObject','ec2:DescribeInstances','ec2:DescribeInstanceStatus','iam:AddRoleToInstanceProfile','iam:GetInstanceProfile','iam:PassRole','iam:CreateInstanceProfile', 'ec2:AssociateIamInstanceProfile','ec2:AssociateIamInstanceProfile','iam:GetRole','iam:CreateRole','ec2:SourceInstanceARN','iam:AttachRolePolicy', 'ec2:CreateLaunchTemplate', 'ec2:TerminateInstances', 's3:GetObject', 'dynamodb:GetItem'],
      resources: ['*'],
  });

  eventHandler.addToRolePolicy(instanceStartPolicyStatement);

  }
}