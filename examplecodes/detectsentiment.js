const { ComprehendClient, DetectSentimentCommand } = require("@aws-sdk/client-comprehend");
const comprehendClient = new ComprehendClient({ region: "us-east-2" });
const main = async (text) => {
  const command = new DetectSentimentCommand({
    Text: text,
    LanguageCode: "en",
  });
  const response = await comprehendClient.send(command);
  console.log(response);
};

main("I love cdk!!!");
