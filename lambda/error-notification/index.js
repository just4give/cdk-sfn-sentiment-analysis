//write lambda handler async
exports.handler = async (event) => {
  console.log(event);
  return {
    statusCode: 500,
    body: JSON.stringify({
      message: "Error in execution",
    }),
  };
};
