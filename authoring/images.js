/* Local-only illustration workflow. Provider text is never interpreted as HTML. */
(() => {
  let config = null,
    currentFile = "",
    candidates = [],
    selected = null,
    active = null,
    busy = false;
  let stage = "brief";
  const altDrafts = new Map();
  const isCollection = () => /^content\/collections\/[^/]+\.yaml$/.test(file);
  const isContent = () => file.endsWith("/index.md") || isCollection();
  const briefStep = $("image-brief-step"),
    generateStep = $("image-generate-step");
  function step(value) {
    stage = value;
    briefStep.hidden = value !== "brief";
    generateStep.hidden = value !== "generate";
    $("image-selection").hidden = value !== "choose" || !candidates.length;
    for (const b of $("image-steps").children)
      b.setAttribute("aria-pressed", String(b.dataset.step === value));
    if (value === "choose" && !candidates.length)
      note("No candidates yet. Generate an image or import one in Generate.");
  }
  for (const b of $("image-steps").children)
    b.onclick = () => step(b.dataset.step);
  const next = document.createElement("button");
  next.textContent = "Continue to generate";
  next.onclick = () => step("generate");
  briefStep.append(next);
  const note = (s) => {
    $("image-notice").textContent = s;
  };
  const key = () => "author-image-brief:" + location.origin + ":" + currentFile;
  function controls() {
    const piece = isContent();
    const cover = isCollection();
    $("images-heading").textContent = cover
      ? "Create a book or collection cover"
      : "Illustrate your article";
    $("images-panel").setAttribute(
      "aria-label",
      cover ? "Book and collection cover" : "Article images",
    );
    $("image-context-note").textContent = cover
      ? "Suggest brief sends the current title, summary, introduction and outline, with saved article summaries, to the selected agent’s provider. Cover artwork fills the chosen shape, with modest margins and no space reserved for title text."
      : "Suggest brief sends this article, including unsaved edits, to the selected agent’s provider.";
    $("image-caption").closest("label").hidden = cover;
    $("image-position").closest("label").hidden = cover;
    $("insert-image").textContent = cover
      ? "Use as cover"
      : "Insert into article";
    $("remove-cover").hidden = !cover;
    $("remove-cover").disabled = busy;
    $("image-insertion-note").textContent = cover
      ? "Updates the cover in the unsaved collection. Save to refresh the site. Undo restores the previous cover."
      : "Beginning places the image after the title and summary, before the article text. Preview it, then Save. Undo removes the insertion; the candidate stays available.";
    $("suggest-brief").disabled =
      busy ||
      !piece ||
      !config?.agents.some(
        (a) => a.id === $("image-agent").value && a.installed,
      );
    $("generate-image").disabled =
      busy || !piece || !config?.available || !$("image-brief").value.trim();
    $("cancel-image").hidden = !active || active.state !== "running";
    $("insert-image").disabled =
      busy || !selected || !$("image-alt").value.trim();
    $("image-upload").disabled = busy || !piece;
    $("image-agent").disabled = busy;
    $("image-insert-hint").textContent = !$("image-alt").value.trim()
      ? "Add an image description to insert."
      : cover
        ? "Ready to use as cover · Undo is available."
        : "Ready to insert · Undo is available.";
  }
  async function setup() {
    config = await api("image-settings");
    $("image-style").textContent = config.style;
    $("image-agent").replaceChildren(
      ...config.agents.map((a) => {
        const o = new Option(
          a.label + (a.installed ? "" : " — not installed"),
          a.id,
        );
        o.disabled = !a.installed;
        return o;
      }),
    );
    const first = config.agents.find((a) => a.installed);
    if (first) $("image-agent").value = first.id;
    $("image-provider").textContent = config.reason;
    controls();
  }
  async function select(id, touch = true) {
    const f = currentFile,
      r = candidates.find((c) => c.id === id);
    if (!r) return;
    selected = r;
    $("image-alt").value = altDrafts.get(id) ?? r.altText ?? "";
    controls();
    if (touch) await api("image-touch", { id });
    const data = await api("image-data?id=" + encodeURIComponent(id));
    if (currentFile !== f || selected?.id !== id) return;
    $("image-preview").src = data.image;
    $("image-candidate-info").textContent =
      new Date(r.created).toLocaleString() +
      " · " +
      r.width +
      " × " +
      r.height +
      " · " +
      r.model;
    $("reuse-brief").disabled = !r.brief;
    for (const b of $("image-candidates").children)
      b.setAttribute("aria-pressed", String(b.dataset.id === id));
  }
  async function refresh() {
    const f = currentFile;
    if (!f || f !== file || !isContent()) return;
    const list = await api("image-list?file=" + encodeURIComponent(f));
    if (f !== currentFile) return;
    candidates = list;
    if (!list.length) {
      selected = null;
      $("image-preview").removeAttribute("src");
      $("image-alt").value = "";
      controls();
    }
    $("image-selection").hidden = stage !== "choose" || !list.length;
    $("image-candidates").replaceChildren(
      ...list.map((r, i) => {
        const b = document.createElement("button");
        b.textContent = "Candidate " + (list.length - i);
        b.dataset.id = r.id;
        b.onclick = () => select(r.id).catch((e) => note(e.message));
        api("image-data?id=" + encodeURIComponent(r.id))
          .then((data) => {
            if (!b.isConnected) return;
            const img = document.createElement("img");
            img.src = data.image;
            img.alt = "";
            b.prepend(img);
          })
          .catch(() => {});
        return b;
      }),
    );
    if (list.length)
      await select(
        list.some((r) => r.id === selected?.id) ? selected.id : list[0].id,
        false,
      );
  }
  let cleanupVersion = -1;
  document.addEventListener("author-image-cleanup", (event) => {
    const version = event.detail?.version ?? event.detail;
    $("image-cleanup-status").textContent = event.detail?.error
      ? "Automatic image cleanup is paused: " + event.detail.error
      : "Unused alternatives expire after seven days. Recovery trash is kept for 30 days.";
    if (
      version === undefined ||
      typeof version !== "number" ||
      version === cleanupVersion ||
      busy
    )
      return;
    cleanupVersion = version;
    if (isContent()) refresh().catch((e) => note(e.message));
  });
  async function sync() {
    if (currentFile === file) return;
    currentFile = file;
    selected = null;
    candidates = [];
    $("image-selection").hidden = true;
    $("image-brief").value = localStorage.getItem(key()) || "";
    $("image-direction").value = "";
    $("image-alt").value = "";
    $("image-caption").value = "";
    $("image-size").value = isCollection() ? "1024x1536" : "1536x1024";
    note(
      isContent()
        ? "Your candidates will appear here. Nothing is inserted automatically."
        : "Choose an article, book or collection to create an illustration.",
    );
    controls();
    await refresh();
  }
  $("show-images").onclick = async () => {
    $("review-panel").hidden = true;
    document.querySelector("iframe").hidden = true;
    $("width").hidden = true;
    $("preview-mode").hidden = true;
    $("preview-heading").hidden = true;
    $("preview-status").hidden = true;
    $("show-preview").setAttribute("aria-pressed", "false");
    $("show-review").setAttribute("aria-pressed", "false");
    $("show-images").setAttribute("aria-pressed", "true");
    $("images-panel").hidden = false;
    try {
      await sync();
      if (!config) await setup();
      if (selected) await api("image-touch", { id: selected.id });
      step(candidates.length ? "choose" : "brief");
    } catch (e) {
      note(e.message);
    }
  };
  const remember = () => {
    localStorage.setItem(key(), $("image-brief").value);
    controls();
  };
  $("image-brief").addEventListener("input", remember);
  $("image-alt").addEventListener("input", () => {
    if (selected) altDrafts.set(selected.id, $("image-alt").value);
    controls();
  });
  $("image-agent").onchange = controls;
  async function start(kind) {
    try {
      await flushMetadata();
    } catch (e) {
      note(e.message);
      return;
    }
    const f = file,
      text = editor.value,
      original = $("image-brief").value;
    busy = true;
    controls();
    note(
      kind === "brief"
        ? "Drafting a brief…"
        : "Generating an image… This can take a few minutes.",
    );
    try {
      active = await api("image-start", {
        file: f,
        text: kind === "brief" ? text : "",
        kind,
        agent: $("image-agent").value || "codex",
        brief: original,
        direction: $("image-direction").value,
        size: $("image-size").value,
        quality: $("image-quality").value,
      });
      controls();
      while (active.state === "running") {
        await new Promise((r) => setTimeout(r, 1000));
        active = await api("image-job?id=" + active.id);
      }
      if (active.state !== "complete")
        throw Error(active.error || "Image task cancelled.");
      if (kind === "brief") {
        if (
          currentFile === f &&
          editor.value === text &&
          $("image-brief").value === original
        ) {
          $("image-brief").value = active.brief;
          remember();
          note("Your brief is ready. Edit it before generating an image.");
        } else {
          localStorage.setItem(
            "author-image-suggestion:" + location.origin + ":" + f,
            active.brief,
          );
          note(
            "Brief finished. Your newer edits were preserved; the suggestion is available below.",
          );
          const b = document.createElement("button");
          const suggestion = active.brief;
          b.textContent = "Load suggested brief";
          b.onclick = () => {
            if (file !== f || editor.value !== text) {
              note("Return to the article used for this brief.");
              return;
            }
            $("image-brief").value = suggestion;
            remember();
            b.remove();
          };
          $("image-notice").append(document.createElement("br"), b);
        }
      } else {
        if (currentFile === f) {
          selected = null;
          await refresh();
          step("choose");
        }
        note(
          "Candidate saved. Review the image and its suggested description before inserting.",
        );
      }
    } catch (e) {
      note(e.message);
    } finally {
      busy = false;
      controls();
    }
  }
  $("suggest-brief").onclick = () => start("brief");
  $("generate-image").onclick = () => start("generate");
  $("cancel-image").onclick = () =>
    api("image-cancel", { id: active.id }).catch((e) => note(e.message));
  $("reuse-brief").onclick = () => {
    step("brief");
    if (selected) {
      $("image-brief").value = selected.brief;
      remember();
      $("image-brief").focus();
      note(
        "Edit the brief, then generate a new candidate. Existing candidates are kept.",
      );
    }
  };
  $("image-upload").onchange = async (e) => {
    const upload = e.target.files[0];
    if (!upload) return;
    const f = file;
    busy = true;
    controls();
    try {
      if (upload.size > 20_000_000)
        throw Error("Choose an image smaller than 20 MB.");
      const encoded = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = () => reject(Error("Cannot read image"));
        reader.readAsDataURL(upload);
      });
      await api("image-import", { file: f, image: encoded });
      if (file === f) {
        selected = null;
        await refresh();
        step("choose");
      }
      note("Image imported locally. Add its description before inserting.");
    } catch (e) {
      note(e.message);
    } finally {
      busy = false;
      e.target.value = "";
      controls();
    }
  };
  async function applyImage(remove = false) {
    try {
      await flushMetadata();
    } catch (e) {
      note(e.message);
      return;
    }
    const f = file,
      text = editor.value,
      id = remove ? null : selected?.id;
    const cover = isCollection();
    const header = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(text);
    const at =
      $("image-position").value === "beginning"
        ? (header?.[0].length ?? 0)
        : text.length;
    busy = true;
    controls();
    try {
      const result = await api(cover ? "image-cover" : "image-insert", {
        file: f,
        id,
        alt: $("image-alt").value,
        caption: $("image-caption").value,
        ...(cover ? { text } : {}),
      });
      if (file !== f || editor.value !== text) {
        note(
          "The content changed. Your newer edits were preserved; apply the image again.",
        );
        return;
      }
      editor.value = cover
        ? result.text
        : text.slice(0, at) +
          "\n\n" +
          result.markdown +
          "\n\n" +
          text.slice(at);
      changed();
      editor.dispatchEvent(new Event("input"));
      note(
        cover
          ? remove
            ? "Cover removed from the unsaved collection. Save when ready."
            : "Cover assigned. Save to refresh the site; Undo is available."
          : "Image inserted at the chosen position. Preview it, then Save.",
      );
    } catch (e) {
      note(e.message);
    } finally {
      busy = false;
      controls();
    }
  }
  $("insert-image").onclick = () => applyImage();
  $("remove-cover").onclick = () => applyImage(true);
  setInterval(() => {
    if (!$("images-panel").hidden) sync().catch((e) => note(e.message));
  }, 500);
})();
