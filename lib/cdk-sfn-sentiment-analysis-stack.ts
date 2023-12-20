import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

import {
  aws_sqs as sqs,
  aws_s3 as s3,
  aws_s3_notifications as s3n,
  aws_iam as iam,
  aws_stepfunctions as sfn,
  aws_stepfunctions_tasks as tasks,
  aws_events as events,
  aws_events_targets as eventsTargets,
} from "aws-cdk-lib";
import { JsonPath } from "aws-cdk-lib/aws-stepfunctions";
export class CdkSfnSentimentAnalysisStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the S3 bucket to upload the json file
    const bucket = new s3.Bucket(this, "inbound-bucket");

    // Create the SQS queue
    const queue = new sqs.Queue(this, "inbound-processing-q");

    // Add S3 notification configuration to send events to the queue
    // bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.SqsDestination(queue));

    //create nodejs lambda function
    const analyzeReviewLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, "analyzeReviewLambda", {
      runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(30),
      handler: "handler",
      entry: "./lambda/analyze-review/index.js",
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
        REGION: process.env.REGION!,
        BUCKET_NAME: bucket.bucketName,
        SENTIMENT_THRESHOLD: "0.5",
      },
      bundling: {
        nodeModules: [],
        externalModules: [],
      },
      layers: [],
    });

    //provide DetectSentiment permission to the lambda
    analyzeReviewLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["comprehend:DetectSentiment"],
        resources: ["*"],
      })
    );

    //error notification lambda
    const errorNoticationLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, "errorNoticationLambda", {
      runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(30),
      handler: "handler",
      entry: "./lambda/error-notification/index.js",
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
        REGION: process.env.REGION!,
      },

      bundling: {
        nodeModules: [],
        externalModules: [],
      },
    });

    //aggregate review lambda
    const aggregateReviewLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, "aggregateReviewLambda", {
      runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(30),
      handler: "handler",
      entry: "./lambda/aggregate-review/index.js",
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
        REGION: process.env.REGION!,
      },

      bundling: {
        nodeModules: [],
        externalModules: [],
      },
    });
    /**
     * STATE MACHINE TO PROCESS DATA FROM INBOUND JSON
     */

    const custom = new sfn.CustomState(this, "Process Inbound File", {
      stateJson: {
        Type: "Map",
        ItemReader: {
          Resource: "arn:aws:states:::s3:getObject",
          ReaderConfig: {
            InputType: "JSON",
          },
          Parameters: {
            "Bucket.$": "$.detail.bucket.name",
            "Key.$": "$.detail.object.key",
          },
        },
        ItemProcessor: {
          ProcessorConfig: {
            Mode: "DISTRIBUTED",
            ExecutionType: "STANDARD",
          },
          StartAt: "Analyze Review",
          States: {
            "Analyze Review": {
              Type: "Task",
              Resource: "arn:aws:states:::lambda:invoke",
              OutputPath: "$.Payload",
              Parameters: {
                "Payload.$": "$",
                "FunctionName": `${analyzeReviewLambda.functionArn}`,
              },
              Retry: [
                {
                  ErrorEquals: [
                    "Lambda.ServiceException",
                    "Lambda.AWSLambdaException",
                    "Lambda.SdkClientException",
                    "Lambda.TooManyRequestsException",
                  ],
                  IntervalSeconds: 2,
                  MaxAttempts: 6,
                  BackoffRate: 2,
                },
              ],
              End: true,
            },
          },
        },
        MaxConcurrency: 1000,
        Label: "ReviewAnalysis",
        ItemBatcher: {
          MaxItemsPerBatch: 10,
        },
      },
    });

    const errorTask = new tasks.LambdaInvoke(this, "Handle Exception", {
      lambdaFunction: errorNoticationLambda,
      payload: sfn.TaskInput.fromJsonPathAt("$"),
    });

    const aggregateTask = new tasks.LambdaInvoke(this, "Aggregate All Reviews", {
      lambdaFunction: aggregateReviewLambda,
      payload: sfn.TaskInput.fromJsonPathAt("$"),
    });
    aggregateTask.addCatch(errorTask, { resultPath: JsonPath.DISCARD });

    const chain = sfn.Chain.start(custom).next(aggregateTask);

    const stateMachine = new sfn.StateMachine(this, "SentimentAnalysisStateMachine", {
      stateMachineName: "sentiment-analysis-state-machine",
      definition: chain,
    });

    stateMachine.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["states:StartExecution", "states:DescribeExecution", "states:StopExecution"],
        resources: ["*"],
      })
    );

    analyzeReviewLambda.grantInvoke(stateMachine);

    new events.Rule(this, "process-review-data-rule", {
      // Define the event pattern to trigger on object create in S3 bucket
      eventPattern: {
        source: ["aws.s3"],
        detailType: ["Object Created"],
        detail: {
          bucket: {
            name: [bucket.bucketName],
          },
        },
      },

      // Target the rule at the state machine
      targets: [new eventsTargets.SfnStateMachine(stateMachine)],
    });
    bucket.enableEventBridgeNotification();
    bucket.grantReadWrite(stateMachine);

    //cdk output bucket name and arn
    //write the ooutput to a file

    new cdk.CfnOutput(this, "BucketName", {
      value: bucket.bucketName,
      description: "The name of the S3 bucket",
      exportName: "BucketName",
    });
  }
}
