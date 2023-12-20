const { ComprehendClient, DetectSentimentCommand } = require("@aws-sdk/client-comprehend");
const REGION = process.env.REGION;
const comprehendClient = new ComprehendClient({ region: REGION });

exports.handler = async (event) => {
  //read data from step function distributed map
  console.log(JSON.stringify(event, null, 2));
  const reviews = event.Items;
  const sentiments = [];
  for (const review of reviews) {
    const command = new DetectSentimentCommand({
      Text: review.review,
      LanguageCode: "en",
    });
    const response = await comprehendClient.send(command);
    console.log(response);
    sentiments.push(response.Sentiment);
  }

  return sentiments;
};
