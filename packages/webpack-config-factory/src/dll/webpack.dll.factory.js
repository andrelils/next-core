const path = require("path");
const changeCase = require("change-case");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const NextDllPlugin = require("./NextDllPlugin");
const NextDllReferencePlugin = require("./NextDllReferencePlugin");
const NextHashedModuleIdsPlugin = require("./NextHashedModuleIdsPlugin");

module.exports = () => {
  const isProd = process.env.NODE_ENV === "production";
  const dirname = process.cwd();
  const appRoot = path.join(dirname, "..", "..");
  const distPath = path.join(dirname, "dist");

  const packageJson = require(path.join(dirname, "package.json"));
  const { name, dependencies, devDependencies } = packageJson;
  const filename = `dll-of-${name.split("/").slice(-1)[0]}`;

  const dllReferences = [];
  if (devDependencies) {
    for (const dep of Object.keys(devDependencies)) {
      if (dep === "@next-core/brick-dll" || dep.startsWith("@next-dll/")) {
        dllReferences.push(
          new NextDllReferencePlugin({
            context: appRoot,
            manifest: require(dep),
          })
        );
      }
    }
  }

  return {
    context: appRoot,
    devtool: "source-map",
    mode: isProd ? "production" : "development",
    entry: {
      [changeCase.pascalCase(filename)]: Object.keys(dependencies),
    },
    output: {
      filename: isProd
        ? `${filename}.[contenthash].js`
        : `${filename}.bundle.js`,
      path: distPath,
      library: "[name]",
      hashDigestLength: 8,
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          enforce: "pre",
          use: ["source-map-loader"],
        },
        {
          test: /\.module\.css$/,
          use: [
            "style-loader",
            ...getStyleLoaders({
              modules: {
                localIdentName: "[local]--[hash:base64:8]",
              },
            }),
          ],
        },
      ],
    },
    plugins: [
      new CleanWebpackPlugin(),
      ...dllReferences,
      new NextDllPlugin({
        name: "[name]",
        path: path.join(distPath, "manifest.json"),
        format: !isProd,
        entryOnly: true,
      }),
      new NextHashedModuleIdsPlugin(),
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
};

function getCssLoader(cssOptions) {
  return {
    loader: "css-loader",
    options: {
      // Todo(steve): based on env.
      sourceMap: false,
      ...cssOptions,
    },
  };
}

function getStyleLoaders(cssOptions) {
  return [
    getCssLoader(cssOptions),
    {
      loader: "postcss-loader",
      options: {
        ident: "postcss",
        sourceMap: false,
        plugins: () => [
          require("postcss-nested")(),
          require("postcss-preset-env")(),
        ],
      },
    },
  ];
}
