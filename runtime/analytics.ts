/// <reference types="astro/client" />
import {
  CONSENT_DAYS,
  CONSENT_KEY,
  cleanEvent,
  readConsent,
} from "../core/analytics";
import type { PostHog } from "posthog-js/dist/module.no-external";

const config = document.querySelector<HTMLElement>("#analytics-config");
const banner = document.querySelector<HTMLElement>("#analytics-choice")!;
let accepted: boolean | undefined;
try {
  accepted = readConsent(localStorage.getItem(CONSENT_KEY));
} catch {
  /* Session-only choice. */
}
let client: PostHog | undefined;
let loading = false;
const data = config?.dataset;
const allowedHost =
  data &&
  (location.origin === data.origin ||
    (import.meta.env.DEV &&
      ["127.0.0.1", "localhost"].includes(location.hostname)));
const context = {
  origin: data?.origin ?? location.origin,
  path: data?.path ?? "/",
  contentId: data?.contentId,
  referrer: document.referrer,
};
function clearIdentifier() {
  if (!data?.token) return;
  const name = `ph_${data.token}_posthog`;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}
export function track(name: string, properties: Record<string, unknown> = {}) {
  if (accepted === true && client && allowedHost)
    client.capture(name, properties);
}
async function start() {
  if (!config || !allowedHost || accepted !== true || loading || client) return;
  loading = true;
  try {
    const { default: posthog } =
      await import("posthog-js/dist/module.no-external");
    if (accepted !== true) return;
    client = posthog.init(config.dataset.token!, {
      api_host: config.dataset.host!,
      persistence: "cookie",
      cross_subdomain_cookie: false,
      cookie_expiration: CONSENT_DAYS,
      secure_cookie: location.protocol === "https:",
      opt_out_capturing_by_default: true,
      opt_out_persistence_by_default: true,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_exceptions: false,
      capture_performance: false,
      rageclick: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_surveys_automatic_display: true,
      disable_web_experiments: true,
      disable_external_dependency_loading: true,
      advanced_disable_flags: true,
      person_profiles: "never",
      save_referrer: false,
      save_campaign_params: false,
      request_batching: false,
      before_send: (event) =>
        accepted === true && event ? cleanEvent(event, context) : null,
    });
    if (accepted === true) {
      client?.opt_in_capturing();
      track("$pageview");
      beginEngagement();
    }
  } catch {
    document.querySelector("#analytics-status")!.textContent =
      "Statistics could not load. Your choice is saved; the site still works.";
  } finally {
    loading = false;
  }
}
function showChoice() {
  if (!config || !allowedHost) return;
  banner.hidden = false;
  banner.querySelector<HTMLElement>("[data-analytics-close]")!.hidden =
    accepted === undefined;
}
function choose(value: boolean) {
  accepted = value;
  try {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ version: 1, accepted: value, at: Date.now() }),
    );
  } catch {
    /* Respect choice in memory. */
  }
  banner.hidden = true;
  if (value) void start();
  else {
    endEngagement();
    client?.opt_out_capturing();
    clearIdentifier();
    if (client) location.reload();
  }
}
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-analytics-choice]",
))
  button.addEventListener("click", () =>
    choose(button.dataset.analyticsChoice === "accept"),
  );
banner
  .querySelector("[data-analytics-close]")
  ?.addEventListener("click", () => {
    banner.hidden = true;
  });
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-privacy-settings]",
)) {
  button.hidden = !config || !allowedHost;
  button.addEventListener("click", () => {
    showChoice();
    document.querySelector<HTMLElement>("#analytics-title")?.focus();
  });
}
window.addEventListener("storage", (event) => {
  if (event.key !== CONSENT_KEY) return;
  const choice = readConsent(event.newValue);
  if (choice !== true && accepted === true) {
    accepted = choice;
    client?.opt_out_capturing();
    location.reload();
  }
});
let timer: ReturnType<typeof setInterval> | undefined;
let activeSeconds = 0;
let lastTick = Date.now();
let lastActivity = Date.now();
const milestones = new Set<number>();
function endEngagement() {
  if (timer) clearInterval(timer);
  timer = undefined;
}
function beginEngagement() {
  const body = document.querySelector<HTMLElement>("article.reading .prose");
  if (!body || timer) return;
  activeSeconds = 0;
  lastTick = Date.now();
  lastActivity = Date.now();
  for (const event of ["pointerdown", "keydown", "scroll"])
    window.addEventListener(
      event,
      () => {
        lastActivity = Date.now();
      },
      { passive: true },
    );
  timer = setInterval(() => {
    const now = Date.now();
    if (
      accepted === true &&
      document.visibilityState === "visible" &&
      now - lastActivity < 60000
    )
      activeSeconds += Math.min((now - lastTick) / 1000, 5);
    lastTick = now;
    const rect = body.getBoundingClientRect();
    const depth = Math.max(
      0,
      Math.min(
        100,
        Math.round(((innerHeight - rect.top) / Math.max(1, rect.height)) * 100),
      ),
    );
    for (const threshold of [30, 60, 180]) {
      if (activeSeconds >= threshold && !milestones.has(threshold)) {
        milestones.add(threshold);
        track("article_engagement", {
          active_seconds: threshold,
          depth: Math.floor(depth / 25) * 25,
        });
      }
    }
  }, 5000);
}
window.addEventListener("pagehide", endEngagement);
window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});
document.addEventListener("click", (event) => {
  const el = event.target instanceof Element ? event.target : null;
  if (!el) return;
  const navigation = el.closest<HTMLElement>(".reading-navigation a");
  const startLink = el.closest<HTMLElement>(".collection-start .read-link");
  const artifact = el.closest<HTMLElement>("[data-edition-artifact]");
  if (navigation)
    track("collection_navigation_used", {
      direction: navigation.dataset.direction,
      collection_id: navigation.closest<HTMLElement>("[data-collection-id]")
        ?.dataset.collectionId,
    });
  if (startLink)
    track("collection_reading_started", {
      collection_type: startLink.dataset.collectionType,
      collection_id: startLink.dataset.collectionId,
    });
  if (artifact)
    track("edition_artifact_opened", {
      edition_id: artifact.dataset.editionId,
    });
  if (el.closest(".load-embed")) track("embed_opened");
  const experiment = el
    .closest<HTMLElement>(".experiment [data-action=run]")
    ?.closest<HTMLElement>(".experiment");
  if (experiment)
    track("simulator_started", {
      experiment_id: experiment.dataset.experiment,
    });
});
document.addEventListener("notes:code-copied", () => track("code_copied"));
if (config && allowedHost) {
  if (accepted !== true) clearIdentifier();
  if (accepted === undefined) showChoice();
  else if (accepted) void start();
}
