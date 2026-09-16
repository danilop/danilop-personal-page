import { defineConfig } from "astro/config";
import { deployment, siteOutput } from "./core/deployment.mjs";
export default defineConfig({
  site: "https://www.danilop.net",
  base: deployment.basePath,
  outDir: siteOutput,
  srcDir: "./site",
  publicDir: "./.generated/public",
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  vite: { build: { target: "es2022" } },
  devToolbar: { enabled: false },
});
