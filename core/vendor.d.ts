declare module "@citation-js/core" {
  export class Cite {
    constructor(data: unknown);
    data: { id: string; [key: string]: unknown }[];
    format(type: string, options: unknown): string;
  }
}
declare module "@citation-js/plugin-bibtex";
declare module "@citation-js/plugin-csl";
