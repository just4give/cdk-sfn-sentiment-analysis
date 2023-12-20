#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { CdkSfnSentimentAnalysisStack } from "../lib/cdk-sfn-sentiment-analysis-stack";
import * as dotenv from "dotenv";

dotenv.config();

const app = new cdk.App();
new CdkSfnSentimentAnalysisStack(app, "CdkSfnSentimentAnalysisStack", {
  description: "Sentiment analysis using AWS CDK",
  env: {
    account: process.env.ACCOUNT,
    region: process.env.REGION,
  },
});
