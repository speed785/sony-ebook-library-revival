import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";

export default [
  js.configs.recommended,
  {
    files: ["scripts/**/*.mjs", "*.js"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
      },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser,
      parserOptions: {
        project: false,
      },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        HTMLElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLButtonElement: "readonly",
        URLSearchParams: "readonly",
        Event: "readonly",
        DragEvent: "readonly",
        File: "readonly",
        FileList: "readonly",
        KeyboardEvent: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "no-undef": "off",
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
  {
    ignores: ["dist", "src-tauri/target"],
  },
];
