# Credentials and external publishing

Researched against official provider documentation on 2026-09-15.
This is setup guidance and a security recommendation, not a claim that accounts
or protections have been connected. No credentials were read or changed.

## What to set up now

Only DEV needs a new publishing credential for the next integration step.
Store it in your password manager and, for future automated delivery, in the
protected GitHub environment described below. Do not paste it into chat, commit
it, put it in an issue, or add it to the Amplify website build.

| Service | Credential for this project | Recommended location |
| --- | --- | --- |
| DEV | Dedicated user API key, exposed to the delivery process as `DEV_API_KEY` | Password manager; GitHub environment `dev-publication` when configured |
| Medium | None | Use your normal signed-in browser for import and edits |
| Leanpub | `LEANPUB_API_KEY`, only when a real book needs the API | Password manager; inject into a local publication process when needed |
| Google Docs / Slides | None for published embeds | Store only the public published URL in article metadata |
| iCloud Photos | None for public shared albums | Store only the public album URL |
| Public PDF / audio / video | None for public reading | A deliberately public HTTPS resource URL |
| AWS blog catalogue | None for existing public article discovery | Public source URLs and metadata; no corporate publishing credentials |
| AWS site / short links | Temporary AWS credentials through GitHub OIDC | IAM role; no static AWS access key in GitHub |
| In-browser models | None for the configured public model | Versioned model manifest; no hosted inference account |

## DEV: create and store a dedicated key

