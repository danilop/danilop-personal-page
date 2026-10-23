import test from "node:test";
import assert from "node:assert/strict";
import { siteSchema } from "../core/config";
import { activeOriginTrials, originTrialWarnings } from "../core/origin-trials";

const token = "A".repeat(60) + "==";
const trial = (expires: string, browser: "chrome" | "edge" = "chrome") => ({
  browser,
  feature: "WebMCP",
  token,
  expires,
});
const now = Date.parse("2026-10-23T12:00:00Z");

test("origin-trial tokens are validated, expired ones omitted and renewals warned", () => {
  const trials = [
    trial("2026-10-22", "edge"),
    trial("2026-10-23"),
    trial("2026-11-17", "edge"),
    trial("2027-03-30"),
  ];
  assert.deepEqual(
    activeOriginTrials(trials, now).map((t) => t.expires),
    ["2026-10-23", "2026-11-17", "2027-03-30"],
  );
  assert.deepEqual(originTrialWarnings(trials, now), [
    "edge WebMCP origin-trial token expired on 2026-10-22; it is omitted.",
    "chrome WebMCP origin-trial token expires on 2026-10-23 (1 days); renew it.",
    "edge WebMCP origin-trial token expires on 2026-11-17 (26 days); renew it.",
  ]);
  const base = {
    schemaVersion: 1,
    relaunchDate: "2026-09-15",
    name: "N",
    title: "T",
    description: "D",
    theme: "plain",
    layout: "linear",
    tokens: {},
    assets: {
      portrait: { path: "p", alt: "a" },
      biography: { path: "b", alt: "b" },
    },
  };
  assert.deepEqual(siteSchema.parse(base).originTrials, []);
  assert.equal(
    siteSchema.parse({ ...base, originTrials: [trial("2027-01-01")] })
      .originTrials[0].browser,
    "chrome",
  );
  for (const bad of [
    { ...trial("2027-01-01"), token: "short" },
    { ...trial("2027-01-01"), browser: "safari" },
    { ...trial("2027-01-01"), expires: "soon" },
    { ...trial("2027-01-01"), extra: true },
  ])
    assert.throws(() => siteSchema.parse({ ...base, originTrials: [bad] }));
});
