import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, X, CornersOut } from "@phosphor-icons/react";
import "@fontsource/newsreader/latin-400.css";
import "@fontsource/newsreader/latin-500.css";
import "@fontsource/newsreader/latin-600.css";
import "@fontsource/newsreader/latin-400-italic.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";

const articles = [
  {
    id: "memory",
    title: "Why agents need more than conversation history",
    summary:
      "Working memory, persistent knowledge, and the context that connects them.",
    date: "12 Sep 2026",
    iso: "2026-09-12",
    collection: "agents",
    body: [
      [
        "A conversation is only a beginning",
        "A conversation records what was said. An agent also needs to keep track of what it is doing, which facts matter, and what remains uncertain. Those are related responsibilities, but they need different kinds of memory.",
      ],
      [
        "Keep working memory focused",
        "Working memory holds the information needed for the next decision: the task, relevant observations, and the current plan. Its usefulness depends on selecting what matters, rather than collecting everything.",
      ],
      [
        "Make persistence deliberate",
        "Longer-lived knowledge needs provenance and a way to be corrected. An observation from one task should not silently become a permanent assumption about the next. Thinking about these boundaries is a useful starting point for more dependable systems.",
      ],
    ],
  },
  {
    id: "simulations",
    title: "Small simulations, better explanations",
    summary: "Simple models can make complex systems feel concrete again.",
    date: "10 Sep 2026",
    iso: "2026-09-10",
    collection: "systems",
    body: [
      [
        "A small model you can question",
        "A useful simulation makes its assumptions visible. Start with a small set of rules, change one input, and observe what follows. The interesting part is often the difference between what you expected and what happened.",
      ],
      [
        "Explain the boundary",
        "Every model leaves something out. Put those omissions beside the controls, and give readers a way to reset the experiment. A repeatable starting point makes comparisons easier to discuss.",
      ],
    ],
  },
  {
    id: "diagrams",
    title: "What a diagram leaves out",
    summary:
      "Diagrams clarify, but they also hide. Looking beyond the picture helps us ask better questions.",
    date: "7 Sep 2026",
    iso: "2026-09-07",
    collection: "systems",
    body: [
      [
        "The missing dimension",
        "An arrow can mean a dependency, a message, a sequence, or a flow of data. A diagram becomes more useful when it tells the reader which of those meanings to bring to it.",
      ],
      [
        "Pair the picture with a question",
        "Ask what would change if a connection failed, an input arrived late, or a component had incomplete information. The answers can reveal what the picture does not yet explain.",
      ],
    ],
  },
  {
    id: "skies",
    title: "A night under darker skies",
    summary: "Less light, more stars, and a deeper sense of perspective.",
    date: "3 Sep 2026",
    iso: "2026-09-03",
    body: [
      [
        "Time to look up",
        "A darker sky changes the experience of looking. Patterns become easier to find, and familiar stars begin to sit inside a much larger landscape.",
      ],
      [
        "A place for photographs",
        "This visual study uses an illustrative night-sky image. The finished website will feature selected photographs and albums, with their own captions and stories.",
      ],
    ],
  },
];
const collections = [
  {
    id: "agents",
    title: "Building Reliable Agents",
    label: "Growing book",
    subtitle: "From first principles to dependable systems.",
    description:
      "Ideas, patterns, and practical notes for building AI systems that are reliable, transparent, and useful.",
    cover: "reliable-agents-cover.png",
    articles: ["memory"],
  },
  {
    id: "systems",
    title: "Thinking in Systems",
    label: "Collection",
    subtitle: "Models, diagrams, and small experiments.",
    description:
      "A collection of notes on systems thinking, mental models, and visual ways to make sense of complexity.",
    cover: "thinking-systems-cover.png",
    articles: ["simulations", "diagrams"],
  },
];
function TextLink({ children, onClick, className = "" }) {
  return (
    <button className={`text-link ${className}`} onClick={onClick}>
      {children}
      <ArrowRight size={18} aria-hidden="true" />
    </button>
  );
}

