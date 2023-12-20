const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { STSClient, AssumeRoleCommand } = require("@aws-sdk/client-sts");
const cdkout = require("../cdk.out.json");
const fs = require("fs");

const dotenv = require("dotenv");

dotenv.config();

const s3client = new S3Client({ region: process.env.REGION });
const bucketName = cdkout.CdkSfnSentimentAnalysisStack.BucketName;

const filename = "data.json";

const main = async () => {
  console.log("uploading file");
  let key = `${filename}`;
  const s3command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fs.readFileSync(`./examplecodes/data/${filename}`),
    ContentType: "application/json",
  });

  try {
    const s3r = await s3client.send(s3command);
    console.log(s3r);
  } catch (err) {
    console.error(err);
  }
};

main();
