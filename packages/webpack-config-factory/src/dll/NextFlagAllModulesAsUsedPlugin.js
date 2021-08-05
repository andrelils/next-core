/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/

"use strict";

const NullDependency = require("webpack/lib/dependencies/NullDependency");

/** @typedef {import("./Compiler")} Compiler */

/**
 * This plugin works as the same as `webpack.NextFlagAllModulesAsUsedPlugin`,
 * except for that it will ignore marking non-entry module for `@next-core/*`.
 *
 * Copied from https://github.com/webpack/webpack/blob/v4.46.0/lib/FlagAllModulesAsUsedPlugin.js
 */
class NextFlagAllModulesAsUsedPlugin {
  constructor(explanation) {
    this.explanation = explanation;
  }

  /**
   * @param {Compiler} compiler webpack compiler
   * @returns {void}
   */
  apply(compiler) {
    compiler.hooks.compilation.tap(
      "NextFlagAllModulesAsUsedPlugin",
      (compilation) => {
        compilation.hooks.optimizeDependencies.tap(
          "NextFlagAllModulesAsUsedPlugin",
          (modules) => {
            for (const module of modules) {
              // !!! Here's the replacement.
              if (module.libIdent) {
                const id = module.libIdent({
                  context: compiler.options.context,
                });
                if (id) {
                  const nodeModules = "/node_modules/@next-core/";
                  const lastIndex = id.lastIndexOf(nodeModules);
                  if (
                    lastIndex !== -1 &&
                    !/^[^/]+\/(?:index|dist\/(?:index\.esm|esm\/index))\.js$/.test(
                      id.substr(lastIndex + nodeModules.length)
                    )
                  ) {
                    // For `@next-core/*` only mark the entry only, which includes:
                    //   - `@next-core/*/index.js`,
                    //   - `@next-core/*/dist/index.esm.js`
                    //   - `@next-core/*/dist/esm/index.js`
                    // continue;
                  }
                }
              }

              module.used = true;
              module.usedExports = true;
              // !!! `NullDependency` is required here to avoid `webpack` to throw an error.
              module.addReason(null, null, this.explanation);
            }
          }
        );
      }
    );
  }
}

module.exports = NextFlagAllModulesAsUsedPlugin;
