# Private S3 short links

Status: implemented locally; the S3/OAC resolver, DNS and CloudFront Free plan are
active as of 2 October 2026. Live GET/HEAD, update freshness, invalidation, origin
privacy and disposable-test cleanup passed. Article aliases remain unactivated
until their saved registry is committed and its site deployment verified. Local
editor controls require restarting the preview server after this code change.
No website source changes were committed or pushed in this task.

## Behaviour

A short URL returns a real HTTP 302 to its saved HTTPS canonical destination,
with equivalent GET and HEAD results. Root requests redirect to the website.
Unknown aliases return 404. Aliases remain owned by their original content
identity; unpublish disables them and deletion retains an ownership tombstone.
Shared codes must never be reassigned to unrelated content.

The local editor can reserve codes, inspect live GET/HEAD results, disable aliases
locally and publish saved redirects explicitly. Destinations derive from content
identity; editing a title does not reassign a code.
A saved draft does not activate a cloud redirect. Publication must verify that the
canonical destination is deployed and publicly reachable before activation.
Automated reconciliation must retain the existing exact-deployment gate.

## Selected architecture

Use an S3 REST origin with Origin Access Control (OAC), signed requests and a
private bucket. OAC is preferred to legacy OAI and is supported by CloudFront's
Free flat-rate plan; OAI is not supported by flat-rate plans. Keep account-specific
resource identifiers, backups and test records in the private operations note.

Each alias is a small JSON object under `redirects/<code>` with
`WebsiteRedirectLocation` containing the validated canonical URL. An `index`
object and CloudFront DefaultRootObject can handle the root without a second
function. The REST API exposes this metadata as
`x-amz-website-redirect-location`; it does **not** perform the HTTP redirect.
S3 website hosting stays disabled. The JSON body records the destination and owner,
so destination changes produce different ETags for conditional writes; the Function
removes the body from the public response. Both `<code>` and `<code>/` objects
serve equivalent redirects. The system root and error objects have empty bodies.

Associate one viewer-response CloudFront Function. It validates the metadata
against the configured canonical HTTPS origin, changes a successful object
response into a 302 with `Location`, removes the internal metadata header, and
returns an empty body. No KeyValueStore or Lambda@Edge is needed. Destination
validation rejects credentials, control characters and off-origin targets;
viewer-supplied query strings cannot choose a destination.

Static response-header policies and custom error responses cannot perform this
per-object status/header conversion. CloudFront Functions support changing a
viewer-response status code. They are not invoked for origin errors of 400 or
above, so unknown-object handling must also be configured and tested in the
distribution; a private S3 origin can return 403 for a missing key.

Set the origin path to `/redirects`. Scope the bucket's CloudFront service grant
to the selected distribution ARN and `redirects/*` only. Keep ownership records,
locks and snapshots in a separate private prefix without a CloudFront read grant.
Check existing object ownership/ACL dependencies before changing bucket settings.
Block public bucket access; operator publishing permissions remain separately
scoped. Do not add a GitHub IAM role merely to support local editor actions.

## Freshness and recovery

Target an effective edge TTL of 60 seconds for managed objects. Write explicit
`Cache-Control: public, max-age=0, s-maxage=60` on every redirect object, and have
the response function send a browser cache lifetime of zero. Viewer-response
header changes do not change the cached origin object's lifetime.

The Free plan lacks custom cache policies. A managed caching policy that honours
origin Cache-Control supplies the short TTL without a custom policy. The selected
managed
`CachingOptimizedForUncompressedObjects` policy was accepted by the Free plan,
and the live test confirmed that changed destinations appear after 60 seconds.
The policy's one-day fallback is not the intended object TTL; publication always
writes the required Cache-Control header and repairs a managed object whose header
is missing. Use short error caching and targeted invalidations on update/delete;
the active configuration maps private-origin missing-key 403 to 404 with a
five-second error TTL. The Function preserves CloudFront read-only Via/Warning
headers and the provisioner checks the function in AWS’s runtime before publishing.

S3 writes/deletes must be conditional on ownership and object revision. Preserve
rollback snapshots and refuse to overwrite pre-existing, unowned objects. Updating
a destination replaces that alias's object, rather than deploying function code.

Before activation, back up the existing distribution and bucket configuration.
Test a uniquely owned disposable alias: GET/HEAD redirect parity, canonical
metadata after following it, cache-hit behaviour, destination update freshness,
unknown-path behaviour and denied direct anonymous S3 access. Delete the test
object and temporary records, invalidate its cached path, and verify its removal.
Verify custom-domain DNS/TLS separately from the CloudFront default hostname.
The disposable live test passed and both its redirect object and private test
record were deleted. The cached path was invalidated and returned 404 afterwards.
Only the intended system root/error objects remain; no article aliases were activated.

## Pricing recommendation

AWS pricing checked on 2 October 2026 (USD, before applicable tax):

