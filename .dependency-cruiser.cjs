// Runtime dependency graph: type-only imports are deliberately omitted.
const { builtinModules } = require("node:module");
const browser = "^(runtime/|authoring/|prototypes/ink-and-paper/src/)";
const production =
  "^(core|runtime|renderers|themes|site|authoring|lib|infrastructure)/";
module.exports = {
  forbidden: [
    {
      name: "no-runtime-cycles",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "browser-no-node",
      severity: "error",
      from: { path: browser },
      to: {
        path: `^(node:)?(${builtinModules.map((name) => name.replace(/^node:/, "")).join("|")})$`,
        reachable: true,
      },
    },
    {
      name: "browser-no-private-tools",
      severity: "error",
      from: { path: browser },
      to: {
        path: "^(core/author[^/]*\\.|scripts/|tools/|renderers/)",
        reachable: true,
      },
    },
    {
      name: "core-no-entrypoints",
      severity: "error",
      from: { path: "^core/" },
      to: { path: "^(scripts|site|themes|authoring|tools|test|prototypes)/" },
    },
    {
      name: "production-no-prototypes-or-tests",
      severity: "error",
      from: { path: production },
      to: { path: "^(prototypes|test)/", reachable: true },
    },
    {
      name: "prototype-no-production",
      severity: "error",
      from: { path: "^prototypes/" },
      to: { path: production },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: {
      path: "(^|/)(node_modules|dist|coverage|\\.generated|\\.analysis)/",
    },
    tsPreCompilationDeps: false,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
