import js from "@eslint/js";
import globals from "globals";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  js.configs.recommended,
  {
    ignores: ["public/inject.js", "src/filter/homoglyphs.js", "logs/**", "node_modules/**"],
  },
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
        Bun: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-control-regex": "off",
      "no-useless-escape": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      // The filter normalisation regexes intentionally embed zero-width / bidi /
      // homoglyph characters that ESLint considers "irregular".
      "no-irregular-whitespace": ["error", { skipRegExps: true, skipStrings: true }],
    },
  },
  // Must come last so Prettier-conflicting rules from above are disabled.
  eslintConfigPrettier,
];