| Flat-rate tier          | Monthly price per distribution | Requests/month | Transfer/month |
| ----------------------- | -----------------------------: | -------------: | -------------: |
| Free                    |                             $0 |      1 million |         100 GB |
| Pro                     |                            $15 |     10 million |          50 TB |
| Business                |                           $200 |    125 million |          50 TB |
| Premium, base allowance |                         $1,000 |    500 million |          50 TB |

OAC and CloudFront Functions are included in Free. KeyValueStore requires Pro or
above, another reason to keep destinations on S3. Free lacks custom cache policies
and access logging. Subscription requires an associated WAF web ACL and migration
away from legacy ForwardedValues/cache settings. Review existing logging before
making a change; do not silently drop operational visibility. Eligibility also
depends on account status and recent usage.

The Free plan is active for the short-link distribution, its dedicated WAF web
ACL and the matching Route 53 zone. Legacy caching settings were migrated and
access logging was disabled; the previous configuration is retained privately.
The WAF ACL allows ordinary traffic and rate-limits an IP above 2,000 requests
per five-minute evaluation window. No included-service overages are charged, even above the
allowance, but substantial sustained excess can lead to adjusted delivery
performance. This is not an unlimited performance guarantee.

On pay-as-you-go, the account-wide monthly allowance includes 2 million Function
invocations, 10 million HTTP(S) requests and 1 TB transfer. Function invocations
above their allowance cost $0.10/million: 3 million total invocations cost $0.10
and 10 million cost $0.80 if the full 2-million allowance is available. A
viewer-response function executes on cache hits too; bots and HEAD probes count.
For small traffic, function charges will usually be zero on either pricing model.

The flat-rate plan bounds covered CloudFront costs, not the entire AWS bill.
S3 request charges remain separate; its storage credit covers Standard storage,
not requests. Amplify hosting/builds, domain registration and excluded logging
features remain separate. Route 53 zone charges are covered only when the eligible
zone is attached to the plan. Applying a plan to the short-link distribution does
not move the Amplify website into that plan. There is no reason here to select a
paid tier solely to pay for the redirect function.

## Local configuration and commands

The private configuration is `~/.config/notes-along-the-way/links.json`, or the
file selected by `NOTES_LINKS_CONFIG`. It uses `schemaVersion: 2`,
`resolver: s3-oac`, `bucket`, `distributionId`, `region`, `shortOrigin`,
`canonicalOrigin`, and optional `amplifyAppId`. Infrastructure setup additionally
uses `accountId` and optional `hostedZoneId`. Generated OAC, Function, WAF and
subscription identifiers stay in that file. Credentials remain in the AWS
credential/session provider, never the configuration file.

```sh
node scripts/provision-links.mjs                      # Show the plan only
node scripts/provision-links.mjs --apply --free-plan # Setup and FREE enrolment
npm run publish:links                              # Preview desired aliases
npm run publish:links -- --apply --wait              # Publish after deployment
```

The provisioner never selects a paid pricing tier and retains the original
configuration in a private `short-links-before.json` backup. Repeated provisioning
checks existing resource identities instead of creating duplicates. The public
DNS alias was configured separately during activation; check DNS/TLS as part of
recovery. Do not run the provisioner to publish individual alias changes.

In the editor, open **Short links**, reserve a code, commit/push the saved content
and registry, wait for Amplify deployment, then select **Publish saved redirects**
and **Check live links**. Publishing reconciles the complete saved registry,
including withdrawals. An alias reservation can be made for a draft, but it
remains inactive. A primary identity code cannot be removed while the article
still declares it; use **Unpublish to draft** to withdraw that article's aliases.
Disabling an additional alias records a permanent local tombstone; commit/deploy
and publish redirects to withdraw it remotely. Uncommitted content or publishing
settings block live publication through both the editor and local CLI.

Conditional S3 writes, a create-only lock, durable ownership and recovery snapshots
protect publication. If a process crashes, inspect the private lock's revision
and creation time, confirm no publisher is running, then remove that lock to retry.
Never delete ownership history to clear a conflict. Rollback restores only aliases
whose content remains currently eligible and does not retarget fixed editions.

Optional CI publication requires `PUBLICATION_ROLE_ARN` and `SHORTLINK_CONFIG`
repository variables. The workflow writes the latter to a private temporary runner
file and sets `NOTES_LINKS_CONFIG`; no account inventory is committed. A scoped CI
role was not created or activated in this task. Manual editor/CLI publication uses
the operator's existing AWS session and does not require a new role.

## Sources

- [OAC and private S3 origins](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [S3 redirect metadata and REST behaviour](https://docs.aws.amazon.com/AmazonS3/latest/userguide/how-to-page-redirect.html)
- [CloudFront Functions response structure](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html)
- [Managed cache policies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-cache-policies.html)
- [Flat-rate pricing](https://aws.amazon.com/cloudfront/pricing/)
- [Plan features, restrictions and covered costs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html)
- [Pay-as-you-go pricing and allowances](https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/)
