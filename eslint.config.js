import js from "@eslint/js";
import globals from "globals";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
        Bun: "readonly",
        process: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-control-regex": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-useless-escape": "off",
    },
  },
  // Must come last so Prettier-conflicting rules from above are disabled.
  eslintConfigPrettier,
];
