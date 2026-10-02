# Reader sharing

Status: implemented, tested and deployed on 2 October 2026. Live desktop/mobile
checks confirmed both controls, the active short URL, focus return, mobile fit and
a clean console; the short URL's crawler/social-card check passed. This feature
hands off links; it never generates social copy with an assistant or posts on the
reader's behalf.

## Experience

Published articles have **Share ↗** beside their date and reading time, beneath
the summary and before the opening image/prose. **Share this article** appears
after topic tags and before collection exploration/back navigation. Both open the
same compact native dialog. Collection reading pages use the same component,
sharing that specific reading URL without changing their existing canonical
metadata. Draft pieces and reading pages inside draft collections have no sharing
controls. The home page and article listings do not gain platform buttons.

The panel provides Copy link, Email, X, LinkedIn, Bluesky and, where supported,
**Share on your device**. It shows the exact URL all actions will use. Clipboard
failure selects the link for manual copying. Device cancellation is normal; other
device failures leave copying available. Escape/Close returns focus to the opening
button. With JavaScript disabled, a native disclosure exposes the full article
link and Email. No platform SDK, tracking counter or sharing request runs merely
because someone reads the article.

## Link selection and configuration

`publishing/site.yaml` optionally declares `shortLinkOrigin`: an HTTPS origin
without credentials, path, query or fragment. Deployment settings supply the full
production URL even in local preview. The shared component selects the first
alphabetically sorted active registry code with that exact destination. No alias
is allocated or activated by a build or reader click.

Opening the panel makes one credential-free request to
`<short-url>?__link_status=1`. An exact `{target: <full-article-url>}` match confirms
the short link. Requests cannot follow redirects and time out after four seconds.
Actions wait during this check. Missing aliases, wrong destinations, malformed
responses, timeouts, network/CORS failures and unconfigured origins all use an
explicit **Copy full link** fallback, with all handoff links updated to that same
visible URL. Opening the panel again checks afresh; closing cancels the request.
The status contract exposes only public destinations; see
[short-link design](short-link-design.md).

## Handoffs and verification

`runtime/share-links.ts` encodes title/URL into ordinary platform intent links and
an Email `mailto:` draft. LinkedIn receives only the URL. Bluesky bounds the title
to its 300-grapheme compose limit while retaining the link. The native device share
API runs on a subsequent user click, preserving transient activation. Platform
login, preview rendering and final posting remain under the reader's control.

`test/article-sharing.test.ts` exercises encoding, exact target confirmation,
clipboard success/failure, native handoff arguments, both placements, one dialog,
focus return, mobile overflow and no-JavaScript fallback against a built fixture.
The author-server integration checks draft exclusion; publishing tests check status
privacy/CORS/HEAD and normal redirects. Release checks also retain existing
Open Graph/crawler assertions. A real logged-in social post and native OS chooser
are not automated acceptance claims.

After deployment, verify the deployed revision, open both controls on desktop and
mobile, check the status query with an Origin header, and run
`npm run verify:social -- <full-or-short-url>`. Operator resource identifiers and
live runtime evidence belong in the private operations note.

References: [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share),
[X share button](https://help.x.com/en/using-x/add-x-share-button),
[LinkedIn Share Plugin](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/plugins/share-plugin),
[Bluesky intent links](https://bsky.network/docs/intent-links/).
