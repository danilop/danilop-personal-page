# Analytics and visitor privacy

## Review and local changes — 17 October 2026

The browser launcher and three implementation corrections are implemented locally,
not yet deployed. `npm run analytics:open` opens the traffic dashboard from the
private operations note. The runtime now revokes consent when another tab clears
local storage, calculates chapter depth across all prose sections, and strips
top-level SDK metadata/profile updates as well as unapproved event properties.
Regression tests cover these cases. The review inspected the installed SDK and
current page markup; it did not send production test events or change PostHog.
Validation: all 15 focused analytics/runtime tests, scoped ESLint, Astro/TypeScript
checks and local documentation file-link checks passed. The CLI help, saved-link
selection and browser-launch command were exercised. A full release build and
deployment were not run for this change.

Both private links and the project's dashboard list were verified in the existing
signed-in Safari session on 17 October. The list contains the traffic and wizard
dashboards described below. The traffic dashboard displays results with mixed
date windows and generic autocapture guidance; the launcher follows the maintained
traffic link rather than assuming the largest dashboard ID is the right report.
Account-specific observations stay in the private operations note. Project
settings and individual insight filters were not audited.

### Remaining improvements

- **Reporting:** replace generic autocapture tiles with the explicit events below,
  align date windows and exclude labelled deployment-test identities. Check the
  actual saved insight filters in a follow-up; no dashboard configuration was changed.
- **Reader context:** page paths distinguish chapter routes, but collection and
  placement IDs are absent from page-view/engagement events. Add these only with
  corresponding report definitions. Continuous reading on collection overview
  pages and audiobook listening are not currently measured.
- **Consent lifetime:** expiry is checked on page load. A page left open beyond
  the preference's expiry does not yet re-prompt until navigation/reload. A future
  change should enforce expiry during an open page and test SDK-load races too.
- **Recovery:** test a private export and restore of event data and dashboard
  definitions before relying on portability. MCP and exports remain unconfigured.

## Historical production verification — 16 September 2026

PostHog Cloud EU integration is implemented. The owner created the account and
authorized wizard v2.74.1. The wizard created a collection/book dashboard and
setup notebook. Account-specific links are kept in the private operations note;
see [private operations and recovery](private-operations.md).
The notebook describes the initial generated integration; this document describes
our reviewed version, including changes to consent and collection.

**Deployed and enabled on production.** Amplify job 12 successfully deployed
revision `096ef19` from `main`; the matching public build marker and GitHub
deployment checks passed on 16 September 2026. The `main` branch uses
the EU project token, EU ingestion host and explicit analytics enable flag in
Amplify. Collection starts only after visitor consent. Deployment completion is
checked against the public build revision and live consent controls. MCP, exports
and historical import remain unconfigured. Local browser tests intercept PostHog
requests rather than sending visitor data.

At that release, all 45 tests, type checking and the production build passed. Local
desktop and mobile browser checks cover acceptance, refusal, withdrawal,
re-acceptance, engagement events and removal of sensitive URL values. No provider
requests occur before consent; withdrawal removes the analytics cookie. The same consent
flow passed on the live site at desktop (1280 × 900) and mobile (390 × 844)
sizes, with no console errors or warnings. The EU ingestion endpoint returned
HTTP 200 with `{"status":"Ok"}` for labelled test traffic on `/privacy/`.
The signed-in traffic dashboard was verified on 16 September 2026. It contains
visitor/session/page-view results, including deployment tests. The private
operations note records the test identity and verification snapshot; exclude
that identity from visitor reports. No automatic removal/report filter is configured.

## Which dashboard to use

Use the traffic dashboard for page views, active users and sessions. The separate
collection/book dashboard measures collection starts, navigation directions,
reading-journey conversion and artifact opens. An ordinary page visit does not
populate those charts; empty results are expected until those actions occur.

The starter template mentions automatic click capture, but this site deliberately
disables broad autocapture. Its generic click-based charts will not fill from
page views alone. Find exact dashboard names and links in the private operations
note, or recover them from the signed-in project's dashboard list.

### Open from the command line

Use the shell shortcut from the repository root:

```sh
./analytics.sh                     # dashboard list (default)
./analytics.sh traffic             # visitors, sessions, page views
./analytics.sh collections         # collection/book actions
./analytics.sh --print             # print the dashboard-list URL without opening
./analytics.sh --help
```

