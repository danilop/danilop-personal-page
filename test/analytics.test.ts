import { test } from "node:test";
import assert from "node:assert/strict";
import { CONSENT_DAYS, readConsent, cleanEvent } from "../core/analytics";
import { analyticsDashboardUrl } from "../core/analytics-dashboard";
test("consent expires and malformed, future or old-version preferences do not enable analytics", () => {
  const now = 1900000000000;
  const encode = (accepted: unknown, at = now, version = 1) =>
    JSON.stringify({ accepted, at, version });
  assert.equal(readConsent(encode(true), now), true);
  assert.equal(readConsent(encode(false), now), false);
  for (const value of [
    null,
    "invalid",
    encode("true"),
    encode(true, now + 1),
    encode(true, now, 0),
    encode(true, now - CONSENT_DAYS * 86400000),
  ])
    assert.equal(readConsent(value, now), undefined);
});
test("event boundary removes SDK URL/referrer details, arbitrary properties and unapproved event types", () => {
  const context = {
    origin: "https://www.danilop.net",
    path: "/writing/hello/",
    contentId: "hello",
    referrer: "https://example.org/private?email=secret@example.org",
  };
  const event = cleanEvent(
    {
      event: "collection_navigation_used",
      uuid: "event-id",
      timestamp: new Date(0),
      $set: { email: "secret@example.org" },
      $set_once: { $initial_referrer: "https://example.org/secret" },
      $unset: ["secret"],
      unexpected: "secret",
      properties: {
        token: "phc_publicproject",
        distinct_id: "browser-id",
        direction: "next",
        collection_id: "book",
        input: "secret",
        $current_url: "https://example.org/?secret=1",
        $initial_referrer: "secret",
        $set: { email: "secret" },
        $session_id: "session-id",
      },
    },
    context,
  )!;
  assert.equal(
    event.properties.$current_url,
    "https://www.danilop.net/writing/hello/",
  );
  assert.equal(event.properties.$referring_domain, "example.org");
  assert.equal(event.properties.direction, "next");
  assert.equal(event.properties.$session_id, "session-id");
  assert.equal(event.properties.token, "phc_publicproject");
  assert.equal(event.properties.$process_person_profile, false);
  assert.ok(!JSON.stringify(event).includes("secret"));
  assert.equal(event.uuid, "event-id");
  assert.deepEqual(event.timestamp, new Date(0));
  assert.equal(
    cleanEvent({ event: "$autocapture", properties: {} }, context),
    null,
  );
  assert.equal(
    cleanEvent({ event: "$exception", properties: {} }, context),
    null,
  );
});

test("dashboard selection uses the private note labels, not the newest numeric ID", () => {
  const note = `# Operations
## PostHog
- Traffic: [Traffic](https://eu.posthog.com/project/123/dashboard/456).
- Collections/books: [Books](https://eu.posthog.com/project/123/dashboard/789).
### Recovery
Keep these links current.
## Hosting
- Traffic: [Unrelated](https://example.org/).
`;
  assert.equal(
    analyticsDashboardUrl(note),
    "https://eu.posthog.com/project/123/dashboard/456",
  );
  assert.equal(
    analyticsDashboardUrl(note, "collections"),
    "https://eu.posthog.com/project/123/dashboard/789",
  );
  assert.equal(
    analyticsDashboardUrl(note, "dashboards"),
    "https://eu.posthog.com/project/123/dashboard",
  );
  assert.throws(() => analyticsDashboardUrl(note, "newest"), /Choose/);
  assert.throws(() => analyticsDashboardUrl(""), /exactly one/);
  assert.throws(
    () =>
      analyticsDashboardUrl(
        note.replace(
          "### Recovery",
          "- Traffic: [Duplicate](https://eu.posthog.com/project/123/dashboard/999)\n### Recovery",
        ),
      ),
    /exactly one/,
  );
  for (const url of [
    "https://eu.posthog.com.evil.invalid/project/123/dashboard/456",
    "https://user@eu.posthog.com/project/123/dashboard/456",
    "https://eu.posthog.com/project/123/dashboard/456?secret=value",
    "https://eu.posthog.com/project/123/dashboard/456#fragment",
    "https://eu.posthog.com/project/123/notebooks/456",
  ])
    assert.throws(
      () => analyticsDashboardUrl(`## PostHog\n- Traffic: [Traffic](${url})`),
      /Expected/,
    );
});
