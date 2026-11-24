const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

const escapeForRegex = (p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\\|\//g, "[\\\\/]");

const ignoredPaths = [
  path.resolve(monorepoRoot, "apps", "api"),
  path.resolve(projectRoot, "dist"),
  path.resolve(monorepoRoot, ".turbo"),
  path.resolve(monorepoRoot, "ERP_FILE"),
].map((dir) => new RegExp(`^${escapeForRegex(dir)}(?:[\\\\/].*)?$`));

const existingBlockList = config.resolver.blockList
  ? Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : [config.resolver.blockList]
  : [];

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
config.resolver.blockList = [...existingBlockList, ...ignoredPaths];

module.exports = withNativeWind(config, {
  input: "./src/global.css",
  inlineRem: 16,
});
