import globals from "globals";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.ts"],
    ignores: ["vite.config.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json",
      },
      globals: {
        ...globals.browser,
        ...globals.es2020,
        THREE: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      "no-const-assign": "error",
      "no-this-before-super": "error",
      "no-undef": "error",
      "no-unreachable": "error",
      "constructor-super": "error",
      "valid-typeof": "error",
      "linebreak-style": ["error", "unix"],
      "quotes": ["error", "single", { "allowTemplateLiterals": true }],
      "semi": ["error", "always"],
      "no-multiple-empty-lines": ["error", { "max": 2 }],
      "no-trailing-spaces": "error",
      "eqeqeq": ["error", "always"],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn"
    }
  }
];
