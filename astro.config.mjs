import { defineConfig } from "astro/config";
export default defineConfig({
  site: "https://www.danilop.net",
  srcDir: "./site",
  publicDir: "./.generated/public",
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  vite: { build: { target: "es2022" } },
  devToolbar: { enabled: false },
});
