export const CONSENT_KEY = "notes.analytics-consent.v1";
export const CONSENT_DAYS = 180;
export function readConsent(
  raw: string | null,
  now = Date.now(),
): boolean | undefined {
  try {
    const value = JSON.parse(raw ?? "null");
    if (
      value?.version === 1 &&
      typeof value.accepted === "boolean" &&
      Number.isFinite(value.at) &&
      value.at <= now &&
      now - value.at < CONSENT_DAYS * 86400000
    )
      return value.accepted;
  } catch {
    /* Invalid preferences require a fresh choice. */
  }
}
const eventProperties: Record<string, string[]> = {
  $pageview: [],
  collection_reading_started: ["collection_type", "collection_id"],
  collection_navigation_used: ["direction", "collection_id"],
  edition_artifact_opened: ["edition_id"],
  article_engagement: ["depth", "active_seconds"],
  code_copied: [],
  embed_opened: [],
  simulator_started: ["experiment_id"],
};
const sdkProperties = [
  "token",
  "distinct_id",
  "$device_id",
  "$session_id",
  "$window_id",
  "$lib",
  "$lib_version",
  "$browser",
  "$browser_version",
  "$os",
  "$os_version",
  "$device_type",
  "$screen_width",
  "$screen_height",
];
/** Only documented properties cross the provider boundary. */
export function cleanEvent<
  T extends { event: string; properties: Record<string, any> },
>(
  event: T,
  context: {
    origin: string;
    path: string;
    contentId?: string;
    referrer?: string;
  },
) {
  const allowed = Object.hasOwn(eventProperties, event.event)
    ? eventProperties[event.event]
    : undefined;
  if (!allowed) return null;
  const properties: Record<string, any> = {};
  for (const name of [...sdkProperties, ...allowed]) {
    const value = event.properties[name];
    if (typeof value === "number" && Number.isFinite(value))
      properties[name] = value;
    else if (
      typeof value === "string" &&
      value.length <= 160 &&
      /^[\w. /:-]+$/.test(value)
    )
      properties[name] = value;
  }
  properties.$current_url = context.origin + context.path;
  properties.$pathname = context.path;
  properties.$host = new URL(context.origin).host;
  properties.content_id = context.contentId;
  properties.$process_person_profile = false;
  if (context.referrer) {
    try {
      properties.$referring_domain = new URL(context.referrer).hostname;
    } catch {
      /* No referrer. */
    }
  }
  return { ...event, properties };
}
