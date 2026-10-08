import expoConfig from "eslint-config-expo/flat.js";
import eslintConfigPrettier from "eslint-config-prettier";

/** @type {import("eslint").Linter.Config[]} */
export const config = [
  ...expoConfig,
  eslintConfigPrettier,
  { ignores: ["dist/**", ".expo/**"] },
];
