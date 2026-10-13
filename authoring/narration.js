/* Local speech preparation. Provider output is always rendered as text. */
(() => {
  const panel = document.createElement("section");
  panel.id = "narration-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Article narration");
  panel.innerHTML = `
    <h2>Give the article a voice</h2>
    <p>Local Kokoro narration. Decorative illustrations stay silent.</p>
    <div class="narration-toolbar">
      <label>Voice <select id="narration-voice"></select></label>
      <button type="button" id="narration-refresh">Refresh status</button>
      <button type="button" id="narration-test">Test first paragraph</button>
      <button type="button" id="narration-prepare">Prepare narration</button>
      <button type="button" id="narration-cancel" hidden>Cancel job</button>
    </div>
    <p id="narration-status" role="status">Choose an article and refresh.</p>
    <progress id="narration-progress" hidden></progress>
    <p id="narration-recording" hidden></p><audio id="narration-audio" controls preload="none" hidden aria-label="Narration preview"></audio>
    <details><summary>Speaking pace and pronunciations</summary>
      <label>Production pace <input id="narration-pace" type="number" min="0.8" max="1.2" step="0.05" value="1"></label>
      <label>Pronunciations (one word = spoken form per line)<textarea id="narration-pronunciations" rows="4"></textarea></label>
    </details>
    <div class="narration-toolbar"><button type="button" id="narration-save">Save voice and reviewed choices</button><button type="button" id="narration-publish">Publish locally when audio is ready</button></div>
    <p><small>Save the article before accepting explanations. Unsaved text and voice choices can be auditioned privately. Publishing neither commits nor deploys.</small></p>
    <details open><summary>Spoken content and explanations</summary><div id="narration-blocks"></div></details>
    <details><summary>Draft explanations with an agent</summary>
      <p>The selected CLI may send the displayed source to its configured service. No image bytes are sent; uncertain visual descriptions need your review.</p>
      <label>Provider <select id="narration-agent"></select></label>
      <label>Model (optional) <input id="narration-model" maxlength="120"></label>
      <button type="button" id="narration-prompt">Show outgoing prompt</button>
      <pre id="narration-prompt-text"></pre>
      <button type="button" id="narration-propose">Draft spoken explanations</button>
      <button type="button" id="narration-accept">Accept selected proposals</button>
    </details>
    <details><summary>Narration transcript</summary><div id="narration-transcript"></div></details>`;
  $("images-panel").before(panel);
  const status = $("narration-status"),
    audio = $("narration-audio");
  let snapshot,
    settings,
    settingsRevision,
    active,
    sourceFile,
    objectUrl,
    proposals = [];
  const recoveryKey = () => "author-narration:" + file;
  function request() {
    if (file !== sourceFile || !settings)
      throw Error("Refresh narration for this article first");
    const pronunciations = {};
    for (const line of $("narration-pronunciations")
      .value.split("\n")
      .filter((x) => x.trim())) {
      const at = line.indexOf("=");
      if (at < 1 || !line.slice(at + 1).trim())
        throw Error("Use word = spoken form for each pronunciation");
      pronunciations[line.slice(0, at).trim()] = line.slice(at + 1).trim();
    }
    settings = {
      ...settings,
      voice: $("narration-voice").value,
      pace: Number($("narration-pace").value),
      pronunciations,
    };
    try {
      localStorage.setItem(
        recoveryKey(),
        JSON.stringify({ text: editor.value, settings }),
      );
    } catch {
      /* Recovery may be unavailable. */
    }
    return {
      file,
      text: editor.value,
      revision: base,
      settings,
      context: $("context").value,
    };
  }
  async function safely(action) {
    try {
      await action();
    } catch (e) {
      status.textContent = e.message;
    }
  }
  function paragraph(text) {
    const p = document.createElement("p");
    p.textContent = text;
    return p;
  }
  function populate(result) {
    snapshot = result;
    settings = result.doc.settings;
    settingsRevision = result.settingsRevision;
    $("narration-voice").replaceChildren(
      ...Object.entries(result.voices).map(
        ([id, label]) => new Option(label + " · British English", id),
      ),
    );
    $("narration-voice").value = settings.voice;
    $("narration-pace").value = settings.pace;
    $("narration-pronunciations").value = Object.entries(
      settings.pronunciations,
    )
      .map(([word, spoken]) => `${word} = ${spoken}`)
      .join("\n");
    $("narration-agent").replaceChildren(
      ...result.agents.map((agent) => {
        const option = new Option(
          agent.label + (agent.installed ? "" : " (not installed)"),
          agent.id,
        );
        option.disabled = !agent.installed;
        return option;
      }),
    );
    status.textContent = `${result.previewOnly ? "Preview only — unsaved or draft content. " : ""}${result.status}. ${result.reason}`;
    $("narration-test").disabled = !result.doc.firstParagraph;
    $("narration-prepare").textContent =
      result.status === "Up to date"
        ? "Play current narration"
        : "Prepare narration";
    $("narration-transcript").replaceChildren(
      ...result.doc.segments.map((s) => paragraph(s.text)),
    );
    blocks();
  }
  async function refresh() {
    const selected = file,
      text = editor.value;
    let recovered;
    try {
      recovered = JSON.parse(localStorage.getItem(recoveryKey()) ?? "null");
    } catch {
      /* Ignore broken browser recovery. */
    }
    const result = await api("narration-inspect", {
      file,
      text,
      revision: base,
      context: $("context").value,
      ...(recovered?.text === text ? { settings: recovered.settings } : {}),
    });
    if (file !== selected || editor.value !== text) return;
    sourceFile = file;
    proposals = [];
    populate(result);
  }
  function blocks() {
    const container = $("narration-blocks");
    container.replaceChildren();
    if (!snapshot.doc.issues.length)
      container.append(
        paragraph(
          "Prose is ready to speak. No special explanations are needed.",
        ),
      );
    for (const issue of snapshot.doc.issues) container.append(block(issue));
  }
  function block(issue) {
    const section = document.createElement("section");
    section.className = "narration-block";
    const heading = document.createElement("h3");
    heading.textContent = `${issue.kind} · ${issue.resolved ? "Reviewed" : "Needs explanation"}`;
    const source = document.createElement("pre");
    source.textContent = issue.source;
    const select = document.createElement("select");
    select.setAttribute("aria-label", `Treatment for ${issue.id}`);
    const options =
      issue.kind === "image"
        ? [
            ["decorative", "Decorative — silent"],
            ["skip", "Skip — explained in prose"],
            ["caption", "Read caption"],
            ["explanation", "Spoken explanation"],
          ]
        : [
            ["explanation", "Spoken explanation"],
            ["literal", "Reviewed literal reading"],
            ["skip", "Skip with reason"],
          ];
    select.replaceChildren(
      new Option("Choose treatment", ""),
      ...options.map(([value, label]) => new Option(label, value)),
    );
    const existing = settings.adaptations[issue.id];
    select.value = existing?.treatment ?? "";
    const text = document.createElement("textarea");
    text.rows = 4;
    text.setAttribute("aria-label", `Spoken explanation for ${issue.id}`);
    text.value = existing?.text ?? "";
    const reason = document.createElement("input");
    reason.setAttribute(
      "aria-label",
      `Review or omission reason for ${issue.id}`,
    );
    reason.placeholder = "Reason, especially when skipping";
    reason.value = existing?.reason ?? "";
    const proposal = proposals.find((p) => p.id === issue.id);
    if (proposal) {
      const check = document.createElement("input");
      check.type = "checkbox";
      check.dataset.proposal = issue.id;
      const label = document.createElement("label");
      label.append(check, " Select this proposal after reviewing");
      section.append(
        label,
        paragraph(proposal.rationale),
        paragraph(proposal.uncertainty),
      );
      text.value = proposal.text;
      select.value = "explanation";
      check.onchange = () => {
        proposal.text = text.value;
      };
    }
    const accept = document.createElement("button");
    accept.type = "button";
    accept.textContent = "Accept this choice";
    accept.onclick = () =>
      safely(async () => {
        if (!select.value) throw Error("Choose a treatment first");
        settings.adaptations[issue.id] = {
          treatment: select.value,
          sourceHash: issue.sourceHash,
          text: text.value,
          reason: reason.value,
        };
        await saveSettings();
      });
    const audition = document.createElement("button");
    audition.type = "button";
    audition.textContent = "Audition explanation";
    audition.onclick = () =>
      safely(() =>
        launch("narration-start", {
          request: request(),
          audition: true,
          spokenText: select.value === "caption" ? issue.caption : text.value,
        }),
      );
    const reject = document.createElement("button");
    reject.type = "button";
    reject.textContent = "Reject proposal";
    reject.hidden = !proposal;
    reject.onclick = () => {
      proposals = proposals.filter((p) => p.id !== issue.id);
      blocks();
    };
    section.prepend(heading, source);
    section.append(select, text, reason, audition, accept, reject);
    return section;
  }
  async function saveSettings() {
    const selected = file;
    const result = await api("narration-settings", {
      request: request(),
      settingsRevision,
    });
    if (file !== selected) return;
    try {
      localStorage.removeItem(recoveryKey());
    } catch {
      /* Storage is optional. */
    }
    populate(result);
  }
  function busy(value) {
    for (const id of ["test", "prepare", "publish", "propose"])
      $("narration-" + id).disabled = value;
    $("narration-cancel").hidden = !value;
    $("narration-progress").hidden = !value;
  }
  async function launch(endpoint, payload) {
    if (active) throw Error("Wait for or cancel the active narration job");
    const captured = {
      file,
      text: editor.value,
      voice: $("narration-voice").value,
      playCurrent:
        snapshot.status === "Up to date" &&
        endpoint === "narration-start" &&
        !payload.audition,
    };
    busy(true);
    try {
      active = await api(endpoint, payload);
      while (["queued", "preparing"].includes(active.status)) {
        status.textContent = `${active.status === "queued" ? "Queued" : "Preparing"} · ${active.progress} of ${active.total} segments`;
        $("narration-progress").max = active.total;
        $("narration-progress").value = active.progress;
        await new Promise((resolve) => setTimeout(resolve, 750));
        active = await api("narration-job?id=" + encodeURIComponent(active.id));
      }
      if (active.status !== "ready")
        throw Error(active.error ?? "Narration cancelled");
      if (
        file !== captured.file ||
        editor.value !== captured.text ||
        $("narration-voice").value !== captured.voice
      ) {
        status.textContent =
          "Source or voice changed. Completed result is an older private preview; refresh before using it.";
        return;
      }
      if (active.proposals) {
        proposals = active.proposals;
        blocks();
        status.textContent =
          "Proposals ready. Compare each with its source, edit and explicitly accept.";
      }
      if (active.saved) {
        await openFile(captured.file);
        status.textContent =
          "Published locally with verified narration. Commit and deployment remain separate.";
      }
      if (active.result)
        await playJob(active, Boolean(payload.audition), captured.playCurrent);
    } finally {
      active = null;
      busy(false);
    }
  }
  async function playJob(job, audition, playCurrent) {
    const response = await fetch(
      "/_author/api/narration-audio?id=" + encodeURIComponent(job.id),
      { headers: { "X-Author-Token": token } },
    );
    if (!response.ok)
      throw Error("Unable to load the private narration preview");
    audio.pause();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(await response.blob());
    audio.src = objectUrl;
    audio.hidden = false;
    $("narration-recording").hidden = false;
    $("narration-recording").textContent =
      `${$("narration-voice").selectedOptions[0].textContent} · ${audition ? "audition" : "complete article"}`;
    status.textContent = audition
      ? "First paragraph or explanation audition · preview only"
      : job.previewOnly
        ? "Preview only — save matching source and settings before publication"
        : "Up to date · saved article narration is ready";
    if (audition || playCurrent) await audio.play();
  }
  function show() {
    window.authorPane("narration");
    panel.hidden = false;
    for (const id of [
      "images-panel",
      "review-panel",
      "width",
      "preview-mode",
      "preview-heading",
      "preview-status",
    ])
      $(id).hidden = true;
    document.querySelector("iframe").hidden = true;
    safely(refresh);
  }
  $("show-narration").onclick = show;
  for (const id of ["show-write", "show-preview", "show-review", "show-images"])
    $(id).addEventListener("click", () => {
      panel.hidden = true;
      audio.pause();
    });
  $("narration-refresh").onclick = () => safely(refresh);
  $("narration-test").onclick = () =>
    safely(() =>
      launch("narration-start", { request: request(), audition: true }),
    );
  $("narration-prepare").onclick = () =>
    safely(() =>
      launch("narration-start", { request: request(), audition: false }),
    );
  $("narration-publish").onclick = () =>
    safely(() => launch("narration-publish", request()));
  $("narration-save").onclick = () => safely(saveSettings);
  $("narration-propose").onclick = () =>
    safely(() =>
      launch("narration-propose", {
        request: request(),
        agent: $("narration-agent").value,
        model: $("narration-model").value,
      }),
    );
  $("narration-prompt").onclick = () =>
    safely(async () => {
      $("narration-prompt-text").textContent = (
        await api("narration-prompt", request())
      ).prompt;
    });
  $("narration-cancel").onclick = () =>
    safely(async () => {
      if (active) await api("narration-cancel", { id: active.id });
    });
  $("narration-accept").onclick = () =>
    safely(async () => {
      for (const checkbox of panel.querySelectorAll(
        "[data-proposal]:checked",
      )) {
        const proposal = proposals.find(
          (p) => p.id === checkbox.dataset.proposal,
        );
        proposal.text = checkbox
          .closest("section")
          .querySelector("textarea").value;
        settings.adaptations[proposal.id] = {
          treatment: "explanation",
          sourceHash: proposal.sourceHash,
          text: proposal.text,
          reason: "Reviewed in narration preview",
        };
      }
      await saveSettings();
    });
  for (const id of [
    "narration-voice",
    "narration-pace",
    "narration-pronunciations",
  ])
    $(id).addEventListener("input", () =>
      safely(async () => {
        request();
        markOlder();
        status.textContent =
          "Voice or pronunciation changed. Test or prepare explicitly; no generation has started.";
      }),
    );
  document.addEventListener(
    "play",
    (event) => {
      for (const media of document.querySelectorAll("audio,video"))
        if (media !== event.target) media.pause();
    },
    true,
  );
  editor.addEventListener("input", () => {
    markOlder();
    if (!panel.hidden)
      status.textContent =
        "Editor changed — preview needs refreshing. No generation has started.";
  });
  function markOlder() {
    if (snapshot) snapshot.status = "Out of date";
    $("narration-prepare").textContent = "Prepare narration";
    if (
      !audio.hidden &&
      !$("narration-recording").textContent.startsWith("Older preview")
    )
      $("narration-recording").textContent =
        "Older preview — " + $("narration-recording").textContent;
  }
})();
