# Analytics and visitor privacy

## Status — 16 September 2026

PostHog Cloud EU integration is implemented. The owner created the account and
authorized wizard v2.74.1. The wizard created the
[dashboard](https://eu.posthog.com/project/276112/dashboard/956457) and a
[setup notebook](https://eu.posthog.com/project/276112/notebooks/APzk5HLL).
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

Validation: all 45 tests, type checking and the production build pass. Local
desktop and mobile browser checks cover acceptance, refusal, withdrawal,
re-acceptance, engagement events and removal of sensitive URL values. No provider
requests occur before consent; withdrawal removes the analytics cookie. The same consent
flow passed on the live site at desktop (1280 × 900) and mobile (390 × 844)
sizes, with no console errors or warnings. The EU ingestion endpoint returned
HTTP 200 with `{"status":"Ok"}` for labelled test traffic on `/privacy/`.
Dashboard query results have not been verified. Exclude the test identity
`notes-deployment-check-096ef19` from visitor reports; no automatic deletion or
report filter has been configured.

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
- Session replay, broad autocapture, exception capture, performance capture,
  surveys, feature flags and remote extension loading are disabled.
- External viewers remain independently activated by their Load viewer controls;
  analytics consent does not authorize those providers.

The bundled SDK is loaded on demand. The consent layer and event-property boundary
are independent of PostHog, so another adapter can replace it.

## Implemented measurements

| Event | Meaning | Additional fields |
| --- | --- | --- |
| `$pageview` | Consented page visit | None |
| `collection_reading_started` | Start reading link clicked | Collection ID/type |
| `collection_navigation_used` | Previous, next or contents link clicked | Direction, collection ID |
| `edition_artifact_opened` | Book artifact link clicked | Edition ID |
| `article_engagement` | 30, 60 or 180 seconds of visible, recently active article time | Time bucket and article-body depth rounded down to 25% |
| `code_copied` | Clipboard write succeeded | None |
| `embed_opened` | External viewer activation clicked | None |
| `simulator_started` | Simulation run clicked | Experiment ID |

Events include the canonical page path, standalone content ID when available,
referring domain, necessary pseudonymous/session IDs and broad browser/device
properties. A closed property list drops arbitrary SDK metadata, query strings,
fragments, referrer paths, inputs, code text, prompts and profile updates. The
public project token is retained because ingestion requires it. Person profiles
and cross-site identification are not enabled.

Time and depth are attention estimates, not proof of reading. Simulator starts and
artifact clicks do not establish successful completion. The welcome post is the
only published new article; collection/book handlers require real published
content before end-to-end production reporting can be verified.

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
