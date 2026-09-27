/* Shared local authoring interactions; no provider calls. */
(() => {
  window.authorDiff = (out, before, after) => {
    const a = before.split(/(\s+)/),
      b = after.split(/(\s+)/);
    let i = 0,
      j = a.length,
      k = b.length;
    while (i < j && i < k && a[i] === b[i]) i++;
    while (j > i && k > i && a[j - 1] === b[k - 1]) {
      j--;
      k--;
    }
    const del = document.createElement("del"),
      ins = document.createElement("ins");
    del.textContent = a.slice(i, j).join("");
    ins.textContent = b.slice(i, k).join("");
    out.replaceChildren(
      document.createTextNode(a.slice(Math.max(0, i - 16), i).join("")),
      del,
      document.createTextNode(" "),
      ins,
      document.createTextNode(b.slice(k, k + 16).join("")),
    );
    if (before === after)
      out.textContent = "No differences from the current text.";
  };
  const prose = document.createElement("textarea");
  prose.id = "proseEditor";
  prose.setAttribute("aria-label", "Article text");
  prose.spellcheck = false;
  editor.after(prose);
  const sourceMode = document.createElement("button");
  sourceMode.textContent = "Full source";
  sourceMode.setAttribute("aria-pressed", "false");
  document.querySelector(".write-heading").append(sourceMode);
  let fullSource = false;
  const headerLength = () =>
    /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n)?/.exec(editor.value)?.[0].length || 0;
  window.syncAuthorEditor = () => {
    const bodyMode =
      !fullSource && file.endsWith("/index.md") && headerLength() > 0;
    editor.hidden = bodyMode;
    prose.hidden = !bodyMode;
    if (bodyMode && prose.value !== editor.value.slice(headerLength()))
      prose.value = editor.value.slice(headerLength());
    sourceMode.hidden = !file.endsWith("/index.md");
    sourceMode.textContent = fullSource ? "Article text" : "Full source";
    sourceMode.setAttribute("aria-pressed", String(fullSource));
  };
  sourceMode.onclick = () => {
    fullSource = !fullSource;
    window.syncAuthorEditor();
  };
  const syncSelection = () =>
    editor.setSelectionRange(
      headerLength() + prose.selectionStart,
      headerLength() + prose.selectionEnd,
    );
  for (const type of ["select", "keyup", "click", "blur"])
    prose.addEventListener(type, syncSelection);
  prose.addEventListener("blur", () => editor.dispatchEvent(new Event("blur")));
  prose.addEventListener("input", () => {
    editor.value = editor.value.slice(0, headerLength()) + prose.value;
    syncSelection();
    editor.dispatchEvent(new Event("input"));
  });
  window.syncAuthorEditor();
  window.revealFinding = (start, end) => {
    if (matchMedia("(max-width: 760px)").matches) window.authorPane("write");
    if (start < headerLength()) {
      fullSource = true;
      window.syncAuthorEditor();
    }
    const visible = editor.hidden ? prose : editor,
      offset = editor.hidden ? headerLength() : 0;
    const style = getComputedStyle(visible),
      mirror = document.createElement("div");
    for (const key of [
      "fontFamily",
      "fontSize",
      "fontWeight",
      "lineHeight",
      "letterSpacing",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "wordBreak",
      "overflowWrap",
      "tabSize",
    ])
      mirror.style[key] = style[key];
    Object.assign(mirror.style, {
      position: "fixed",
      visibility: "hidden",
      left: "-10000px",
      top: "0",
      boxSizing: "border-box",
      width: visible.clientWidth + "px",
      whiteSpace: "pre-wrap",
    });
    const marker = document.createElement("span");
    marker.textContent = editor.value.slice(start, end) || "\u200b";
    mirror.append(
      document.createTextNode(editor.value.slice(offset, start)),
      marker,
      document.createTextNode(editor.value.slice(end) || "\u200b"),
    );
    document.body.append(mirror);
    const top =
      marker.getBoundingClientRect().top - mirror.getBoundingClientRect().top;
    editor.setSelectionRange(start, end);
    visible.focus({ preventScroll: true });
    visible.setSelectionRange(start - offset, end - offset);
    visible.scrollTop = Math.max(0, top - visible.clientHeight / 3);
    mirror.remove();
  };
  const tabs = document.querySelector(".review-tabs");
  $("preview-pane").before(tabs);
  window.authorPane = (mode) => {
    document.body.dataset.pane = mode;
    for (const name of ["Write", "Preview", "Review", "Images"])
      $("show-" + name.toLowerCase()).setAttribute(
        "aria-pressed",
        String(mode === name.toLowerCase()),
      );
  };
  window.authorPane(
    matchMedia("(max-width:760px)").matches ? "write" : "preview",
  );
  $("show-write").onclick = () => window.authorPane("write");
  for (const [id, mode] of [
    ["show-preview", "preview"],
    ["show-review", "review"],
    ["show-images", "images"],
  ])
    $(id).addEventListener("click", () => window.authorPane(mode));
  let full = false;
  window.authorPreview = (html) => {
    if (full) return html;
    const doc = new DOMParser().parseFromString(html, "text/html"),
      style = doc.createElement("style");
    style.textContent =
      ".authoring-notice,.paper>header,.paper>footer,body>header,body>footer{display:none!important}.paper{margin:0!important;padding:20px!important}main{padding-top:0!important}.reading{padding-top:0!important}.article-heading{margin-top:0!important}";
    doc.head.append(style);
    return doc.documentElement.outerHTML;
  };
  $("preview-mode").onclick = () => {
    full = !full;
    $("preview-mode").textContent = full ? "Article only" : "Full page";
    $("preview-mode").setAttribute("aria-pressed", String(full));
    sequence++;
    render();
  };
  const headings = document.createElement("select");
  headings.id = "preview-heading";
  headings.setAttribute("aria-label", "Jump to heading");
  document.querySelector(".preview-options").append(headings);
  document.querySelector("iframe").addEventListener("load", () => {
    const doc = document.querySelector("iframe").contentDocument;
    const items = Array.from(
      doc?.querySelectorAll("article h1,article h2,article h3") || [],
    );
    headings.replaceChildren(
      new Option("Jump to heading", ""),
      ...items.map((e, i) => new Option(e.textContent, String(i))),
    );
    headings.hidden =
      !items.length ||
      $("show-preview").getAttribute("aria-pressed") !== "true";
    headings.onchange = () => {
      if (headings.value !== "")
        items[Number(headings.value)]?.scrollIntoView({ block: "start" });
    };
  });
  async function catalog() {
    const rows = await api("catalog");
    if (!Array.isArray(rows)) return;
    const current = $("files").value,
      groups = [];
    for (const name of ["Articles", "Books and collections", "Settings"]) {
      const group = document.createElement("optgroup");
      group.label = name;
      rows
        .filter((r) => r.group === name)
        .forEach((r) =>
          group.append(
            new Option(r.title + (r.draft ? " · Draft" : ""), r.file),
          ),
        );
      if (group.children.length) groups.push(group);
    }
    $("files").replaceChildren(...groups);
    $("files").value = current;
  }
  // Wait for initial source loading, then enhance the existing list.
  const ready = setInterval(() => {
    if (!file) return;
    clearInterval(ready);
    catalog().catch(() => {});
  }, 300);
  let tagRows = [];
  function tags() {
    const used = $("tags-field")
        .value.split(",")
        .map((s) => s.trim()),
      last = used.at(-1).toLowerCase(),
      query = tagRows.some((r) => r.id === last) ? "" : last;
    const rows = tagRows
      .filter(
        (r) =>
          !used.includes(r.id) &&
          (!query ||
            r.id.includes(query) ||
            r.label.toLowerCase().includes(query)),
      )
      .slice(0, 8);
    $("tag-suggestions").replaceChildren(
      ...rows.map((r) => {
        const b = document.createElement("button");
        b.textContent = `${r.label} · ${r.published + r.draft}`;
        b.title = `${r.published} published · ${r.draft} drafts. ${r.description}`;
        b.onclick = () => {
          let parts = $("tags-field")
            .value.split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          if (query && !tagRows.some((t) => t.id === query)) parts.pop();
          parts.push(r.id);
          $("tags-field").value = [...new Set(parts)].join(", ") + ", ";
          $("tags-field").dispatchEvent(new Event("input"));
          tags();
        };
        return b;
      }),
    );
  }
  $("tags-field").addEventListener("input", tags);
  $("metadata").addEventListener("toggle", async () => {
    if (!$("metadata").open) return;
    try {
      tagRows = await api("tags");
      if (Array.isArray(tagRows)) tags();
    } catch {
      /* Keep the last loaded tag suggestions when refresh is unavailable. */
    }
  });
})();
