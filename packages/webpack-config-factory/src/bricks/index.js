const baseFactory = require("./webpack.base.factory");

module.exports = {
  webpackCommonFactory: baseFactory(),
  webpackEditorsFactory: baseFactory("editors"),
  webpackPreviewsFactory: baseFactory("previews"),
  webpackDevFactory: require("./webpack.dev.factory"),
  webpackProdFactory: require("./webpack.prod.factory"),
  webpackContractsFactory: require("./webpack.contracts.factory"),
};
