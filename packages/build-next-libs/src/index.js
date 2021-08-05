const execa = require("execa");

execa(
  "babel",
  [
    "src",
    "--out-dir",
    "dist/esm",
    "--config-file",
    "../../babel.config.js",
    "--extensions",
    ".ts,.tsx,.js,.jsx",
    "--ignore",
    "src/**/*.spec.tsx,src/**/*.spec.ts,src/**/*.d.ts",
    "--copy-files",
    "--no-copy-ignored",
    "--source-maps",
  ],
  {
    stdio: "inherit",
  }
).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