The executable script also works by absolute path from another directory. It
requires Node and the repository dependencies (`npm install`), and delegates to
the same launcher. Put the optional target before any flags; `--notes` and
`--print` are forwarded unchanged. The existing npm commands remain available,
with traffic as their default:

```sh
npm run analytics:open                 # traffic: visitors, sessions, page views
npm run analytics:open -- collections  # collection/book actions
npm run analytics:open -- dashboards   # project dashboard list for recovery
npm run analytics:open -- --print      # print the saved traffic URL without opening
npm run analytics:open -- --help
```

Each run reads `~/.config/notes-along-the-way/operations.md`; no account ID or
dashboard URL is embedded in source or build output. Use `--notes /absolute/path`
for a private note at another location. The launcher requires plain HTTPS PostHog
EU dashboard URLs and opens the operating system's default browser. Sign in there
if needed. It does not query the reporting API, refresh chart data itself, or
require a personal API key. Update the private links when dashboards are replaced;
see [the note format and recovery procedure](private-operations.md#analytics-launcher).

## Setup and deployment

The local `.env` contains the public project token and EU ingestion host. It is
ignored by Git. Use `.env.example` for a new checkout.

| Build variable | Value |
| --- | --- |
| `PUBLIC_POSTHOG_PROJECT_TOKEN` | Project token beginning `phc_`; public ingestion identifier |
| `PUBLIC_POSTHOG_HOST` | `https://eu.i.posthog.com` |
| `PUBLIC_ANALYTICS_ENABLED` | `true` to enable the consent-controlled integration; otherwise disabled |

Set these in the **production branch's Amplify environment**, then rebuild.
Never put a personal API key, access token or private reporting credential in a
`PUBLIC_` variable, Git, or the static build. The integration runs only on the
configured canonical origin; branch previews are excluded. Local development can
exercise it with `PUBLIC_ANALYTICS_ENABLED=true npm run dev`. Intercept provider
requests during automated tests to avoid polluting the real dashboard.

Account administration: keep the EU project region, retention settings and
processor agreement aligned with `/privacy/` as the setup changes.
The technical controls below do not by themselves certify legal compliance.
Future activation checks should use clearly labelled test visits, confirmation
in the live dashboard, and removal/exclusion of that test data.

The SDK is installed through the lockfile. Its transitive `core-js@3.50.0`
postinstall is explicitly disabled in `allowScripts`; the rest of the repository's
strict script policy stays intact. The wizard's dependency conflict is resolved.
Its local cache and downloaded reference copies are excluded from Git.

## Visitor controls

- No PostHog SDK initialization, external request or analytics cookie before opt-in.
- Equal **Accept analytics** and **Reject analytics** controls; refusal leaves the
  website usable. The footer's **Privacy settings** reopens the choice.
- A versioned preference in local storage expires after 180 days. The PostHog
  browser-identifier cookie also has a 180-day expiry, renewed through use.
- Withdrawal stops capture, clears the analytics identifier and reloads the page
  to dispose of active SDK work. Re-acceptance resumes with a new identifier.
  The local October fix also handles clearing local storage in another tab.
- Session replay, broad autocapture, exception capture, performance capture,
  surveys, feature flags and remote extension loading are disabled.
- External viewers remain independently activated by their Load viewer controls;
  analytics consent does not authorize those providers.

The SDK also uses session storage for tab/session bookkeeping after consent.
The bundled SDK is loaded on demand. The consent layer and event-property boundary
are independent of PostHog, so another adapter can replace it.

## Implemented measurements

| Event | Meaning | Additional fields |
| --- | --- | --- |
| `$pageview` | Consented page visit | None |
| `collection_reading_started` | Start reading link clicked | Collection ID/type |
| `collection_navigation_used` | Previous, next or contents link clicked | Direction, collection ID |
| `edition_artifact_opened` | Book artifact link clicked | Edition ID |
| `article_engagement` | 30, 60 or 180 seconds of visible, recently active article time | Time bucket and prose depth rounded down to 25%; local October fix spans all chapter prose sections |
| `code_copied` | Clipboard write succeeded | None |
| `embed_opened` | External viewer activation clicked | None |
| `simulator_started` | Simulation run clicked | Experiment ID |

Events include the canonical page path, standalone content ID when available,
referring domain, necessary pseudonymous/session IDs and broad browser/device
properties. A closed property list drops arbitrary SDK metadata, query strings,
fragments, referrer paths, inputs, code text, prompts and profile updates. The
public project token is retained because ingestion requires it. The local October
boundary also drops top-level SDK fields except the event name, properties, UUID
and timestamp, so top-level profile updates cannot bypass the property allowlist.
Person profiles
and cross-site identification are not enabled.

Time and depth are attention estimates, not proof of reading. Simulator starts and
artifact clicks do not establish successful completion. Collection/book handlers
match the current page markup, but their current end-to-end production reporting
still needs verification against real consented actions and the signed-in charts.

### Further reporting work

Use the collected events to build source-to-engagement comparisons, collection
progression and consenting-browser 7/30-day return cohorts. Add approved campaign
labels, complete collection/chapter context, supported video progress and sanitized
module failures when those reports have concrete uses. Current event filtering
intentionally excludes campaign query values and error contents.

Treat every metric as approximate. Consent, blockers, bot filtering and different
browsers affect coverage. Display sample sizes and use longer windows at low
traffic. Session replay, targeted heatmaps, reader surveys and experiments remain
separate future choices. Do not infer sensitive traits.

Keep short-link requests, website visits and DEV/Medium views separate. Redirect
requests include bots and previews; the website cannot measure reading inside
third-party publications or arbitrary embedded documents. Do not add tracking
pixels to exported articles.

## Data access, cost and portability

Start with the private dashboard. PostHog offers a free
[hosted MCP](https://posthog.com/docs/model-context-protocol), and a connector was
found in the Codex catalogue. Neither is installed. Its tools can write as well as
read, so verify restricted reporting permissions during connection. A reporting
skill can standardize definitions and comparisons; none has been created yet.
Reports queried by Codex are shared with the connected AI provider.

The verified [free plan](https://posthog.com/pricing) includes one million analytics
events/month, one project, one year of retention and community support. No payment
card is required; reaching the allowance stops collection. Separate products and
export/storage services have separate allowances or costs. Recheck these at
activation; commercial backing does not imply a free-plan uptime guarantee.

[Batch exports](https://posthog.com/docs/cdp/batch-exports) support historical
backfills and destinations including S3 and Postgres. Downloadable
[Parquet/JSONLines exports](https://posthog.com/docs/cdp/file-download-exports)
limit event/person/session requests to one-week intervals. They have not been
tested against this account. Before relying on an exit strategy:

1. Select private storage: a local disk/Pi or a separately costed storage service.
2. Export a small interval and reproduce a daily count outside PostHog, deduplicating
   event UUIDs. Preserve stable content IDs, permitted identity/session mappings
   and report definitions.
3. Export before source retention expires when longer history is needed. Apply
   retention/deletion policies to copies too.

Events are portable; dashboards and visitor/session definitions need rebuilding.
A replacement provider may not import historical events, even though the files
remain independently queryable. Never store analytics records in Git or the public
`danilop.link` bucket.

## Privacy basis and alternatives

Use the conservative worldwide opt-in policy for persistent visitor measurement.
Cookie-free operation is not automatically exempt: device access and personal-data
processing have separate obligations. UK statistical-purpose exceptions and
national EU audience-measurement exemptions apply only to qualifying configurations.
See [ICO consent guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/how-do-we-manage-consent-in-practice/),
[ICO exceptions](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/),
[CNIL audience measurement](https://www.cnil.fr/fr/cookies-solutions-pour-les-outils-de-mesure-daudience),
and [PostHog privacy controls](https://posthog.com/docs/privacy).

PostHog was selected for free managed hosting, commercial backing and official MCP.
Alternatives reviewed: Cloudflare for basic traffic/performance (no custom events),
GoatCounter for community-hosted aggregate analytics, Umami Hobby for a free
100,000-event dashboard (API/MCP require paid Pro), and GA4/Mixpanel for broader
commercial analytics. Managed Matomo and Plausible do not meet the ongoing free
hosting preference. A Pi remains an optional export destination rather than the
primary analytics server.

The ordinary `npx -y @posthog/wizard@latest` was used. Its `self-driving` command
also connects GitHub and configures background agents; that was not run. Future
wizard changes must be reviewed against this document before deployment.
