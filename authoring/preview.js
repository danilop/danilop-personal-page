/* Served only by the local author server. The selected view is shared by its tabs. */
(() => {
  const state = document.currentScript.dataset;
  const select = document.getElementById("preview-content");
  const status = document.getElementById("preview-mode-status");
  const original = state.drafts === "true" ? "drafts" : "published";
  let switching = false;
  if (select)
    select.onchange = async () => {
      switching = true;
      select.disabled = true;
      status.textContent = "Updating preview…";
      try {
        const response = await fetch("/_author/api/preview-mode", {
          method: "POST",
          headers: {
            "X-Author-Token": state.token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ includeDrafts: select.value === "drafts" }),
        });
        const result = await response.json();
        if (!response.ok)
          throw Error(result.error || "Unable to change preview.");
      } catch (error) {
        switching = false;
        select.value = original;
        select.disabled = false;
        status.textContent = error.message;
      }
    };
  function updateStatus(buildState) {
    if (buildState === "error") {
      switching = false;
      if (select) {
        select.disabled = false;
        select.value = original;
      }
      if (status)
        status.textContent =
          "Preview rebuild failed. The last successful view is still shown.";
    } else if (select && !switching) {
      select.disabled = buildState !== "ready";
      if (select.disabled) status.textContent = "Updating preview…";
      else if (status.textContent === "Updating preview…")
        status.textContent = "";
    }
  }
  setInterval(async () => {
    try {
      const response = await fetch("/_author/api/files", {
        headers: { "X-Author-Token": state.token },
      });
      if (response.status === 403) {
        location.reload();
        return;
      }
      if (!response.ok) return;
      const result = await response.json();
      if (result.build.version !== Number(state.version)) {
        // A draft page may no longer exist in the new view.
        if (String(result.includeDrafts) !== state.drafts) location.assign("/");
        else location.reload();
        return;
      }
      updateStatus(result.build.state);
    } catch {
      /* Keep the current page while the local server is unavailable. */
    }
  }, 2000);
})();
