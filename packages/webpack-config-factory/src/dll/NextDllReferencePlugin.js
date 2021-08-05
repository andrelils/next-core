const webpack = require("webpack");

/**
 * This plugin extends `webpack.DllReferencePlugin`, and
 * only do one more thing: replace all `@easyops/*` by `@next-core/*`.
 *
 * Since we want to keep the backward compatibility of our dll,
 * but the `manifest.json` has already been written as `@easyops/*`,
 * whilst the real packages have been renamed to `@next-core/*`.
 *
 * Copied from https://github.com/webpack/webpack/blob/v4.46.0/lib/DllReferencePlugin.js
 */
class NextDllReferencePlugin extends webpack.DllReferencePlugin {
  constructor(options) {
    super({
      ...options,
      manifest: {
        ...options.manifest,
        content: Object.fromEntries(
          Object.entries(options.manifest.content).map(([k, v]) => [
            // !!! Here's the replacement.
            k
              .replace("/node_modules/@easyops/", "/node_modules/@next-core/")
              .replace(
                /(\/node_modules\/@next-core\/[^/]+\/dist)\/index\.esm\.js$/,
                "$1/esm/index.js"
              ),
            v,
          ])
        ),
      },
    });
  }
}

module.exports = NextDllReferencePlugin;
