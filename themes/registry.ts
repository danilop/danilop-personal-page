import Article from "./ink-and-paper/Article.astro";
import Ink from "./ink-and-paper/Shell.astro";
import Plain from "./plain/Shell.astro";
import InkHome from "./ink-and-paper/Home.astro";
import PlainHome from "./plain/Home.astro";
import ink from "./ink-and-paper/manifest";
import plain from "./plain/manifest";
export const themes = {
  "ink-and-paper": { ...ink, Shell: Ink, Home: InkHome, Article },
  plain: { ...plain, Shell: Plain, Home: PlainHome, Article },
};
