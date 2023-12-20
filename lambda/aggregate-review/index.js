exports.handler = async (itemsArray) => {
  console.log(JSON.stringify(itemsArray, null, 2));

  const allReviews = [];
  for (let items of itemsArray) {
    allReviews.push(...items);
  }

  const totalReviews = allReviews.length;
  const positiveReviews = allReviews.filter((review) => review === "POSITIVE").length;
  const negativeReviews = allReviews.filter((review) => review === "NEGATIVE").length;
  const neutralReviews = allReviews.filter((review) => review === "NEUTRAL").length;
  const mixedReviews = allReviews.filter((review) => review === "MIXED").length;
  const percentagePositive = parseInt((positiveReviews / totalReviews) * 100);

  return {
    statusCode: 200,
    body: JSON.stringify({
      totalReviews: totalReviews,
      positiveReviews: positiveReviews,
      percentagePositive: percentagePositive,
    }),
  };
};
