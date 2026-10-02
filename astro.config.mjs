import { defineConfig } from "astro/config";
import { deployment, siteOutput } from "./core/deployment.mjs";
export default defineConfig({
  site: deployment.origin,
  base: deployment.basePath,
  outDir: siteOutput,
  srcDir: "./site",
  publicDir: "./.generated/public",
  cacheDir: "./.astro/cache",
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  vite: { cacheDir: "./.astro/vite", build: { target: "es2022" } },
  devToolbar: { enabled: false },
});
