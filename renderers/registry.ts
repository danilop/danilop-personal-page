import { z } from "zod";
import type { Block, Selection, Target, Preferences } from "../core/model";
import type { Assets } from "../core/assets";
export type Rendition = { html: string; asset?: string; markdown?: string };
export type Request = {
  block: Block;
  target: Target;
  options: Record<string, unknown>;
  owner: string;
  assets: Assets;
};
export type Plugin = {
  id: string;
  version: string;
  kinds: Block["kind"][];
  formats: string[];
  targets: Target[];
  options: z.ZodType<Record<string, unknown>>;
  render: (r: Request) => Promise<Rendition>;
};
export class Registry {
  plugins = new Map<string, Plugin>();
  register(p: Plugin) {
    if (this.plugins.has(p.id)) throw Error(`Duplicate renderer ${p.id}`);
    this.plugins.set(p.id, p);
    return this;
  }
  resolve(
    block: Block,
    target: Target,
    defaults: any,
    layers: Preferences[] = [],
  ) {
    let chosen: Selection = {};
    const apply = (next: Selection | undefined) => {
      if (!next) return;
      if (next.plugin && next.plugin !== chosen.plugin)
        chosen = { plugin: next.plugin, options: { ...next.options } };
      else
        chosen = {
          plugin: next.plugin ?? chosen.plugin,
          options: { ...chosen.options, ...next.options },
        };
    };
    apply(defaults[target]?.[block.kind]);
    apply(defaults.formats?.[String(block.source.format)]);
    for (const layer of layers) apply(layer[target]?.[block.kind]);
    apply(block.render?.[target]);
    const p = this.plugins.get(chosen.plugin ?? "");
    if (!p) throw Error(`Unknown renderer: ${chosen.plugin}`);
    if (
      !p.kinds.includes(block.kind) ||
      !p.formats.includes(String(block.source.format)) ||
      !p.targets.includes(target)
    )
      throw Error(
        `Renderer ${p.id} incompatible with ${block.kind}/${block.source.format}/${target}`,
      );
    return { plugin: p, options: p.options.parse(chosen.options ?? {}) };
  }
}
