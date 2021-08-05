/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const path = require("path");
const asyncLib = require("neo-async");
const SingleEntryDependency = require("webpack/lib/dependencies/SingleEntryDependency");

/**
 * This plugin works as the same as `webpack/lib/LibManifestPlugin`,
 * except for that it will replace all occurrences of `@next-core/*`
 * by `@easyops/*` for module ids, since we want to keep the backward
 * compatibility of dll manifest.
 *
 * Copied from https://github.com/webpack/webpack/blob/v4.46.0/lib/LibManifestPlugin.js
 */
class NextLibManifestPlugin {
  constructor(options) {
    this.options = options;
  }

  apply(compiler) {
    compiler.hooks.emit.tapAsync(
      "NextLibManifestPlugin",
      (compilation, callback) => {
        asyncLib.forEach(
          compilation.chunks,
          (chunk, callback) => {
            if (!chunk.isOnlyInitial()) {
              callback();
              return;
            }
            const targetPath = compilation.getPath(this.options.path, {
              hash: compilation.hash,
              chunk,
            });
            const name =
              this.options.name &&
              compilation.getPath(this.options.name, {
                hash: compilation.hash,
                chunk,
              });
            const manifest = {
              name,
              type: this.options.type,
              content: Array.from(chunk.modulesIterable, (module) => {
                if (
                  this.options.entryOnly &&
                  !module.reasons.some(
                    (r) => r.dependency instanceof SingleEntryDependency
                  )
                ) {
                  return;
                }
                if (module.libIdent) {
                  const ident = module.libIdent({
                    context: this.options.context || compiler.options.context,
                  });
                  if (ident) {
                    // const nodeModules = "/node_modules/@next-core/";
                    // const lastIndex = ident.lastIndexOf(nodeModules);
                    // if (
                    //   lastIndex !== -1 &&
                    //   !/^[^/]+\/(?:index|dist\/(?:index\.esm|esm\/index))\.js$/.test(
                    //     ident.substr(lastIndex + nodeModules.length)
                    //   )
                    // ) {
                    //   // For `@next-core/*` only mark the entry only, which includes:
                    //   //   - `@next-core/*/index.js`,
                    //   //   - `@next-core/*/dist/index.esm.js`
                    //   //   - `@next-core/*/dist/esm/index.js`
                    //   return;
                    // }
                    return {
                      // !!! Here's the replacement.
                      ident: ident
                        .replace(
                          /(\/node_modules\/@next-core\/[^/]+\/dist)\/esm\/index\.js$/,
                          "$1/index.esm.js"
                        )
                        .replace(
                          "/node_modules/@next-core/",
                          "/node_modules/@easyops/"
                        ),
                      data: {
                        id: module.id,
                        buildMeta: module.buildMeta,
                      },
                    };
                  }
                }
              })
                .filter(Boolean)
                .reduce((obj, item) => {
                  obj[item.ident] = item.data;
                  return obj;
                }, Object.create(null)),
            };
            // Apply formatting to content if format flag is true;
            const manifestContent = this.options.format
              ? JSON.stringify(manifest, null, 2)
              : JSON.stringify(manifest);
            const content = Buffer.from(manifestContent, "utf8");
            compiler.outputFileSystem.mkdirp(
              path.dirname(targetPath),
              (err) => {
                if (err) return callback(err);
                compiler.outputFileSystem.writeFile(
                  targetPath,
                  content,
                  callback
                );
              }
            );
          },
          callback
        );
      }
    );
  }
}
module.exports = NextLibManifestPlugin;
