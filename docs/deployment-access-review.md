# Publication access change for approval

The website deployment through existing Amplify access is already authorized.
Automatic review additionally requires explicit approval for these new persistent
access changes. The setup is in `scripts/provision-links.mjs`; the resolver source is
`infrastructure/shortlinks.js` and has local request/redirect tests.

## Exact resources and access

- AWS account: `600966831890`.
- Existing CloudFront distribution: `E3FXM6R13U242B`, serving `danilop.link`.
- Add one KeyValueStore and one viewer-request function named
  `danilop-notes-links`; retain the S3 origin and existing distribution settings.
- The function redirects managed aliases only to `https://www.danilop.net/` URLs.
  Unknown paths return 404 without exposing S3 publication records. No article alias is
  activated until its exact site deployment and destination return successfully.
- Create IAM role `danilop-notes-publication`, trusted only by GitHub Actions in
  `danilop/danilop-personal-page`, branch `main`, using the existing GitHub OIDC
  identity provider with audience `sts.amazonaws.com`.
- Grant that role `amplify:ListJobs` for app `d26ru7a9pi36wa`, branch `main`;
  KVS describe/list/update only for the new store's exact ARN; and S3 get/put/delete
  only in `danilop-link/publication/shortlinks/*` and
  `danilop-link/publication/distribution/*`.
- Add GitHub repository variable `PUBLICATION_ROLE_ARN` containing the role ARN.
  This is an identifier, not a secret. No static AWS key is created.

## Effect and rollback

The main-branch publication workflow can change this site's short-link mappings
and delivery ledger. A compromised authorized workflow would gain those limited
abilities. It cannot change unrelated buckets, distributions, or IAM permissions.

Save the previous distribution configuration before attachment. Rollback removes
only the new function association using a fresh distribution ETag. Disable the
workflow/remove its role trust to revoke automatic access. Existing aliases and
snapshots are retained for recovery; do not delete them during rollback.
