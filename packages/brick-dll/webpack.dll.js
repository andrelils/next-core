const path = require("path");
const webpack = require("webpack");
const {
  dll: { NextDllPlugin, NextHashedModuleIdsPlugin },
  CleanWebpackPlugin,
} = require("@next-core/webpack-config-factory");
const packageJson = require("./package.json");

const isProd = process.env.NODE_ENV === "production";
const appRoot = path.join(__dirname, "..", "..");
const distPath = path.join(__dirname, "dist");

const regExpOfBrickIcons = /\/node_modules\/@next-core\/brick-icons\//;
const regExpOfBrickKit = /\/node_modules\/@next-core\/brick-kit\//;
const regExpOfColoredBrickIcons =
  /\/icons\/colored-(?:pseudo-3d|common)\/[^/]+\.svg$/;

module.exports = {
  context: appRoot,
  devtool: "source-map",
  mode: isProd ? "production" : "development",
  entry: {
    dll: Object.keys(packageJson.dependencies).flatMap((dep) => {
      if (dep === "@babel/runtime") {
        const babelRuntime = require(`${dep}/package.json`);
        return (
          Object.keys(babelRuntime.exports)
            // Ignore `./helpers/esm/*`.
            .filter((exp) => /^\.\/helpers\/[^/]+$/.test(exp))
            .map((exp) => `${dep}/${exp.substr(1)}`)
        );
      }
      return dep;
    }), //.map(k => k.replace("@next-core/", "@easyops/")),
  },
  output: {
    filename: isProd ? "[name].[contenthash].js" : "[name].bundle.js",
    path: distPath,
    library: "[name]",
    hashDigestLength: 8,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /\/node_modules\/@easyops-cn\/brick-next-pipes\//,
        enforce: "pre",
        use: ["source-map-loader"],
      },
      {
        // Include ts, tsx, js, and jsx files.
        test: /\.(ts|js)x?$/,
        include: /\/node_modules\/@easyops-cn\/brick-next-pipes\//,
        loader: "babel-loader",
        options: {
          rootMode: "upward",
        },
      },
      {
        // - `rc-editor-mention` (which required `draft-js`) is deprecated in `antd Mentions`
        test: /node_modules\/rc-editor-mention\//,
        use: "null-loader",
      },
      getSvgLoader({
        resourceRules: {
          or: [
            { test: regExpOfBrickKit },
            {
              and: [
                { test: regExpOfBrickIcons },
                { test: regExpOfColoredBrickIcons },
              ],
            },
          ],
        },
        convertColors: false,
      }),
      getSvgLoader({
        resourceRules: {
          test: regExpOfBrickIcons,
          not: [{ test: regExpOfColoredBrickIcons }],
        },
        convertColors: true,
      }),
      {
        test: /\.png$/,
        use: [getUrlLoad()],
      },
    ],
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        vendors: false,
      },
    },
  },
  plugins: [
    new CleanWebpackPlugin(),
    new NextDllPlugin({
      name: "[name]",
      path: path.join(distPath, "manifest.json"),
      format: !isProd,
      entryOnly: true,
    }),
    new webpack.ContextReplacementPlugin(/moment[/\\]locale$/, /zh|en/),
    new NextHashedModuleIdsPlugin(),
    new webpack.IgnorePlugin({
      // - `esprima` and `buffer` are optional imported by `js-yaml`
      // we don't need them.
      resourceRegExp: /^(?:esprima)$/,
    }),
  ],
  resolve: {
    // only resolve .js extension files
    // Note that we does not resolve .json for significantly lower IO requests
    extensions: [".ts", ".js"],
    // modules: [path.join(appRoot, "node_modules")],
    symlinks: false,
  },
  performance: {
    hints: false,
  },
};

function getUrlLoad() {
  return {
    loader: "url-loader",
    options: {
      name: "assets/[name].[hash:8].[ext]",
      limit: 8192,
      esModule: false,
    },
  };
}

function getSvgLoader({ resourceRules, convertColors }) {
  return {
    resource: {
      and: [
        {
          test: /\.svg$/,
        },
        ...[].concat(resourceRules),
      ],
    },
    issuer: {
      test: /\.(ts|js)x?$/,
    },
    use: [
      {
        loader: "babel-loader",
        options: {
          rootMode: "upward",
        },
      },
      {
        loader: "@svgr/webpack",
        options: {
          babel: false,
          svgoConfig: {
            plugins: [
              {
                // Keep `viewbox`
                removeViewBox: false,
              },
              convertColors && {
                convertColors: {
                  currentColor: true,
                },
              },
            ].filter(Boolean),
          },
        },
      },
      getUrlLoad(),
    ],
  };
}
