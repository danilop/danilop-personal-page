export default {
  extends: ["stylelint-config-standard"],
  rules: {
    // WebMCP declarative forms; browsers without WebMCP ignore these rules.
    "selector-pseudo-class-no-unknown": [
      true,
      { ignorePseudoClasses: ["tool-form-active", "tool-submit-active"] },
    ],
  },
  overrides: [
    { files: ["**/*.astro", "**/*.html"], customSyntax: "postcss-html" },
    // Astro consumes :global at compile time; it is not a browser pseudo-class.
    {
      files: ["**/*.astro"],
      rules: {
        "selector-pseudo-class-no-unknown": [
          true,
          { ignorePseudoClasses: ["global"] },
        ],
      },
    },
  ],
  ignoreFiles: [
    "**/node_modules/**",
    "**/dist/**",
    "legacy/**",
    "public/**",
    ".generated/**",
  ],
};