export function App() {
  const [panel, setPanel] = useState(null);
  const dialog = useRef(null);
  const origin = useRef(null);
  const lead = articles[0];
  const open = (type, id) => {
    if (!panel) origin.current = document.activeElement;
    setPanel({ type, id });
  };
  const close = () => {
    setPanel(null);
    origin.current?.focus();
  };
  useEffect(() => {
    const el = dialog.current;
    if (panel && !el.open) el.showModal();
    if (panel) {
      el.scrollTop = 0;
      el.querySelector(".close-dialog")?.focus();
    }
    if (!panel && el.open) el.close();
    document.body.style.overflow = panel ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [panel]);
  const article =
    panel?.type === "article" ? articles.find((a) => a.id === panel.id) : null;
  const collection =
    panel?.type === "collection"
      ? collections.find((c) => c.id === panel.id)
      : null;
  return (
    <>
      <a href="#writing" className="skip-link">
        Skip to writing
      </a>
      <div className="paper">
        <header className="masthead">
          <div className="identity">
            <h1>Danilo Poccia</h1>
            <p>Notes Along the Way</p>
          </div>
          <button
            className="portrait-link"
            onClick={() => open("about")}
            aria-label="About Danilo Poccia"
          >
            <img
              src="/assets/portrait-ink.png"
              alt="Blue ink portrait of Danilo Poccia"
              width="178"
              height="157"
            />
          </button>
          <nav aria-label="Main navigation">
            <a href="#writing">Writing</a>
            <a href="#collections">Collections</a>
            <a href="#photography">Photography</a>
            <button onClick={() => open("about")}>About</button>
          </nav>
          <span className="masthead-note">Ideas / experiments / places</span>
        </header>
        <main>
          <section
            className="front-page"
            id="writing"
            aria-label="Featured and recent writing"
            tabIndex={-1}
          >
            <article className="lead">
              <p className="eyebrow">Featured</p>
              <h2>
                <button onClick={() => open("article", lead.id)}>
                  {lead.title}
                </button>
              </h2>
              <p className="lead-summary">{lead.summary}</p>
              <div className="metadata">
                <time dateTime={lead.iso}>{lead.date}</time>
                <span aria-hidden="true">|</span>
                <button onClick={() => open("collection", "agents")}>
                  Building Reliable Agents
                </button>
              </div>
              <button
                className="article-art"
                onClick={() => open("article", lead.id)}
                aria-label={`Read ${lead.title}`}
              >
                <img
                  src="/assets/memory-notebooks.png"
                  alt="Three ink-drawn notebooks connect conversation history, working memory, and persistent knowledge."
                  width="1200"
                  height="430"
                />
              </button>
            </article>
            <aside className="recent" aria-labelledby="recent-title">
              <h2 id="recent-title">Recent writing</h2>
              {articles.slice(1).map((a) => (
                <article className="recent-story" key={a.id}>
                  <h3>
                    <button onClick={() => open("article", a.id)}>
                      {a.title}
                    </button>
                  </h3>
                  <p>{a.summary}</p>
                  <time dateTime={a.iso}>{a.date}</time>
                </article>
              ))}
            </aside>
          </section>
          <section
            className="collections"
            id="collections"
            aria-labelledby="collections-title"
          >
            <header className="section-heading">
              <h2 id="collections-title">Collections &amp; books</h2>
              <p>Longer explorations</p>
            </header>
            <div className="collection-grid">
              {collections.map((c) => (
                <article className="collection" key={c.id}>
                  <button
                    className="cover-link"
                    onClick={() => open("collection", c.id)}
                    aria-label={`Explore ${c.title}`}
                  >
                    <img
                      src={`/assets/${c.cover}`}
                      alt={`${c.title}, by Danilo Poccia — concept cover`}
                      width="140"
                      height="210"
                    />
                  </button>
                  <div className="collection-copy">
                    <p className="eyebrow">{c.label}</p>
                    <h3>
                      <button onClick={() => open("collection", c.id)}>
                        {c.title}
                      </button>
                    </h3>
                    <p className="collection-subtitle">{c.subtitle}</p>
                    <p className="collection-description">{c.description}</p>
                    <TextLink onClick={() => open("collection", c.id)}>
                      Explore
                    </TextLink>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section
            className="photography"
            id="photography"
            aria-labelledby="photo-title"
          >
            <header className="section-heading">
              <h2 id="photo-title">Through the lens</h2>
              <p>A change of perspective</p>
            </header>
            <figure>
              <button
                className="gallery-image"
                onClick={() => open("gallery")}
                aria-label="Enlarge Nights under the stars"
              >
                <img
                  src="/assets/night-sky.png"
                  alt="A star-filled night sky above a mountain lake, with dark pines framing the horizon. Illustrative image."
                  width="1800"
                  height="400"
                />
                <span className="enlarge">
                  <CornersOut size={21} aria-hidden="true" />
                  <span>View photograph</span>
                </span>
              </button>
              <figcaption>Nights under the stars</figcaption>
            </figure>
          </section>
        </main>
        <footer>
          <p>
            Danilo Poccia <span>/</span> <em>Notes Along the Way</em>
          </p>
          <div className="footer-links">
            <a
              href="https://www.danilop.net/posts.html"
              target="_blank"
              rel="noreferrer"
            >
              Earlier work
              <ArrowUpRight size={13} aria-hidden="true" />
            </a>
            <button onClick={() => open("feed")}>RSS</button>
          </div>
          <small>Design preview · illustrative content</small>
        </footer>
      </div>
      <dialog
        ref={dialog}
        className={
          panel?.type === "gallery" ? "reader gallery-dialog" : "reader"
        }
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const r = e.currentTarget.getBoundingClientRect();
            if (
              e.clientX < r.left ||
              e.clientX > r.right ||
              e.clientY < r.top ||
              e.clientY > r.bottom
            )
              close();
          }
        }}
        aria-labelledby="panel-title"
      >
        <button className="close-dialog" onClick={close} aria-label="Close">
          <X size={24} aria-hidden="true" />
        </button>
        {article && (
          <div className="reading-content">
            <p className="eyebrow">Notes Along the Way · sample article</p>
            <h2 id="panel-title">{article.title}</h2>
            <p className="reader-summary">{article.summary}</p>
            <div className="metadata">
              <time dateTime={article.iso}>{article.date}</time>
              <span>Danilo Poccia</span>
            </div>
            {article.id === "memory" && (
              <img
                className="reader-art"
                src="/assets/memory-notebooks.png"
                alt="Three connected memory notebooks"
              />
            )}
            {article.body.map(([title, body]) => (
              <section key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </section>
            ))}
            {article.collection && (
              <TextLink onClick={() => open("collection", article.collection)}>
                Explore the collection
              </TextLink>
            )}
            <p className="preview-note">
              Illustrative writing for this design preview.
            </p>
          </div>
        )}
        {collection && (
          <div className="reading-content">
            <p className="eyebrow">{collection.label} · sample collection</p>
            <div className="collection-intro">
              <img
                src={`/assets/${collection.cover}`}
                alt="Concept book cover"
                width="140"
                height="210"
              />
              <div>
                <h2 id="panel-title">{collection.title}</h2>
                <p className="reader-summary">{collection.subtitle}</p>
                <p>{collection.description}</p>
              </div>
            </div>
            <h3>Inside this collection</h3>
            <ol className="contents">
              {collection.articles.map((id) => {
                const a = articles.find((item) => item.id === id);
                return (
                  <li key={id}>
                    <TextLink onClick={() => open("article", id)}>
                      {a.title}
                    </TextLink>
                    <p>{a.summary}</p>
                  </li>
                );
              })}
            </ol>
            <p className="preview-note">
              Illustrative structure for this design preview. These are not
              published books.
            </p>
          </div>
        )}
        {panel?.type === "gallery" && (
          <div className="gallery-content">
            <p className="eyebrow">Through the lens</p>
            <h2 id="panel-title">Nights under the stars</h2>
            <img
              src="/assets/night-sky.png"
              alt="Illustrative star-filled alpine sky and lake."
            />
            <p>
              This generated image illustrates the gallery layout. Danilo’s
              photographs and iCloud albums will be selected separately.
            </p>
          </div>
        )}
        {panel?.type === "about" && (
          <div className="reading-content">
            <p className="eyebrow">About</p>
            <h2 id="panel-title">Danilo Poccia</h2>
            <div className="about-content">
              <img
                src="/assets/portrait-photo.jpg"
                alt="Danilo Poccia smiling, wearing a blue wave-print shirt"
              />
              <div>
                <p className="reader-summary">Notes Along the Way</p>
                <p>
                  A place for writing, projects, photographs, and experiments —
                  and ideas that can grow into collections and books.
                </p>
                <p>
                  <a
                    href="https://www.danilop.net/about.html"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Read the current biography
                  </a>
                </p>
                <p>
                  <a
                    href="https://github.com/danilop"
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}
        {panel?.type === "feed" && (
          <div className="reading-content">
            <p className="eyebrow">Follow the writing</p>
            <h2 id="panel-title">RSS</h2>
            <p className="reader-summary">New articles, in your own reader.</p>
            <p>
              The rebuilt publication will have an RSS feed. This visual preview
              does not publish a live feed yet.
            </p>
            <TextLink onClick={close}>Back to the homepage</TextLink>
          </div>
        )}
      </dialog>
    </>
  );
}
