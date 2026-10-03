(() => {
  const panel = $("exports-panel"),
    status = $("export-status");
  let settings,
    selectedFile,
    result,
    snapshot,
    busy = false;
  const objectUrls = new Set();
  const controls = ["export-refresh", "export-generate", "export-enroll"];
  function invalidate() {
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls.clear();
    result = null;
    $("export-download").disabled = true;
    $("export-copy").disabled = true;
    $("export-markdown").value = "";
    $("export-assets").replaceChildren();
    $("export-review").replaceChildren();
  }
  function current() {
    return (
      snapshot &&
      file === snapshot.file &&
      editor.value === snapshot.text &&
      base === snapshot.revision &&
      $("export-destination").value === snapshot.destination &&
      $("export-tags").value === snapshot.tags
    );
  }
  async function run(action) {
    if (busy) return;
    busy = true;
    controls.forEach((id) => {
      $(id).disabled = true;
    });
    try {
      await action();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      busy = false;
      controls.forEach((id) => {
        $(id).disabled = false;
      });
    }
  }
  function tagsForDestination() {
    const destination = settings.destinations.find(
      (d) => d.id === $("export-destination").value,
    );
    $("export-tags").value = (
      destination?.assignment?.overrides?.tags ?? settings.tags
    ).join(", ");
    $("export-enrollment").textContent = destination?.assignment
      ? `Saved settings: ${destination.assignment.mode} article; ${destination.assignment.creation} creation; ${destination.assignment.updates} updates.`
      : "No saved export settings for this destination.";
    invalidate();
  }
  async function refresh() {
    const requestedFile = file;
    invalidate();
    settings = await api(
      "export-settings?file=" + encodeURIComponent(requestedFile),
    );
    if (file !== requestedFile) return;
    selectedFile = requestedFile;
    $("export-destination").replaceChildren(
      ...settings.destinations.map((d) => new Option(d.label, d.id)),
    );
    tagsForDestination();
    status.textContent =
      "Export includes the current editor text. Save export settings separately to include its media in a future release.";
  }
  function request() {
    if (!settings || selectedFile !== file)
      throw Error("Refresh exports for this article first.");
    return {
      file,
      revision: base,
      text: editor.value,
      destination: $("export-destination").value,
      tags: $("export-tags")
        .value.split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
  }
  async function fetchDownload(name, id) {
    const response = await fetch(
      "/_author/api/export-download?" + new URLSearchParams({ id, name }),
      { headers: { "X-Author-Token": token } },
    );
    if (!response.ok) throw Error((await response.json()).error);
    return response.blob();
  }
  function render(next) {
    result = next;
    $("export-markdown").value = next.markdown;
    $("export-download").disabled = false;
    $("export-copy").disabled = false;
    const list = $("export-assets");
    list.replaceChildren();
    for (const asset of next.assets) {
      const row = document.createElement("li"),
        link = document.createElement("a");
      link.href = asset.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = asset.name;
      const label = document.createElement("span");
      label.textContent = ` · ${Math.ceil(asset.bytes / 1024)} KB · ${next.unprepared.includes(asset.name) ? "needs asset preparation/release" : "manifest-pinned; verify live before delivery"}`;
      const preview = document.createElement("button");
      preview.type = "button";
      preview.textContent = "Download asset";
      preview.onclick = () =>
        run(async () => {
          if (!result || !current()) {
            invalidate();
            throw Error("Article changed. Generate the export again.");
          }
          const blob = await fetchDownload("assets/" + asset.name, next.id),
            url = URL.createObjectURL(blob);
          objectUrls.add(url);
          const download = document.createElement("a");
          download.href = url;
          download.download = asset.name;
          download.click();
        });
      row.append(link, label, preview);
      list.append(row);
    }
    if (!next.assets.length) list.textContent = "No local assets referenced.";
    const review = $("export-review");
    review.replaceChildren(
      ...next.review.map((item) => {
        const row = document.createElement("li");
        row.textContent = `${item.action}${item.block ? ` (${item.block})` : ""}: ${item.detail}${item.url ? " " + item.url : ""}`;
        return row;
      }),
    );
    status.textContent = `Local bundle ready${next.unsaved ? " from unsaved edits" : ""}${next.draft ? "; source is a draft and its canonical page is not yet public" : ""}. Canonical: ${next.canonical}. ${next.enrolled ? "Saved settings include this copy in build preparation." : "Save export settings to prepare its CDN assets with the site."} ${next.unprepared.length ? "Generated media needs assets:prepare, a commit and release before online use." : "This export has not checked live CDN availability."} Remote images and live embeds remain external references. No post was sent.`;
  }
  $("export-generate").onclick = () =>
    run(async () => {
      await flushMetadata();
      invalidate();
      const payload = request();
      snapshot = { ...payload, tags: $("export-tags").value };
      status.textContent = "Preparing Markdown, media and bundle…";
      const next = await api("export-generate", payload);
      if (!current()) {
        invalidate();
        status.textContent =
          "Article or settings changed during export. Generate it again.";
        return;
      }
      render(next);
    });
  $("export-enroll").onclick = () =>
    run(async () => {
      await flushMetadata();
      const payload = request();
      const next = await api("export-enroll", {
        ...payload,
        registryRevision: settings.registryRevision,
      });
      if (file !== payload.file) return;
      settings = next;
      invalidate();
      tagsForDestination();
      status.textContent =
        "Export settings saved locally. Run npm run assets:prepare, commit, then npm run release to host generated media. External delivery still requires a separate reviewed command.";
    });
  $("export-download").onclick = () =>
    run(async () => {
      if (!result || !current()) {
        invalidate();
        throw Error("Article changed. Generate the export again.");
      }
      const blob = await fetchDownload("bundle.zip", result.id),
        url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${file.split("/")[2]}-${snapshot.destination}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  $("export-copy").onclick = () =>
    run(async () => {
      if (!result || !current()) {
        invalidate();
        throw Error("Article changed. Generate the export again.");
      }
      await navigator.clipboard.writeText(result.markdown);
      status.textContent =
        "Online Markdown copied. Release and verify its media URLs before pasting into the destination editor.";
    });
  $("export-refresh").onclick = () => run(refresh);
  $("export-destination").onchange = tagsForDestination;
  $("export-tags").oninput = invalidate;
  panel.addEventListener("toggle", () => {
    if (panel.open) void run(refresh);
  });
  for (const event of ["input", "author-history", "author-reload"])
    editor.addEventListener(event, invalidate);
  document.addEventListener("author-export-context", () => {
    if (result && !current()) {
      invalidate();
      status.textContent = "Article changed. Generate the export again.";
    }
  });
  $("files").addEventListener("change", () => {
    settings = null;
    selectedFile = null;
    invalidate();
    status.textContent = "Refresh exports for this article.";
  });
})();
