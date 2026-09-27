export default {
  extends: ["stylelint-config-standard"],
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
