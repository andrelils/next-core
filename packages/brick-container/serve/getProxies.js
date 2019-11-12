const modifyResponse = require("./modifyResponse");
const {
  getSingleBrickPackage,
  getSingleStoryboard,
  getSingleTemplatePackage
} = require("./utils");

module.exports = env => {
  const {
    useOffline,
    useSubdir,
    useRemote,
    publicPath,
    localBrickPackages,
    localMicroApps,
    localTemplates,
    server
  } = env;

  const pathRewriteFactory = seg =>
    useSubdir
      ? undefined
      : {
          [`^/${seg}`]: `/next/${seg}`
        };

  const proxyPaths = ["api"];
  const otherProxyOptions = {};
  if (useRemote) {
    proxyPaths.push("bricks", "micro-apps", "templates");
    if (
      localBrickPackages.length > 0 ||
      localMicroApps.length > 0 ||
      localTemplates.length > 0
    ) {
      otherProxyOptions.onProxyRes = (proxyRes, req, res) => {
        // 设定透传远端请求时，可以指定特定的 brick-packages, micro-apps, templates 使用本地文件。
        if (
          req.path === "/next/api/auth/bootstrap" ||
          req.path === "/api/auth/bootstrap"
        ) {
          modifyResponse(res, proxyRes, raw => {
            const result = JSON.parse(raw);
            const { data } = result;
            if (localMicroApps.length > 0) {
              data.storyboards = data.storyboards
                .filter(
                  item => !(item.app && localMicroApps.includes(item.app.id))
                )
                .concat(
                  localMicroApps
                    .map(id => getSingleStoryboard(env, id))
                    .filter(Boolean)
                );
            }
            if (localBrickPackages.length > 0) {
              data.brickPackages = data.brickPackages
                .filter(
                  item =>
                    !localBrickPackages.includes(item.filePath.split("/")[1])
                )
                .concat(
                  localBrickPackages
                    .map(id => getSingleBrickPackage(env, id))
                    .filter(Boolean)
                );
            }
            if (localTemplates.length > 0) {
              data.templatePackages = data.templatePackages
                .filter(
                  item => !localTemplates.includes(item.filePath.split("/")[1])
                )
                .concat(
                  localTemplates
                    .map(id => getSingleTemplatePackage(env, id))
                    .filter(Boolean)
                );
            }
            return JSON.stringify(result);
          });
        }
      };
    }
  }

  return useOffline
    ? undefined
    : proxyPaths.reduce((acc, seg) => {
        acc[`${publicPath}${seg}`] = {
          target: server,
          changeOrigin: true,
          pathRewrite: pathRewriteFactory(seg),
          headers: {
            "dev-only-login-page": `http://localhost:8081${publicPath}auth/login`
          },
          ...otherProxyOptions
        };
        return acc;
      }, {});
};
