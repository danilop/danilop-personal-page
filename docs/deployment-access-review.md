# Short-link access change scope

Status: the user selected private S3 REST with OAC on 2 October 2026. This replaces
the earlier KVS/new-GitHub-role proposal. The replacement setup and Free-plan subscription are active; the disposable
live test passed and its objects were removed. No CI role was created. See the
[selected design](short-link-design.md) for the complete behaviour and validation.

## Resource and permission boundaries

- Use the existing short-link distribution and bucket. Recover operator IDs from
  the private operations note and confirm the signed-in AWS identity.
- Create/attach an OAC and a dedicated viewer-response CloudFront Function.
  Store destinations on S3 objects, without KeyValueStore or Lambda@Edge.
- Keep the bucket private. Grant the CloudFront service principal GetObject only
  under `redirects/*`, conditioned on the designated distribution ARN. Keep
  publication records and recovery data outside the CloudFront-readable prefix.
- Local editor actions use the operator's existing AWS session. Scope publishing
  access to the required redirect/ledger prefixes and targeted invalidations.
  Do not introduce static keys or a new GitHub role for local editor operations.
- Future automated reconciliation requires separately scoped CI access and the
  existing exact-deployment gate; the old KVS role/provisioning script is obsolete.
- Free flat-rate pricing is active with an associated WAF web ACL and migrated
  managed-cache settings. Access logging is disabled; original settings are backed
  up privately. Do not describe the plan as an AWS-account-wide bill cap.

## Recovery and test

Back up the current distribution and bucket configuration before changes. Check
object ownership/ACL dependencies and preserve unrelated objects. Rollback must
use fresh configuration revisions and restore the saved settings; retain owned
aliases and their recovery history. The live test must create a uniquely owned
fake alias, check redirect/update/cache behaviour and direct-origin privacy,
then remove its object and temporary records and verify cache invalidation.

The previous automatic approval rejection concerned the earlier KVS/IAM proposal.
It does not establish a rejection of this replacement design. Report any new
approval result against the actual proposed action.
