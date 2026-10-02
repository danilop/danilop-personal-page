(() => {
  const panel = $("short-links-panel");
  let state,
    loadedFile,
    busy = false,
    manualCode = false;
  $("short-link-code").addEventListener("input", () => {
    manualCode = true;
  });
  const status = $("short-link-status");
  const controls = [
    "short-link-reserve",
    "short-link-refresh",
    "short-link-publish",
    "short-link-check",
  ];
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
  function payload() {
    if (!state || file !== loadedFile)
      throw Error("Refresh links for the current article first");
    if (editor.value !== saved)
      throw Error("Save your article edits before changing short links");
    return {
      file,
      revision: state.sourceRevision,
      registryRevision: state.registryRevision,
    };
  }
  function render(next, requestedFile = file) {
    if (file !== requestedFile) return;
    state = next;
    loadedFile = requestedFile;
    const input = $("short-link-code");
    if (!manualCode) input.value = state.suggestedCode ?? "";
    const list = $("short-link-list");
    list.replaceChildren();
    for (const link of state.links) {
      const row = document.createElement("p");
      const label = document.createElement("span");
      label.textContent =
        (state.shortOrigin ? state.shortOrigin + "/" : "") +
        link.code +
        (link.target ? " → " + link.target : " · reserved for a draft");
      row.append(label);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Disable alias locally";
      button.onclick = () =>
        run(async () => {
          render(
            await api("short-link-deactivate", {
              ...payload(),
              code: link.code,
            }),
          );
          status.textContent =
            "Alias disabled locally. Commit and deploy, then publish redirects to withdraw it from S3.";
        });
      row.append(button);
      list.append(row);
    }
    if (!state.links.length)
      list.textContent = "No short codes reserved for this content.";
  }
  async function refresh() {
    const requestedFile = file;
    const result = await api(
      "short-links?file=" + encodeURIComponent(requestedFile),
    );
    if (file !== requestedFile) return;
    render(result, requestedFile);
    status.textContent = state.configured
      ? "Saved reservations shown. Use Check live links to verify activation."
      : "Infrastructure is not configured: " + state.configurationError;
  }
  panel.addEventListener("toggle", () => {
    if (panel.open) void run(refresh);
  });
  $("short-link-refresh").onclick = () => run(refresh);
  $("short-link-reserve").onclick = () =>
    run(async () => {
      const request = payload();
      const next = await api("short-link-reserve", {
        ...request,
        code: $("short-link-code").value.trim(),
      });
      if (file !== request.file) return;
      $("short-link-code").value = "";
      manualCode = false;
      render(next, request.file);
      status.textContent =
        "Code reserved locally. Commit and deploy before activating it.";
    });
  $("short-link-publish").onclick = () =>
    run(async () => {
      status.textContent =
        "Checking deployment and publishing saved redirects…";
      const result = await api("short-link-publish", payload());
      status.textContent = `Published ${result.changes.length} changes and ${result.removed.length} removals. Check live links after cache invalidation.`;
    });
  $("short-link-check").onclick = () =>
    run(async () => {
      const result = await api("short-link-check", { file });
      status.textContent =
        result.results
          .map(
            (link) =>
              link.code +
              ": " +
              (link.ready
                ? "live and verified"
                : "not ready (HTTP " + link.status + ")"),
          )
          .join("; ") || "No links to check.";
    });
  $("files").addEventListener("change", () => {
    state = null;
    loadedFile = null;
    manualCode = false;
    $("short-link-code").value = "";
    $("short-link-list").replaceChildren();
    status.textContent = "Refresh links for this content.";
  });
})();
