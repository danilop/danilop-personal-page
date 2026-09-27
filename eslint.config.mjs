import js from "@eslint/js";
import ts from "typescript-eslint";
import astro from "eslint-plugin-astro";
import sonar from "eslint-plugin-sonarjs";
import html from "eslint-plugin-html";
import globals from "globals";
import react from "@eslint-react/eslint-plugin";
import hooks from "eslint-plugin-react-hooks";
import a11y from "eslint-plugin-jsx-a11y-x";
import yaml from "eslint-plugin-yml";
import json from "eslint-plugin-jsonc";

const code = ["**/*.{js,mjs,cjs,jsx,ts,astro,html}"];
const typed = [
  "core/**/*.ts",
  "scripts/**/*.ts",
  "runtime/**/*.ts",
  "renderers/**/*.ts",
  "themes/**/*.ts",
  "site/**/*.ts",
  "test/**/*.ts",
];
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.venv*/**",
      ".git/**",
      ".astro/**",
      ".generated/**",
      ".cache/**",
      ".analysis/**",
      ".authoring-state/**",
      ".publication-state/**",
      "coverage/**",
      "public/**",
      "legacy/**",
      "cache/**",
      "exports/**",
      "data/**",
      "content/**",
      "site-assets/**",
      "**/package-lock.json",
    ],
  },
  {
    ...js.configs.recommended,
    files: code,
    languageOptions: { globals: globals.node },
  },
  ...ts.configs.recommended.map((config) => ({ ...config, files: typed })),
  {
    files: typed,
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["test/**/*.ts"],
    rules: {
      // node:test owns top-level test registration promises; application promises still require handling.
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          allowForKnownSafeCalls: [
            { from: "package", package: "node:test", name: "test" },
          ],
        },
      ],
    },
  },
  ...astro.configs.recommended,
  ...astro.configs["jsx-a11y-recommended"],
  {
    files: ["**/*.astro"],
    languageOptions: { parserOptions: { parser: ts.parser } },
  },
  {
    files: code,
    plugins: { sonarjs: sonar },
    rules: {
      complexity: ["error", { max: 20, variant: "classic" }],
      "sonarjs/cognitive-complexity": ["error", 15],
      "sonarjs/no-identical-functions": "error",
      "sonarjs/no-identical-expressions": "error",
      "sonarjs/no-duplicated-branches": "error",
      "sonarjs/no-gratuitous-expressions": "error",
    },
  },
  {
    files: ["**/*.html"],
    plugins: { html },
    languageOptions: { sourceType: "script", globals: globals.browser },
  },
  {
    files: ["authoring/*.js", "static/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.commonjs,
        // Shared classic-script bindings owned by authoring/index.html; no implicit globals elsewhere.
        $: "readonly",
        editor: "readonly",
        api: "readonly",
        file: "readonly",
        base: "readonly",
        changed: "readonly",
        save: "readonly",
        openFile: "readonly",
        saved: "readonly",
        flushMetadata: "readonly",
        sequence: "writable",
        render: "readonly",
      },
    },
  },
  {
    files: ["runtime/**/*.{ts,js}", "**/*.astro/*.js", "**/*.astro/*.ts"],
    languageOptions: { globals: { ...globals.browser, ...globals.worker } },
  },
  {
    files: [
      "processLinks.js",
      "lib/*.js",
      "test/*.js",
      "scripts/sync-posts.js",
    ],
    languageOptions: { sourceType: "commonjs" },
  },
  {
    files: ["test/*-ui.test.js", "test/runtime-dom.test.js"],
    languageOptions: { globals: globals.browser },
  },
  { ...react.configs.recommended, files: ["prototypes/**/*.jsx"] },
  { ...a11y.configs.recommended, files: ["prototypes/**/*.jsx"] },
  {
    files: ["prototypes/**/*.{js,jsx,mjs}"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": hooks },
    rules: hooks.configs.recommended.rules,
  },
  ...yaml.configs["flat/recommended"],
  {
    files: [".github/workflows/*.{yml,yaml}"],
    rules: { "yml/no-empty-mapping-value": "off" },
  },
  ...json.configs["flat/recommended-with-json"],
  {
    ...ts.configs.disableTypeChecked,
    files: ["**/*.astro/*.ts", "**/*.astro/*.js"],
  },
  // The CloudFront runtime invokes the top-level handler by name.
  {
    files: ["infrastructure/shortlinks.js"],
    languageOptions: { globals: { handler: "readonly" } },
    rules: { "no-unused-vars": ["error", { varsIgnorePattern: "^handler$" }] },
  },
];
