/* Private book narration. All generated prose is inserted as text, never HTML. */
(() => {
  const panel = document.createElement("section");
  panel.id = "audiobook-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Audiobook preparation");
  panel.innerHTML = `<h2>Give the book a voice</h2><p>Build one coherent audiobook from the book's reading order. Draft previews stay private.</p>
  <div class="narration-toolbar"><label>Scope <select id="book-scope"><option value="preview">All draft content (private preview)</option><option value="public">Published content only</option></select></label><label>Voice <select id="book-voice"></select></label><label>Pace <input id="book-pace" type="number" min="0.8" max="1.2" step="0.05" value="1"></label></div>
  <div class="narration-toolbar"><button type="button" id="book-refresh">Refresh status</button><button type="button" id="book-settings">Apply voice to editor</button><button type="button" id="book-audition">Test first paragraph</button><button type="button" id="book-prepare">Prepare audiobook</button><button type="button" id="book-publish">Publish locally when audio is ready</button><button type="button" id="book-cancel" hidden>Cancel</button></div>
  <p id="book-status" role="status">Refresh the book to see its narration plan.</p><progress id="book-progress" hidden></progress>
  <audio id="book-audio" data-voice-preview controls preload="none" hidden aria-label="Private audiobook preview"></audio><a id="book-download" hidden download="audiobook-preview.mp3">Download preview MP3</a>
  <details open><summary>Reading order and transitions</summary><ol id="book-outline"></ol></details>
  <details open><summary>Spoken explanations requiring review</summary><div id="book-issues"></div><p>Open the named article's Narration panel to draft explanations with Claude, Codex or Pi, audition and accept them. Then refresh this book.</p></details>`;
  $("narration-panel").after(panel);
  let active, snapshot, url;
  const request = () => ({
    file,
    text: editor.value,
    revision: base,
    preview: $("book-scope").value === "preview",
  });
  async function safely(action) {
    try {
      await action();
    } catch (e) {
      $("book-status").textContent = e.message;
    }
  }
  async function refresh() {
    const captured = file,
      result = await api("audiobook-inspect", request());
    if (file !== captured) return;
    snapshot = result;
    $("book-status").textContent =
      `${result.status} · ${result.changed} new or changed passages · ${result.plan.preview ? "Private draft" : "Published scope"}`;
    $("book-voice").replaceChildren(
      ...Object.entries(result.voices).map(
        ([id, label]) => new Option(label, id),
      ),
    );
    $("book-voice").value = result.plan.doc.settings.voice;
    $("book-pace").value = result.plan.doc.settings.pace;
    $("book-outline").replaceChildren(
      ...result.plan.segments
        .filter((s) => s.navigation)
        .map((s) => {
          const li = document.createElement("li");
          li.textContent = s.text;
          return li;
        }),
    );
    $("book-issues").replaceChildren(
      ...result.plan.doc.issues
        .filter((i) => !i.resolved)
        .map((i) => {
          const p = document.createElement("p");
          p.textContent = `${i.id}: ${i.kind} needs review`;
          return p;
        }),
    );
  }
  async function applySettings() {
    const result = await api("audiobook-settings", {
      request: request(),
      voice: $("book-voice").value,
      pace: $("book-pace").value,
    });
    editor.value = result.text;
    editor.dispatchEvent(new Event("input"));
  }
  function busy(value) {
    for (const id of ["refresh", "settings", "audition", "prepare", "publish"])
      $("book-" + id).disabled = value;
    $("book-cancel").hidden = !value;
    $("book-progress").hidden = !value;
  }
  async function launch(mode) {
    if (active) throw Error("Wait for the active audiobook job");
    if (!snapshot) await refresh();
    await applySettings();
    const captured = file,
      capturedText = editor.value;
    busy(true);
    try {
      active = await api("audiobook-start", { request: request(), mode });
      while (active.status === "preparing") {
        $("book-status").textContent =
          `Preparing audio: ${active.progress} of ${active.total} passages`;
        $("book-progress").max = active.total;
        $("book-progress").value = active.progress;
        await new Promise((r) => setTimeout(r, 700));
        active = await api("audiobook-job?id=" + encodeURIComponent(active.id));
      }
      if (active.status !== "ready")
        throw Error(active.error ?? "Audiobook cancelled");
      if (file !== captured) return;
      if (active.saved) {
        if (editor.value !== capturedText)
          throw Error(
            "The captured version was published locally. Your newer unsaved edits are preserved; reload the saved version before applying them.",
          );
        await openFile(captured);
      }
      if (url) URL.revokeObjectURL(url);
      const response = await fetch(
        "/_author/api/audiobook-audio?id=" + encodeURIComponent(active.id),
        { headers: { "X-Author-Token": token } },
      );
      if (!response.ok) throw Error("Could not load private audiobook preview");
      url = URL.createObjectURL(await response.blob());
      $("book-audio").src = url;
      $("book-audio").hidden = false;
      $("book-download").href = url;
      $("book-download").hidden = false;
      $("book-status").textContent = active.saved
        ? "Published locally with verified audiobook. Commit and deployment remain separate."
        : mode === "audition"
          ? "First-paragraph audition ready."
          : "Audiobook prepared. Listen to the transitions and full recording before release.";
    } finally {
      active = undefined;
      busy(false);
    }
  }
  window.showAudiobook = () => {
    window.authorPane("narration");
    $("context").closest("label").hidden = true;
    panel.hidden = false;
    for (const id of [
      "narration-panel",
      "images-panel",
      "review-panel",
      "width",
      "preview-mode",
      "preview-heading",
      "preview-status",
    ])
      $(id).hidden = true;
    document.querySelector("iframe").hidden = true;
    void safely(refresh);
  };
  for (const id of ["write", "preview", "review", "images"])
    $("show-" + id).addEventListener("click", () => {
      $("context").closest("label").hidden = false;
      panel.hidden = true;
      $("book-audio").pause();
    });
  $("book-refresh").onclick = () => safely(refresh);
  $("book-settings").onclick = () => safely(applySettings);
  $("book-audition").onclick = () => safely(() => launch("audition"));
  $("book-prepare").onclick = () => safely(() => launch("prepare"));
  $("book-publish").onclick = () => safely(() => launch("publish"));
  $("book-cancel").onclick = () =>
    safely(() => api("audiobook-cancel", { id: active.id }));
})();
