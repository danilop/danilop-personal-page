/* Local-only illustration workflow. Provider text is never interpreted as HTML. */
(() => {
  let config = null,
    currentFile = "",
    candidates = [],
    selected = null,
    active = null,
    busy = false;
  let stage = "brief",
    insertion = null;
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
  editor.addEventListener("blur", () => {
    insertion = { file, text: editor.value, start: editor.selectionStart };
  });
  const note = (s) => {
    $("image-notice").textContent = s;
  };
  const key = () => "author-image-brief:" + location.origin + ":" + currentFile;
  function controls() {
    const piece = file.endsWith("/index.md");
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
  async function select(id) {
    const f = currentFile,
      r = candidates.find((c) => c.id === id);
    if (!r) return;
    selected = r;
    controls();
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
    if (!f.endsWith("/index.md")) return;
    const list = await api("image-list?file=" + encodeURIComponent(f));
    if (f !== currentFile) return;
    candidates = list;
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
      );
  }
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
    note(
      file.endsWith("/index.md")
        ? "Your candidates will appear here. Nothing is inserted automatically."
        : "Choose an article to create an illustration.",
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
      step(candidates.length ? "choose" : "brief");
      const header = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n)?/.exec(editor.value);
      if (
        !insertion ||
        insertion.file !== file ||
        insertion.text !== editor.value ||
        insertion.start < (header?.[0].length || 0)
      )
        $("image-position").value = "end";
    } catch (e) {
      note(e.message);
    }
  };
  const remember = () => {
    localStorage.setItem(key(), $("image-brief").value);
    controls();
  };
  $("image-brief").addEventListener("input", remember);
  $("image-alt").addEventListener("input", controls);
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
          "Candidate saved. Review it and add an image description before inserting.",
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
  $("insert-image").onclick = async () => {
    try {
      await flushMetadata();
    } catch (e) {
      note(e.message);
      return;
    }
    const f = file,
      text = editor.value,
      id = selected?.id;
    const at =
      $("image-position").value === "cursor"
        ? insertion
        : { file: f, text, start: text.length };
    if (!at || at.file !== f || at.text !== text)
      return note(
        "The insertion position changed. Place the cursor in the article again, or choose End of article.",
      );
    busy = true;
    controls();
    try {
      const result = await api("image-insert", {
        file: f,
        id,
        alt: $("image-alt").value,
        caption: $("image-caption").value,
      });
      if (file !== f || editor.value !== text) {
        note("Asset prepared. Return to its article to insert it.");
        return;
      }
      editor.value =
        text.slice(0, at.start) +
        "\n\n" +
        result.markdown +
        "\n\n" +
        text.slice(at.start);
      changed();
      editor.dispatchEvent(new Event("input"));
      note("Image inserted at the chosen position. Preview it, then Save.");
    } catch (e) {
      note(e.message);
    } finally {
      busy = false;
      controls();
    }
  };
  setInterval(() => {
    if (!$("images-panel").hidden) sync().catch((e) => note(e.message));
  }, 500);
})();
