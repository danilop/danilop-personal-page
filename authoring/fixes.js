/* Finding-specific assistance. Suggestions never save or run model-proposed actions. */
(() => {
  const defaults =
    "Address this finding only if a change improves the passage. Prefer the smallest edit that preserves meaning, factual claims, uncertainty, voice and language variant. Keep technical terms, citations, quotations, links and code intact. Avoid awkward synonyms, stock phrasing, rhetorical flourishes and unsupported claims. Explain briefly why the change helps. If the original is better, recommend keeping it.";
  const panel = document.createElement("section");
  panel.id = "fix-panel";
  panel.hidden = true;
  panel.innerHTML = `<button id="fix-back" class="quiet">← Back to findings</button><h2>Suggest a fix</h2><p id="fix-issue"></p><label>Passage<select id="fix-occurrence"></select></label><blockquote id="fix-quote"></blockquote><div class="review-controls"><div id="fix-agents" role="group" aria-label="Compare agents"><strong>Compare agents</strong></div><label>Approach<select id="fix-approach"><option>Minimal edit</option><option>Rephrase</option><option>Assess first</option></select></label></div><details><summary>Customize instructions</summary><label>Instructions<textarea id="fix-instructions"></textarea></label><button id="fix-reset">Reset to default</button><label><input id="fix-remember" type="checkbox"> Remember my instructions</label><label>Context<select id="fix-context"><option value="paragraphs">Surrounding paragraphs</option><option value="article">Whole article</option></select></label><label>Model (optional)<input id="fix-model" placeholder="Agent default"></label><button id="fix-exact">View exact request</button><pre id="fix-prompt" hidden></pre></details><p><small id="fix-disclosure"></small></p><button id="fix-run">Find a fix</button> <button id="fix-cancel" hidden>Cancel</button><p id="fix-notice" role="status" aria-live="polite"></p><section id="fix-result" hidden><h3>Proposed change</h3><label hidden>Compare proposals<select id="fix-attempt"></select></label><div id="fix-proposal-tabs" class="review-controls" role="group" aria-label="Agent proposals"></div><p id="fix-summary"></p><div id="fix-changes"></div><label>Direction for another attempt (optional)<input id="fix-direction" maxlength="3000" placeholder="For example: keep the original rhythm"></label><div class="review-controls"><button id="fix-apply">Apply to editor</button><button id="fix-again">Try again</button><button id="fix-keep">Keep original</button></div><small>Suggestions are checked locally before applying. Changes remain unsaved.</small><button id="fix-recheck">Recheck writing</button></section>`;
  $("review-panel").append(panel);
  const manualActions = document.createElement("div");
  manualActions.className = "review-controls";
  const editMyself = el("button", "Edit myself");
  const markAddressed = el("button", "Mark as addressed");
  manualActions.append(editMyself, markAddressed);
  $("fix-issue").after(manualActions);
  let findingActions = {};
  editMyself.onclick = async () => {
    close();
    try {
      await findingActions.onEdit?.();
    } catch (e) {
      note(e.message);
    }
  };
  markAddressed.onclick = () => {
    close();
    findingActions.onAddress?.();
  };
  const settings = document.createElement("details");
  settings.id = "fix-settings";
  settings.open = true;
  settings.append(el("summary", "Request settings"));
  const start = $("fix-occurrence").closest("label"),
    end = $("fix-notice");
  start.before(settings);
  let next = start;
  while (next && next !== end) {
    const following = next.nextSibling;
    settings.append(next);
    next = following;
  }
  const supplied = document.createElement("section");
  supplied.hidden = true;
  supplied.innerHTML = `<p id="fix-supplied-hint"></p><blockquote id="fix-supplied-text"></blockquote><p id="fix-question"></p><label hidden>Your answer<textarea id="fix-answer" maxlength="6000"></textarea></label><label>Passage to revise<select id="fix-replacement-scope"></select></label>`;
  $("fix-issue").after(supplied);
  let suppliedProposal = null;
  const isEditorialFinding = (f) =>
    !!(f.suggestion || f.replacement || f.question);
  const agentLabel = (a) =>
    ({
      claude: "Claude Code",
      codex: "Codex",
      pi: "Pi",
      review: "Review suggestion",
    })[a] || a;
  const undoFix = el("button", "Undo change");
  undoFix.id = "fixUndo";
  undoFix.hidden = true;
  $("fix-apply").after(undoFix);
  undoFix.onclick = () => {
    if (file !== capturedFile || editor.value !== appliedValue)
      return note(
        "Later edits are present. Use the editor Undo history to preserve them.",
      );
    editor.value = captured;
    editor.dispatchEvent(new Event("input"));
    appliedValue = null;
    if (baseline && checkRequest)
      window.acceptFixChecks?.(baseline, { ...checkRequest, text: captured });
    note(
      "Change undone. Original text restored; you can compare proposals again.",
    );
    state();
  };

  const validation = document.createElement("section");
  validation.id = "fix-validation";
  validation.hidden = true;
  validation.setAttribute("aria-live", "polite");
  $("fix-direction").closest("label").before(validation);
  let validating = false,
    checkedValue = null,
    checkGeneration = 0,
    checkTimer;
  const checkCache = new Map();
  let baseline = null,
    checkedJob = null,
    appliedValue = null,
    checkRequest = null;
  function proposalText() {
    let value = captured;
    const changes = Array.from($("fix-changes").querySelectorAll("textarea"))
      .filter(
        (input) => input.closest("section").querySelector("input").checked,
      )
      .map((input) => ({
        ...targets[Number(input.dataset.target)],
        after: input.value,
      }));
    for (const c of changes.sort((a, b) => b.start - a.start))
      value = value.slice(0, c.start) + c.after + value.slice(c.end);
    return value;
  }
  function validationMessage(message) {
    validation.hidden = false;
    validation.replaceChildren(el("strong", "Writing check"), el("p", message));
  }
  async function checkSnapshot(text, base) {
    let job = await api("review-start", { ...base, text, kind: "checks" });
    while (job.state === "running") {
      await new Promise((resolve) => setTimeout(resolve, 700));
      job = await api("review-job?id=" + encodeURIComponent(job.id));
    }
    if (job.state !== "complete")
      throw Error(job.error || "Writing checks did not complete.");
    return job;
  }
  let checkQueue = Promise.resolve();
  function scheduleCheck() {
    clearTimeout(checkTimer);
    const generation = ++checkGeneration;
    const currentAttempt = attempts[Number($("fix-attempt").value)];
    if (currentAttempt) {
      currentAttempt.checkLabel = "Checking…";
      updateTabs();
    }
    checkedValue = null;
    validating = true;
    validation.dataset.warning = "false";
    validationMessage("Checking this suggestion… Your article is unchanged.");
    state();
    checkTimer = setTimeout(() => {
      checkQueue = checkQueue.then(async () => {
        if (generation !== checkGeneration) return;
        const value = proposalText();
        const base = {
          file: capturedFile,
          context: $("context").value,
          scope: $("review-scope").value,
        };
        try {
          if (!baseline) {
            const original = await checkSnapshot(captured, base);
            if (generation !== checkGeneration) return;
            baseline = original;
          }
          let after = checkCache.get(value);
          if (!after) {
            after = await checkSnapshot(value, base);
            if (generation !== checkGeneration) return;
            checkCache.set(value, after);
          }
          if (generation !== checkGeneration) return;
          if (stale()) throw Error("Article changed. Reopen a fresh finding.");
          checkPeerSources(after);
          const diff = window.compareFixChecks(baseline.result, after.result);
          renderCheckComparison(diff, after);
          checkedValue = value;
          checkedJob = after;
          checkRequest = { ...base, text: value, kind: "checks" };
          updateAttemptCheck(diff);
        } catch (e) {
          if (generation !== checkGeneration) return;
          validationMessage("Could not check this suggestion. " + e.message);
          const retry = el("button", "Retry check");
          retry.onclick = scheduleCheck;
          validation.append(retry);
          validation.dataset.warning = "true";
        } finally {
          if (generation === checkGeneration) {
            validating = false;
            state();
          }
        }

        function updateAttemptCheck(diff) {
          const attempt = attempts[Number($("fix-attempt").value)];
          if (attempt) {
            attempt.checkLabel = diff.incomplete
              ? "Incomplete"
              : [
                  diff.added.length ? diff.added.length + " new" : "",
                  diff.changed.length ? diff.changed.length + " changed" : "",
                ]
                  .filter(Boolean)
                  .join(" · ") || "No new findings";
            updateTabs();
          }
        }

        function renderCheckComparison(diff, after) {
          validation.dataset.warning = String(
            diff.incomplete || diff.added.length > 0 || diff.changed.length > 0,
          );
          showComparisonSummary();
          validation.append(
            el(
              "small",
              `${diff.resolved.length} no longer reported · ${diff.retained.length} still present`,
            ),
          );
          const details = document.createElement("details");
          details.append(el("summary", "See check details"));
          renderFindingChanges();
          for (const [label, job] of [
            ["Before", baseline],
            ["Suggestion", after],
          ])
            for (const c of job.result.checks || [])
              details.append(
                el("p", `${label} · ${c.name}: ${c.status} — ${c.detail}`),
              );
          details.append(
            el(
              "small",
              "Local checks are advisory; they do not verify meaning or facts or re-run an editorial agent. Similar wording is grouped as a changed finding; this is a heuristic, not proof of resolution.",
            ),
          );
          validation.append(details);

          function showComparisonSummary() {
            validationMessage(
              diff.incomplete
                ? "Checks incomplete — review coverage."
                : diff.added.length
                  ? `${diff.added.length} new finding${diff.added.length === 1 ? "" : "s"} to review`
                  : diff.changed.length
                    ? `${diff.changed.length} changed finding${diff.changed.length === 1 ? "" : "s"} to review`
                    : "No new automated findings",
            );
          }

          function renderFindingChanges() {
            for (const [label, findings] of [
              ["New", diff.added],
              [
                "Changed wording — still needs review",
                diff.changed.map((f) => f.after),
              ],
              ["No longer reported", diff.resolved],
              ["Still present", diff.retained],
            ]) {
              if (!findings.length) continue;
              details.append(el("h4", label));
              for (const f of findings)
                details.append(
                  el(
                    "p",
                    `${f.rule}: ${f.message}${f.excerpt ? " — “" + f.excerpt + "”" : ""}`,
                  ),
                );
            }
          }
        }

        function checkPeerSources(after) {
          const peersChanged = Object.keys(baseline.sources || {}).some(
            (p) =>
              p !== base.file && baseline.sources[p] !== after.sources?.[p],
          );
          if (peersChanged) {
            baseline = null;
            checkCache.clear();
            throw Error(
              "Collection changed. Check again using the current text.",
            );
          }
        }
      });
    }, 600);
  }
  let finding,
    locations = [],
    files = {},
    sources = {},
    origin,
    scroll = 0,
    captured = "",
    capturedFile = "",
    capturedContext = "",
    capturedScope = "",
    targets = [],
    attempts = [],
    running = null;
  const note = (s) => {
    $("fix-notice").textContent = s;
  };
  const selectedAgents = () =>
    Array.from($("fix-agents").querySelectorAll("input:checked")).map(
      (e) => e.value,
    );
  const digest = async (text) =>
    Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
      ),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
  function close() {
    panel.hidden = true;
    $("review-panel").classList.remove("fix-open");
    $("review-panel").scrollTop = scroll;
    origin?.focus();
  }
  $("fix-recheck").onclick = () => {
    close();
    $("run-checks").click();
  };
  $("fix-back").onclick = close;
  $("fix-keep").onclick = close;
  function stale() {
    return (
      file !== capturedFile ||
      editor.value !== captured ||
      $("context").value !== capturedContext ||
      $("review-scope").value !== capturedScope
    );
  }
  function requestState(busy, applied) {
    $("fix-run").disabled =
      busy ||
      !selectedAgents().length ||
      stale() ||
      (!!suppliedProposal && !targets.length) ||
      (!!finding?.question && !$("fix-answer").value.trim());
    $("fix-answer").disabled = busy || applied;
    $("fix-again").disabled = $("fix-run").disabled;
    $("fix-cancel").hidden = !busy;
    $("fix-occurrence").disabled = busy;
    $("fix-replacement-scope").disabled =
      busy || applied || stale() || !suppliedProposal?.options.length;
  }
  function applyState(busy, applied) {
    $("fixUndo").hidden = !applied;
    $("fixUndo").disabled =
      file !== capturedFile || editor.value !== appliedValue;
    $("fix-keep").hidden = applied;
    $("fix-again").hidden = applied || !!suppliedProposal?.ready;
    $("fix-apply").hidden =
      applied || !$("fix-changes").querySelector("textarea");
    $("fix-apply").disabled =
      busy ||
      validating ||
      stale() ||
      checkedValue !== proposalText() ||
      proposalText() === captured ||
      !$("fix-changes").querySelector("textarea");
    $("fix-recheck").disabled = validating;
  }
  function state() {
    const applied = appliedValue !== null;
    const busy = !!running;
    editMyself.disabled = busy;
    requestState(busy, applied);
    applyState(busy, applied);
    $("fix-disclosure").textContent =
      "Sends the selected passage and " +
      ($("fix-context").value === "article"
        ? "whole article"
        : "surrounding paragraphs") +
      " to " +
      (selectedAgents()
        .map((a) => ({ claude: "Claude Code", codex: "Codex", pi: "Pi" })[a])
        .join(" and ") || "the selected agents") +
      ". Each selected agent makes a separate request and uses its account allowance.";
    if (applied && !panel.hidden)
      note(
        editor.value === appliedValue && file === capturedFile
          ? editor.value === saved
            ? "Applied · saved locally."
            : "Applied · unsaved. Save writes this change locally."
          : "Applied; text changed again. Use Undo history for later edits.",
      );
    if (stale() && !panel.hidden && !applied)
      note(
        "Text or article changed. Reopen a fresh finding before requesting or applying a fix.",
      );
  }
  function request() {
    return {
      file: capturedFile,
      text: captured,
      agent: selectedAgents()[0],
      model: $("fix-model").value.trim(),
      issue:
        (finding.rule || "Finding") +
        ": " +
        (finding.message || finding.excerpt || ""),
      suggestion: finding.suggestion || "",
      question: finding.question || "",
      answer: $("fix-answer").value,
      instructions: $("fix-instructions").value,
      approach: $("fix-approach").value,
      context: $("fix-context").value,
      targets,
      direction: $("fix-direction").value,
      previous: attempts.length
        ? JSON.stringify(attempts[Number($("fix-attempt").value) || 0].result)
        : "",
    };
  }
  async function choose() {
    ++checkGeneration;
    clearTimeout(checkTimer);
    appliedValue = null;
    checkedJob = null;
    checkRequest = null;
    $("fix-settings").open = true;
    baseline = null;
    checkCache.clear();
    checkedValue = null;
    validating = false;
    validation.hidden = true;
    const selected = $("fix-occurrence").value;
    const chosen =
      selected === "all"
        ? locations.filter((l) => (files[l.piece] || file) === file)
        : [locations[Number(selected)]];
    const targetFile = files[chosen[0]?.piece] || file;
    if (targetFile !== file) {
      $("files").value = targetFile;
      await openFile(targetFile);
    }
    captured = editor.value;
    capturedFile = file;
    capturedContext = $("context").value;
    capturedScope = $("review-scope").value;
    if (sources[file] && (await digest(captured)) !== sources[file])
      throw Error("This finding is out of date. Rerun the review.");
    targets = [];
    for (const l of chosen) {
      if (!l || finding.verified === false) continue;
      const r = window.findingRange(captured, l);
      if (
        r.end > r.start &&
        !targets.some((t) => t.start === r.start && t.end === r.end)
      )
        targets.push({ ...r, before: captured.slice(r.start, r.end) });
    }
    targets.sort((a, b) => a.start - b.start);
    if (targets.some((t, i) => i && targets[i - 1].end > t.start))
      throw Error("These matches overlap. Choose one occurrence.");
    $("fix-quote").textContent =
      targets.map((t) => t.before).join(" … ") ||
      finding.excerpt ||
      "No verified prose target. The agent can suggest next steps.";
    attempts = [];
    $("fix-changes").replaceChildren();
    $("fix-proposal-tabs").replaceChildren();
    $("fix-result").hidden = true;
    if (isEditorialFinding(finding)) showEditorialProposal();
    else {
      suppliedProposal = null;
      supplied.hidden = true;
      note("Adjust the instructions if needed, then find a fix.");
    }
    state();
  }
  function showEditorialProposal() {
    suppliedProposal = window.editorialProposal(captured, finding);
    supplied.hidden = suppliedProposal.ready;
    $("fix-supplied-text").hidden = false;
    $("fix-supplied-hint").hidden = false;
    const ready = suppliedProposal.ready;
    panel.querySelector("h2").textContent = window.editorialAction(
      finding,
      ready,
    );
    $("fix-settings").open = !ready;
    $("fix-settings").querySelector("summary").textContent = ready
      ? "Generate alternatives"
      : "Draft an edit";
    $("fix-run").textContent = ready
      ? "Generate alternatives"
      : "Draft an edit";
    $("fix-direction").closest("label").hidden = ready;
    $("fix-supplied-text").textContent =
      finding.suggestion || finding.message || "";
    $("fix-question").textContent = finding.question || "";
    $("fix-answer").closest("label").hidden = !finding.question;
    $("fix-supplied-hint").textContent = suppliedProposal.options.length
      ? finding.question
        ? "Answer this question, then draft an edit for review."
        : "This review contains advice, not replacement wording. Draft an edit before applying."
      : "The quoted passage could not be verified. Edit the article manually or rerun the review.";
    $("fix-replacement-scope").replaceChildren(
      ...suppliedProposal.options.map((o, i) => new Option(o.label, String(i))),
    );
    targets = [];
    if (ready) useSupplied(0);
    else {
      const index = Math.max(
        0,
        suppliedProposal.options.findIndex((o) => o.label === "Whole sentence"),
      );
      $("fix-replacement-scope").value = String(index);
      chooseDraftTarget();
    }
  }

  function useSupplied(index) {
    const target = suppliedProposal?.options[index];
    if (!suppliedProposal.ready || !target) return;
    targets = [target];
    $("fix-supplied-text").hidden = true;
    $("fix-supplied-hint").hidden = true;
    $("fix-quote").textContent = target.before;
    attempts = [
      {
        agent: "review",
        result: {
          summary:
            finding.suggestion ||
            "Edit supplied by the review. No additional agent request.",
          changes: [
            {
              target: 0,
              before: target.before,
              after: suppliedProposal.after,
              reason: "",
            },
          ],
        },
      },
    ];
    proposalChoices(0);
    renderAttempt();
    note("Review the replacement and its writing checks before applying.");
  }
  function clearDraft() {
    ++checkGeneration;
    clearTimeout(checkTimer);
    attempts = [];
    checkedValue = null;
    checkedJob = null;
    checkRequest = null;
    validating = false;
    validation.hidden = true;
    $("fix-changes").replaceChildren();
    $("fix-result").hidden = true;
  }
  function chooseDraftTarget() {
    clearDraft();
    const target =
      suppliedProposal?.options[Number($("fix-replacement-scope").value)];
    targets = target ? [target] : [];
    $("fix-quote").textContent =
      target?.before || finding.excerpt || "No verified passage.";
    note(
      finding.question
        ? "Your answer is needed before drafting an edit."
        : "Drafting sends a new request. Your article remains unchanged until you review and apply an edit.",
    );
    state();
  }
  $("fix-replacement-scope").onchange = chooseDraftTarget;
  $("fix-answer").oninput = () => {
    clearDraft();
    state();
  };
  window.openFindingFix = async (f, mapping, button, hashes, actions = {}) => {
    if (running) {
      note("A request is running. Cancel it before opening another finding.");
      panel.hidden = false;
      $("review-panel").classList.add("fix-open");
      return;
    }
    try {
      await flushMetadata();
    } catch (e) {
      note(e.message);
      return;
    }
    finding = f;
    capturedFile = "";
    appliedValue = null;
    suppliedProposal = null;
    targets = [];
    clearDraft();
    state();
    findingActions = actions;
    editMyself.hidden = !actions.onEdit;
    markAddressed.hidden = !actions.onAddress;
    const existing = isEditorialFinding(f);
    panel.querySelector("h2").textContent = window.editorialAction(f);
    $("fix-settings").querySelector("summary").textContent = existing
      ? "Generate alternatives"
      : "Request settings";
    $("fix-run").textContent = existing
      ? "Generate alternatives"
      : "Find a fix";
    $("fix-again").textContent = existing
      ? "Generate alternatives"
      : "Try again";
    $("fix-direction").closest("label").hidden = existing;
    files = mapping || {};
    sources = hashes || {};
    origin = button;
    scroll = $("review-panel").scrollTop;
    locations = f.locations?.length ? f.locations : [f];
    panel.hidden = false;
    $("review-panel").classList.add("fix-open");
    $("review-panel").scrollTop = 0;
    $("fix-issue").textContent =
      (f.rule || "Finding").replaceAll("-", " ") + " — " + (f.message || "");
    $("fix-instructions").value =
      localStorage.getItem("author-fix-instructions") || defaults;
    $("fix-remember").checked = !!localStorage.getItem(
      "author-fix-instructions",
    );
    $("fix-direction").value = "";
    $("fix-answer").value = "";
    $("fix-prompt").hidden = true;
    $("fix-occurrence").replaceChildren(
      ...locations.map(
        (l, i) =>
          new Option(
            (l.piece || "Current article") +
              " · " +
              (l.text || l.excerpt || "line " + l.line).slice(0, 80) +
              " · " +
              (i + 1),
            String(i),
          ),
      ),
    );
    if (locations.filter((l) => (files[l.piece] || file) === file).length > 1)
      $("fix-occurrence").add(
        new Option("All occurrences in this article", "all"),
      );
    // Prefer the exact occurrence most recently selected in the source editor.
    const at = locations.findIndex(
      (l) =>
        l.start === editor.selectionStart && (files[l.piece] || file) === file,
    );
    if (at >= 0) $("fix-occurrence").value = String(at);
    try {
      const agents = await api("review-agents").catch((e) => {
        if (existing) return [];
        throw e;
      });
      const preferred = JSON.parse(
        localStorage.getItem("author-fix-agents") || "null",
      ) || [$("review-agent").value];
      $("fix-agents").replaceChildren(
        el("strong", "Compare agents"),
        ...agents.map((a) => {
          const label = el(
            "label",
            a.label + (a.installed ? "" : " — not installed"),
          );
          const check = document.createElement("input");
          check.type = "checkbox";
          check.value = a.id;
          check.disabled = !a.installed;
          check.checked = a.installed && preferred.includes(a.id);
          check.onchange = () => {
            localStorage.setItem(
              "author-fix-agents",
              JSON.stringify(selectedAgents()),
            );
            state();
          };
          label.prepend(check);
          return label;
        }),
      );
      await choose();
      $("fix-back").focus();
    } catch (e) {
      capturedFile = "";
      note(e.message);
      state();
    }
  };
  $("fix-occurrence").onchange = () =>
    choose().catch((e) => {
      capturedFile = "";
      note(e.message);
      state();
    });
  $("fix-context").onchange = state;
  $("fix-reset").onclick = () => {
    $("fix-instructions").value = defaults;
    if ($("fix-remember").checked)
      localStorage.setItem("author-fix-instructions", defaults);
  };
  const remember = () => {
    if ($("fix-remember").checked)
      localStorage.setItem(
        "author-fix-instructions",
        $("fix-instructions").value,
      );
    else localStorage.removeItem("author-fix-instructions");
  };
  $("fix-remember").onchange = remember;
  $("fix-instructions").oninput = remember;
  $("fix-exact").onclick = async () => {
    try {
      const r = await api("fix-prompt", request());
      $("fix-prompt").textContent = r.prompt;
      $("fix-prompt").hidden = false;
      note("Exact request shown. Nothing was sent.");
    } catch (e) {
      note(e.message);
    }
  };
  function el(tag, text) {
    const e = document.createElement(tag);
    e.textContent = text;
    return e;
  }
  function proposalChoices(selected) {
    $("fix-attempt").replaceChildren(
      ...attempts.map(
        (a, i) => new Option(agentLabel(a.agent) + " · " + (i + 1), String(i)),
      ),
    );
    $("fix-proposal-tabs").replaceChildren(
      ...attempts.map((a, i) => {
        const button = el("button", agentLabel(a.agent) + " · " + (i + 1));
        button.onclick = () => {
          $("fix-attempt").value = String(i);
          renderAttempt();
        };
        return button;
      }),
    );
    $("fix-attempt").value = String(selected);
    $("fix-proposal-tabs").hidden = attempts.length < 2;
  }
  function updateTabs() {
    Array.from($("fix-proposal-tabs").children).forEach((b, i) => {
      const a = attempts[i];
      b.textContent =
        agentLabel(a.agent) +
        " · " +
        (i + 1) +
        " · " +
        (a.checkLabel || "Not checked");
    });
  }
  function renderAttempt() {
    const a = attempts[Number($("fix-attempt").value)];
    if (!a) return;
    Array.from($("fix-proposal-tabs").children).forEach((b, i) =>
      b.setAttribute(
        "aria-pressed",
        String(i === Number($("fix-attempt").value)),
      ),
    );
    $("fix-result").hidden = false;
    $("fix-settings").open = false;
    $("fix-summary").textContent = a.result.summary;
    $("fix-changes").replaceChildren();
    for (const c of a.result.changes) {
      const box = el("section", "");
      box.className = "fix-change";
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = c.include !== false;
      check.onchange = () => {
        c.include = check.checked;
        scheduleCheck();
      };
      check.dataset.target = c.target;
      const label = el("label", "Include this change");
      label.prepend(check);
      box.append(
        label,
        el("small", "Original"),
        el("blockquote", c.before),
        el("small", "Suggested"),
      );
      const input = document.createElement("textarea");
      input.value = c.after;
      input.oninput = () => {
        c.after = input.value;
        box
          .querySelector(".fix-diff")
          .replaceChildren(
            el("del", c.before),
            document.createTextNode(" "),
            el("ins", c.after),
          );
        scheduleCheck();
      };
      input.setAttribute(
        "aria-label",
        "Suggested replacement " + (c.target + 1),
      );
      input.dataset.target = c.target;
      box.append(input, el("p", c.reason));
      const diff = el("p", "");
      diff.className = "fix-diff";
      const before = c.before.split(/(\s+)/),
        after = c.after.split(/(\s+)/);
      let a = 0;
      while (a < before.length && a < after.length && before[a] === after[a])
        a++;
      let b = before.length,
        d = after.length;
      while (b > a && d > a && before[b - 1] === after[d - 1]) {
        b--;
        d--;
      }
      diff.append(
        document.createTextNode(before.slice(0, a).join("")),
        el("del", before.slice(a, b).join("")),
        document.createTextNode(" "),
        el("ins", after.slice(a, d).join("")),
        document.createTextNode(after.slice(d).join("")),
      );
      box.append(diff);
      $("fix-changes").append(box);
    }
    if (!a.result.changes.length)
      $("fix-changes").append(
        el(
          "p",
          "No automatic replacement proposed. Keep the original or follow the suggested next step.",
        ),
      );
    if (a.result.changes.length && !appliedValue) scheduleCheck();
    else {
      ++checkGeneration;
      checkedValue = null;
      validating = false;
      validation.hidden = true;
    }
    state();
  }
  $("fix-attempt").onchange = renderAttempt;
  async function run() {
    if (stale()) return state();
    if (finding.question && !$("fix-answer").value.trim())
      return note("Answer the editorial question first.");
    if (suppliedProposal && !targets.length)
      return note("No verified passage. Edit manually or rerun the review.");
    const agents = selectedAgents();
    if (!agents.length) return note("Choose at least one agent.");
    const base = request();
    running = [];
    state();
    note("Finding fixes with " + agents.join(", ") + "…");
    const results = await Promise.allSettled(
      agents.map(async (agent) => {
        const job = await api("fix-start", { ...base, agent });
        running?.push(job);
        if (running?.cancelled) await api("fix-cancel", { id: job.id });
        state();
        let result = job;
        while (result.state === "running") {
          await new Promise((r) => setTimeout(r, 1000));
          result = await api("fix-job?id=" + job.id);
        }
        if (result.state !== "complete")
          throw Error(agent + ": " + (result.error || "cancelled"));
        return { agent, result: result.result };
      }),
    );
    running = null;
    const errors = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled") attempts.push(r.value);
      else errors.push(r.reason.message);
    }
    proposalChoices(
      Math.max(
        0,
        attempts.length -
          results.filter((r) => r.status === "fulfilled").length,
      ),
    );
    renderAttempt();
    updateTabs();
    $("fix-result").scrollIntoView({ block: "start" });
    state();
    note(
      (stale()
        ? "Text changed; suggestions cannot be applied. "
        : "Compare the named proposals, then select one to apply. ") +
        errors.join(" · "),
    );
  }
  $("fix-run").onclick = run;
  $("fix-again").onclick = () => {
    if (suppliedProposal?.ready) {
      $("fix-settings").open = true;
      $("fix-direction").closest("label").hidden = false;
      $("fix-run").focus();
    } else run();
  };
  $("fix-cancel").onclick = () => {
    if (running) running.cancelled = true;
    for (const job of running || [])
      api("fix-cancel", { id: job.id }).catch((e) => note(e.message));
  };
  $("fix-apply").onclick = async () => {
    try {
      await flushMetadata();
    } catch (e) {
      note(e.message);
      return;
    }
    if (validating) return;
    if (stale()) return state();
    const changes = [];
    for (const input of $("fix-changes").querySelectorAll("textarea")) {
      const i = Number(input.dataset.target);
      const box = input.closest("section");
      if (box.querySelector("input").checked)
        changes.push({ ...targets[i], after: input.value });
    }
    if (!changes.length) return note("Select a change to apply.");
    let value = editor.value;
    for (const c of changes.sort((a, b) => b.start - a.start)) {
      if (value.slice(c.start, c.end) !== c.before)
        return note("The target changed. Nothing was applied.");
      value = value.slice(0, c.start) + c.after + value.slice(c.end);
    }
    if (value === editor.value) return note("No text changes selected.");
    if (checkedValue !== value) return scheduleCheck();
    appliedValue = value;
    editor.value = value;
    editor.dispatchEvent(new Event("input"));
    if (checkedJob && checkRequest)
      window.acceptFixChecks?.(checkedJob, checkRequest);
    state();
    note(
      "Checked suggestion applied. Your changes are unsaved; Undo restores the original.",
    );
  };
  setInterval(() => {
    if (!panel.hidden) state();
  }, 700);
})();
