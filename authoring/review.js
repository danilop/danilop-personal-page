/* Local editor review controls. Text from a CLI is always displayed as text. */
(() => {
  let active = null,
    request = null,
    reviewedText = "",
    stale = false,
    timer = null,
    refreshCount = 0;
  let installed = [],
    viewKind = "checks";
  const reviews = {},
    decisions = window.createReviewDecisions();
  let viewedFile = "";
  function preserve() {
    if (active)
      reviews[(request?.file || file) + ":" + active.kind] = {
        active,
        request,
        reviewedText,
        stale,
      };
  }
  function chooseView(kind) {
    if (active?.state === "running") return;
    preserve();
    viewKind = kind;
    const previous = reviews[file + ":" + kind];
    active = previous?.active || null;
    request = previous?.request || null;
    reviewedText = previous?.reviewedText || "";
    stale = previous?.stale || false;
    $("checks-view").setAttribute("aria-pressed", String(kind === "checks"));
    $("editorial-view").setAttribute("aria-pressed", String(kind === "ai"));
    $("run-checks").closest("section").hidden = kind !== "checks";
    $("run-editorial").closest("section").hidden = kind !== "ai";
    $("review-setup").open = !active;
    $("download-review").hidden = !active?.result;
    if (active) freshness();
    else
      notice(
        kind === "checks"
          ? "Run local checks to review this draft."
          : "Run an editorial review to get suggestions.",
      );
    results();
    controls();
  }
  $("review-kinds").append($("cancel-review"));
  $("checks-view").onclick = () => chooseView("checks");
  $("editorial-view").onclick = () => chooseView("ai");
  window.acceptFixChecks = (job, r) => {
    reviews[r.file + ":checks"] = {
      active: job,
      request: r,
      reviewedText: r.text,
      stale: false,
    };
    if (viewKind === "checks") {
      active = job;
      request = r;
      reviewedText = r.text;
      stale = false;
      results();
      freshness();
    }
  };

  const notice = (message) => {
    $("review-notice").textContent = message;
  };
  function show(review) {
    $("images-panel").hidden = true;
    $("show-images").setAttribute("aria-pressed", "false");
    $("review-panel").hidden = !review;
    $("width").hidden = review;
    $("preview-mode").hidden = review;
    $("preview-heading").hidden = review;
    $("preview-status").hidden = review;
    document.querySelector("iframe").hidden = review;
    $("show-review").setAttribute("aria-pressed", String(review));
    $("show-preview").setAttribute("aria-pressed", String(!review));
  }
  $("show-review").onclick = () => show(true);
  $("show-preview").onclick = () => show(false);
  function input(kind) {
    return {
      file,
      text: editor.value,
      context: $("context").value,
      scope: $("review-scope").value,
      kind,
      model: $("review-model").value.trim(),
      ...(kind === "ai" &&
      ["claude", "codex", "pi"].includes($("review-agent").value)
        ? { agent: $("review-agent").value }
        : {}),
    };
  }
  function controls() {
    const running = active?.state === "running",
      piece = file.endsWith("/index.md");
    $("run-checks").disabled = running || !piece;
    $("run-editorial").disabled =
      running ||
      !piece ||
      !installed.some((a) => a.id === $("review-agent").value && a.installed);
    $("cancel-review").hidden = !running;
    $("checks-view").disabled = running;
    $("editorial-view").disabled = running;
    $("review-agent").disabled = running;
    $("review-scope").disabled = running;
    $("review-scope").options[1].disabled = !$("context").value;
    if (!$("context").value) $("review-scope").value = "piece";
  }
  async function agents() {
    const previous = $("review-agent").value;
    installed = await api("review-agents");
    $("review-agent").replaceChildren(
      ...installed.map((a) => {
        const o = new Option(
          a.label + (a.installed ? "" : " — not installed"),
          a.id,
        );
        o.disabled = !a.installed;
        return o;
      }),
    );
    const available = installed.find((a) => a.installed);
    if (available)
      $("review-agent").value = installed.some(
        (a) => a.id === previous && a.installed,
      )
        ? previous
        : available.id;
    controls();
  }
  $("refresh-agents").onclick = () => agents().catch((e) => notice(e.message));
  $("review-agent").onchange = controls;
  function freshness() {
    if (!active) return;
    const prefix = stale
      ? "Text or scope has changed. Matching passages remain editable; rerun to refresh suggestions and coverage. "
      : "";
    const when = new Date(active.started).toLocaleTimeString();
    let state =
      active.state === "complete"
        ? "Review complete"
        : active.state === "running"
          ? "Review running…"
          : active.state === "cancelled"
            ? "Review cancelled"
            : "Review failed";
    notice(
      prefix +
        state +
        " · " +
        (active.kind === "checks"
          ? "Writing checks"
          : "Editorial review / " + active.agent) +
        (active.result
          ? " · " + (active.result.findings?.length ?? 0) + " findings"
          : "") +
        " · " +
        when +
        (active.error ? " · " + active.error : ""),
    );
    $("review-notice").classList.toggle(
      "review-warning",
      stale || active.state === "failed",
    );
  }
  function passageAvailable(
    finding,
    location,
    report = active,
    original = reviewedText,
  ) {
    if (finding.verified === false) return false;
    const target = report?.result?.files?.[location.piece] || file;
    if (target !== file) return true; // Check that piece when opening it.
    return !!window.relocateFinding(
      editor.value,
      location,
      request?.file === file ? original : undefined,
    );
  }
  async function go(
    piece,
    line,
    verified = true,
    location = {},
    report = active,
    original = reviewedText,
    sourceFile = request?.file,
  ) {
    if (verified === false)
      return notice("This quotation is unverified. Check the text manually.");
    const target = report?.result?.files?.[piece] || file;
    if (target !== file) {
      $("files").value = target;
      await openFile(target);
    }
    let previous = sourceFile === file ? original : undefined;
    if (previous === undefined && report?.sources?.[file]) {
      const hash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(editor.value),
          ),
        ),
        (x) => x.toString(16).padStart(2, "0"),
      ).join("");
      if (hash === report.sources[file]) previous = editor.value;
    }
    const range = window.relocateFinding(
      editor.value,
      { ...location, line },
      previous,
    );
    if (!range)
      return notice(
        "This passage changed or has more than one possible match. Other findings remain available; locate this one manually or rerun the review.",
      );
    window.revealFinding(range.start, range.end);
  }
  function node(tag, text, className) {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (className) n.className = className;
    return n;
  }
  function results() {
    const out = $("review-results");
    const opened = new Set(
      Array.from(out.querySelectorAll(".finding-group[open]")).map(
        (d) => d.dataset.rule,
      ),
    );
    out.replaceChildren();
    $("review-progress").textContent = "";
    if (!active?.result) return;
    const r = active.result;
    out.append(node("p", r.summary || ""));
    if (r.checks) {
      const details = document.createElement("details");
      details.append(node("summary", "Checks completed and coverage"));
      for (const c of r.checks)
        details.append(node("p", `${c.name}: ${c.status} — ${c.detail}`));
      out.append(details);
    }
    const filter = $("review-filter").value,
      all = r.findings || [];
    const selected = all.filter((f) => {
      if (filter === "all") return true;
      if (filter === "metadata") return /^(tag|metadata)/.test(f.rule);
      if (filter === "repetition") return /repeat|repetition/.test(f.rule);
      if (filter === "technical")
        return ["error", "unavailable"].includes(f.severity);
      return (
        !/repeat|repetition/.test(f.rule) &&
        !/^(tag|metadata)/.test(f.rule) &&
        !["error", "unavailable"].includes(f.severity)
      );
    });
    out.append(
      node(
        "p",
        `${selected.length} of ${all.length} findings. These are review suggestions, not an AI-authorship score.`,
      ),
    );
    if (!all.length && !r.raw)
      out.append(
        node(
          "p",
          "No findings were reported. Check coverage above; this is not a guarantee of correctness.",
        ),
      );
    const groups = new Map();
    const report = active,
      reportText = reviewedText,
      reportFile = request?.file;
    const status = (f) => decisions.get(report, f);
    const mark = (f, decision) => {
      decisions.set(report, f, decision);
      results();
    };
    for (const f of [...selected].sort(
      (a, b) =>
        Number(/^(tag|metadata)/.test(a.rule)) -
        Number(/^(tag|metadata)/.test(b.rule)),
    )) {
      if (status(f) !== "open") continue;
      if (!groups.has(f.rule)) {
        const group = document.createElement("details");
        group.className = "finding-group";
        group.dataset.rule = f.rule;
        group.open = opened.has(f.rule);
        group.append(
          node(
            "summary",
            `${f.rule.replaceAll("-", " ")} · ${selected.filter((x) => x.rule === f.rule && status(x) === "open").length}`,
          ),
        );
        out.append(group);
        groups.set(f.rule, group);
      }

      const card = findingCard(f);
      groups.get(f.rule).append(card);
    }
    renderReviewDetails();
    const cards = Array.from(out.querySelectorAll(".finding-group article"));
    if (cards.length) {
      let index = -1;
      const nav = node("div");
      nav.className = "review-controls";
      const position = node("small", "Choose a finding");
      for (const [label, delta] of [
        ["Previous finding", -1],
        ["Next finding", 1],
      ]) {
        const button = node("button", label);
        button.onclick = () => {
          index = (index + delta + cards.length) % cards.length;
          const card = cards[index];
          card.closest("details").open = true;
          card.scrollIntoView({ block: "center" });
          card.querySelector("button")?.focus({ preventScroll: true });
          position.textContent = `${index + 1} of ${cards.length}`;
        };
        nav.append(button);
      }
      nav.append(position);
      out.prepend(nav);
    }
    if (r.raw) {
      const pre = node("pre", r.raw);
      pre.id = "review-raw";
      out.append(pre);
    }
    $("download-review").hidden = false;

    function renderReviewDetails() {
      const counts = decisions.counts(report, all);
      $("review-progress").textContent =
        `${counts.open} open · ${counts.addressed} addressed · ${counts.kept} kept as written`;
      renderDecisions();
      if (r.repetitions?.length) {
        const d = document.createElement("details");
        d.append(
          node(
            "summary",
            `All repeated stem sequences (${r.repetitions.length})`,
          ),
        );
        for (const row of r.repetitions) {
          const div = node("div", undefined, "review-finding");
          div.append(
            node(
              "p",
              `${row.count} occurrences · ${row.n} stems · ${row.example}`,
            ),
          );
          for (const l of row.locations) {
            const b = node(
              "button",
              `${(l.text || l.excerpt || "Show passage").slice(0, 48)} · line ${l.line}`,
            );
            b.disabled = !passageAvailable({}, l);
            b.onclick = () =>
              go(
                l.piece,
                l.line,
                true,
                l,
                report,
                reportText,
                reportFile,
              ).catch((e) => notice(e.message));
            div.append(b);
          }
          const fix = node("button", "Suggest a fix");
          fix.disabled = stale;
          fix.onclick = () =>
            window.openFindingFix(
              {
                rule: "repeated-stem-sequence",
                message: row.example,
                locations: row.locations,
              },
              active.result.files,
              fix,
              active.sources,
            );
          div.append(fix);
          d.append(div);
        }
        out.append(d);
      }

      function renderDecisions() {
        for (const [decision, label] of [
          ["addressed", "Addressed"],
          ["kept", "Kept as written"],
        ]) {
          const handled = selected.filter((f) => status(f) === decision);
          if (!handled.length) continue;
          const details = node("details");
          details.className = "review-decisions";
          details.append(node("summary", `${label} (${handled.length})`));
          details.append(
            node(
              "small",
              decision === "addressed"
                ? "Marked by you for this review. Text may still be unsaved; checks have not certified this decision."
                : "Your decision to retain the original for this review.",
            ),
          );
          for (const f of handled) {
            const card = node("article", undefined, "review-finding");
            card.append(
              node("strong", f.rule.replaceAll("-", " ")),
              node("p", f.message),
            );
            if (f.excerpt) card.append(node("blockquote", f.excerpt));
            const reopen = node("button", "Reopen finding");
            reopen.onclick = () => mark(f, "open");
            card.append(reopen);
            details.append(card);
          }
          out.append(details);
        }
      }
    }

    function findingCard(f) {
      const card = node("article", undefined, "review-finding");
      card.append(
        node(
          "strong",
          (f.rule || f.category || "Review").replaceAll("-", " ") +
            " · " +
            (f.priority || f.severity || "review"),
        ),
      );
      card.append(node("p", f.message));
      if (f.excerpt) card.append(node("blockquote", f.excerpt));
      if (f.suggestion) card.append(node("p", "Suggestion: " + f.suggestion));
      if (f.question) card.append(node("p", "Question: " + f.question));
      if (f.accepted)
        card.append(node("p", "Previously accepted: " + f.accepted));
      if (f.locationNote)
        card.append(node("p", f.locationNote, "review-warning"));
      const locations = f.locations?.length ? f.locations : [f];
      for (const l of locations) {
        if (!l.line) continue;
        const b = node(
          "button",
          `${(l.text || l.excerpt || "Show passage").slice(0, 48)} · line ${l.line}`,
        );
        b.title = "Edit this passage in your own words";
        b.disabled = !passageAvailable(f, l);
        b.onclick = () =>
          go(
            l.piece,
            l.line,
            f.verified,
            l,
            report,
            reportText,
            reportFile,
          ).catch((e) => notice(e.message));
        card.append(b);
      }
      const fix = node("button", window.editorialAction(f));
      fix.disabled = stale;
      fix.onclick = () =>
        window.openFindingFix(f, report.result.files, fix, report.sources, {
          onAddress: () => mark(f, "addressed"),
          onEdit: () => {
            const location = locations.find((l) => l.line);
            if (location)
              return go(
                location.piece,
                location.line,
                f.verified,
                location,
                report,
                reportText,
                reportFile,
              );
          },
        });
      card.append(fix);
      const addressed = node("button", "Mark as addressed");
      addressed.title =
        "Record your decision for this review. This does not save the article or certify that checks pass.";
      addressed.onclick = () => mark(f, "addressed");
      card.append(addressed);
      const keep = node("button", "Keep as written");
      keep.onclick = () => {
        mark(f, "kept");
      };
      card.append(keep);
      return card;
    }
  }
  async function poll() {
    if (!active) return;
    try {
      active = await api("review-job?id=" + encodeURIComponent(active.id));
      freshness();
      controls();
      if (active.state !== "running") {
        preserve();
        $("review-setup").open = false;
        results();
        $("review-notice").scrollIntoView({ block: "nearest" });
        clearInterval(timer);
        timer = setInterval(checkFreshness, 5000);
      }
    } catch (e) {
      notice(e.message);
      clearInterval(timer);
    }
  }
  async function checkFreshness() {
    if (!active || !request || active.state === "running") return;
    try {
      const d = await api("review-fingerprint", {
        ...request,
        text: file === request.file ? editor.value : request.text,
      });
      if ((d.fingerprint !== active.fingerprint) !== stale) {
        stale = d.fingerprint !== active.fingerprint;
        freshness();
        results();
      }
    } catch {
      stale = true;
      freshness();
      results();
    }
  }
  async function start(kind) {
    try {
      await flushMetadata();
      chooseView(kind);
      controls();
      const r = input(kind);
      $("review-results").replaceChildren();
      $("download-review").hidden = true;
      notice("Preparing review…");
      request = r;
      reviewedText = r.text;
      stale = false;
      active = await api("review-start", r);
      show(true);
      freshness();
      controls();
      clearInterval(timer);
      timer = setInterval(poll, 1000);
    } catch (e) {
      notice(e.message);
      controls();
    }
  }
  $("run-checks").onclick = () => start("checks");
  $("run-editorial").onclick = () => start("ai");
  $("cancel-review").onclick = () =>
    api("review-cancel", { id: active.id })
      .then(() => notice("Cancelling review…"))
      .catch((e) => notice(e.message));
  $("view-review-prompt").onclick = async () => {
    try {
      notice("Preparing the exact prompt…");
      const r = await api("review-prompt", input("ai"));
      $("review-prompt").value = r.prompt;
      $("review-prompt").hidden = false;
      notice("Prompt shown below. Nothing has been sent to a model.");
    } catch (e) {
      notice(e.message);
    }
  };
  $("review-filter").onchange = results;
  $("download-review").onclick = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              ...active,
              authorDecisions: (active.result?.findings || [])
                .map((f) => ({
                  finding: f,
                  status: decisions.get(active, f),
                }))
                .filter((d) => d.status !== "open"),
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "writing-review-" + active.id + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  setInterval(async () => {
    if (viewedFile !== file && active?.state !== "running") {
      viewedFile = file;
      chooseView(viewKind);
    }
    controls();
    if (active) {
      const before = stale;
      if (!stale && active.sources?.[file]) {
        const digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(editor.value),
        );
        const hash = Array.from(new Uint8Array(digest), (x) =>
          x.toString(16).padStart(2, "0"),
        ).join("");
        if (hash !== active.sources[file]) stale = true;
      }
      freshness();
      if (before !== stale) results();
    }
    if (++refreshCount % 30 === 0 && !active) agents().catch(() => {});
  }, 1000);
  $("review-scope").addEventListener("change", () => {
    if (active) {
      stale = true;
      freshness();
      results();
    }
  });
  editor.addEventListener("input", () => {
    if (active?.sources?.[file]) {
      stale = true;
      freshness();
      results();
    }
  });
  chooseView("checks");
  agents().catch((e) => notice("Could not check installed CLIs: " + e.message));
})();
