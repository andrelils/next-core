const changeCase = require("change-case");

const pluginName = "ScanPreviewBricksPlugin";

const validEditorName =
  /^[a-z][a-z0-9]*(-[a-z0-9]+)*\.[a-z][a-z0-9]*(-[a-z0-9]+)+--preview$/;

module.exports = class ScanPreviewBricksPlugin {
  constructor(packageName) {
    this.packageName = packageName;
    this.camelPackageName = changeCase.camelCase(packageName);
  }

  apply(compiler) {
    const previewSet = new Set();
    compiler.hooks.normalModuleFactory.tap(pluginName, (factory) => {
      factory.hooks.parser.for("javascript/auto").tap(pluginName, (parser) => {
        parser.hooks.callAnyMember
          .for("customElements")
          .tap(pluginName, (expression) => {
            // `customElements.define(...)`
            if (
              expression.callee.property.name === "define" &&
              expression.arguments.length === 2
            ) {
              const { type, value } = expression.arguments[0];
              if (type === "Literal") {
                if (!value.startsWith(`${this.packageName}.`)) {
                  throw new Error(
                    `Invalid preview brick: "${value}", expecting prefixed with the package name: "${this.packageName}"`
                  );
                }

                if (validEditorName.test(value)) {
                  previewSet.add(value);
                } else {
                  throw new Error(
                    `Invalid preview brick: "${value}", expecting: "PACKAGE-NAME.BRICK-NAME--preview", where PACKAGE-NAME and BRICK-NAME must be lower-kebab-case, and BRICK-NAME must include a \`-\``
                  );
                }
              } else {
                throw new Error(
                  "Please call `customElements.define()` only with literal string"
                );
              }
            }
          });
      });
    });
    compiler.hooks.emit.tap(pluginName, (compilation) => {
      const previews = Array.from(previewSet);

      const previewsAssetFilePath = Object.keys(compilation.assets).find(
        (filePath) =>
          filePath.startsWith("previews.") && filePath.endsWith(".js")
      );
      const previewsJsFilePath =
        previewsAssetFilePath &&
        `bricks/${this.packageName}/dist/previews/${previewsAssetFilePath}`;

      const source = JSON.stringify({ previews, previewsJsFilePath }, null, 2);

      compilation.assets["previews.json"] = {
        source: () => source,
        size: () => source.length,
      };
      console.log("Defined preview bricks:", previews);
    });
  }
};
