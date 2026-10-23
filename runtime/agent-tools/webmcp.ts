import { runTool } from "./registry";
import { agentTools } from "./tools";
import { agentToolsEnabled } from "./setting";

type RegisteredTool = { name: string; origin?: string };
type ModelContext = EventTarget & {
  registerTool(
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: object;
      execute(input: unknown): Promise<unknown>;
    },
    options: { signal: AbortSignal },
  ): Promise<unknown>;
  getTools(): Promise<RegisteredTool[]>;
};

/** Expose the page's tools to the browser's agent until disabled or unload. */
export function mountWebMcp(context: ModelContext) {
  let controller: AbortController | undefined;
  const ours = new Set<string>();
  async function register() {
    if (controller || !agentToolsEnabled()) return;
    controller = new AbortController();
    const signal = controller.signal;
    for (const tool of agentTools.filter((t) => t.available(document))) {
      ours.add(tool.name);
      try {
        await context.registerTool(
          {
            name: tool.name,
            title: tool.title,
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: tool.annotations,
            async execute(input) {
              const outcome = await runTool(tool, input, { caller: "webmcp" });
              return outcome.ok ? outcome.result : { error: outcome.error };
            },
          },
          { signal },
        );
      } catch (error) {
        console.error(`Could not register ${tool.name}`, error);
      }
    }
  }
  function unregister() {
    controller?.abort();
    controller = undefined;
  }
  // Tool-surface integrity: other scripts on the page could add tools.
  if (import.meta.env?.DEV)
    context.addEventListener("toolchange", () => {
      void context.getTools().then((tools) => {
        const foreign = tools.filter(
          (t) =>
            !ours.has(t.name) &&
            !document.querySelector(`form[toolname="${t.name}"]`),
        );
        if (foreign.length)
          console.warn(
            "Unexpected WebMCP tools:",
            foreign.map((t) => t.name),
          );
      });
    });
  document.addEventListener("notes:agent-tools-setting", () =>
    agentToolsEnabled() ? void register() : unregister(),
  );
  window.addEventListener("pagehide", unregister);
  return register();
}