DEV supports Markdown article creation and updates, with canonical URLs and
draft publication state. API V1 uses an `api-key` header. The documentation does
not describe selectable article-only scopes or per-article key restrictions;
treat this as an account credential, not a key limited to this website's posts.
[Forem authentication](https://developers.forem.com/api),
[article API](https://developers.forem.com/api/v1).

1. Sign in as the intended author (`danilop`) and open
   [DEV Settings → Extensions](https://dev.to/settings/extensions).
2. Generate a dedicated API key named `Notes Along the Way publication`.
   Keep unrelated integrations on their own keys so this key can be revoked
   independently. Confirm any scope/expiry controls actually offered by the UI;
   do not assume capabilities that the documentation does not promise.
3. Save it in your password manager under that name.
4. Open [this repository's Environments settings](https://github.com/danilop/danilop-personal-page/settings/environments).
   Create an environment named **`dev-publication`**.
5. Under deployment branches and tags, choose selected branches/tags and add
   a **branch** rule matching **`main`** exactly. Do not add a tag rule or `*`.
6. For the first connection, use a required reviewer if available. A sole operator
   must be able to approve their own initiated runs, or appoint another reviewer.
   Once tested, routine updates can run without per-run review if desired;
   keep the main-only environment restriction.
7. Under **Environment secrets**, add **`DEV_API_KEY`** and paste the key there.
   Do not add a same-named repository secret, Actions variable, or Amplify variable.

GitHub environment protections apply before jobs receive their environment
secrets. Availability depends on repository visibility and plan. This repository
was verified public, with `main` as its default branch and no environments
configured at the time of this review.
[GitHub environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

**Storing the key will not start publishing.** The current workflow does not
reference this environment. Its existing repository-secret wiring must be
replaced before automated delivery is enabled; do not work around that by adding
a repository-wide key. No article is currently enrolled for cross-posting.

Before delivery, verify the authenticated username using `GET /api/users/me`,
prepare the destination preview, then test one explicitly selected article as a
draft. Record its ID and verify that the next update changes that same draft.
Keep the canonical URL pointing at the original website article. Account checks,
article enrolment and draft defaults reduce mistakes; they do not restrict a
stolen API key at the provider.

## Medium: use the supported editor workflow

Medium says it no longer issues integration tokens or accepts new integrations.
Existing tokens may still work, but its API documentation labels the API
unsupported. We will use import for initial creation and the editor for later
changes, retaining the same story URL. No Medium token, password, session cookie,
or browser profile should enter the publishing workflow.
[Medium policy](https://help.medium.com/hc/en-us/articles/213480228-API-Importing),
[API status](https://github.com/Medium/medium-api-docs),
[import guide](https://help.medium.com/hc/en-us/articles/214550207-Importing-a-post-to-Medium).

## Leanpub: defer the credential until a book exists

Leanpub currently requires Pro for API access and describes the key as granting
full access to your books. Its API covers preview/publication and sensitive
account data, including reader and sales information. No per-book restriction
is documented. Generate a key only when needed at
[Leanpub API key settings](https://leanpub.com/user_dashboard/api_key), and keep
it in your password manager. Supply it as `LEANPUB_API_KEY` only to a trusted local
publishing process; the website and routine DEV workflow do not need it.
[Leanpub API](https://leanpub.com/help/api).

The current adapter supports an existing book's preview, job status and publication.
It sends POST credentials in the request body; the documented status GET uses a
query parameter. It rejects redirects and avoids printing request URLs or private
result URLs. Do not enable HTTP debug logging. Keep generated receipts and secret
download links private; they are not public book download URLs.

Use the dashboard for publication if you want to avoid an API credential entirely.
If automation becomes useful, give it a separate `leanpub-publication` environment
with its own approval policy. Do not combine its secret with DEV or a general AI
assistant. Source synchronization is a separate integration: choose the exact
book repository or upload path and inspect the permissions before connecting it.

## Public embeds: share content, not accounts

For Google Docs/Slides, use your intended publishing account and **File → Share
→ Publish to web → Embed**. Keep editor access private; publishing creates a
separate read-only view. Test the published URL while signed out. Changes can
propagate automatically; Docs can disable automatic republishing, Slides cannot.
Use **Stop publishing** to withdraw the public version—changing collaborator
sharing alone does not do that. Workspace policies may prevent public publishing.
[Google publishing and embedding](https://support.google.com/docs/answer/183965?hl=en).

For iCloud Photos, create a curated Shared Album, turn on **Public Website**, and
copy its public link. Anyone with that URL can view it. The plugin links to that
album and needs no Apple account credentials or app-specific password.
[Apple Shared Albums](https://support.apple.com/en-gb/108314).

For PDFs and other media, provide a deliberately public HTTPS URL that works while
signed out. Do not embed expiring authenticated links. Third-party viewers load
only after reader activation. Public viewing does not prevent copying; publish
only material intended for that audience. Frozen book editions should use an
intentional exported snapshot rather than a changing online document.

## Automation changes required before enabling delivery

The following are recommendations awaiting implementation and configuration:

- Separate DEV delivery from short-link deployment, with a fresh runner and a
  `dev-publication` environment. Restrict both push and manual execution to main.
- Scope the DEV delivery role to its ledger prefix and only the deployment checks
  it needs. Keep short-link write access out of that role.
- Match the new role to the environment's actual OIDC subject and restrict main
  in GitHub. An environment changes the subject claim: simply adding
  `environment:` to today's main-ref role would break authentication. Keep this
  separate from the still-pending original short-link access proposal.
- Pin workflow actions to verified full commit IDs; disable persisted checkout
  credentials. Review dependency/script execution in any job that receives a key.
- Reject redirects on DEV authenticated requests and verify the authenticated
  account before a create, rather than checking ownership only after creation.
- Keep provider keys on the delivery step only. Do not include them in builds,
  browser code, caches, generated files, or uploaded diagnostic artifacts.
- Protect changes to main, workflows and publishing code. Enable available secret
  scanning/push protection. Review artifact contents and keep retention short.

GitHub supports temporary AWS access via OIDC, avoiding stored AWS keys; its
security guidance recommends minimal permissions, immutable action pins and
secret review/rotation. These are recommendations, not verified live settings.
[AWS OIDC](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws),
[workflow security](https://docs.github.com/en/actions/reference/security/secure-use).

## Local use, rotation and recovery

- A password manager is the persistent local store. Inject a selected key into
  only the command that needs it. Do not paste a literal key into terminal commands
  that remain in shell history, or into a shell startup file. A Git-ignored `.env`
  file is still plaintext; the publication scripts do not automatically load it.
- Maintain nonsecret records of the key label, owner, purpose, creation date and
  last validation. Enable the strongest sign-in protection each provider offers.
- Review keys periodically. For replacement, validate the new key read-only,
  update the one secret location, then revoke the previous key. If exposure is
  suspected, revoke immediately and inspect publishing history and logs.
- Pausing a workflow or deleting a GitHub secret does not revoke a provider key.
  Revoke it at the provider. Preserve remote article IDs and the delivery ledger
  so reconnecting does not create duplicate articles.
- This repository is public: `draft`, `book-only` and hidden sections control
  generated pages, not GitHub visibility. Keep confidential manuscripts in a
  private source repository; do not commit them here expecting those flags to
  protect them.

See [operations](operations.md) for commands and
[deployment access review](deployment-access-review.md) for the separate pending
short-link infrastructure authorization. This research did not create accounts,
environments, roles, credentials, or external posts.
