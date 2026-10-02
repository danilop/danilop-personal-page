# Assets and website releases

Status: proposed, not implemented. This records the requested move towards
off-repository editorial media and a release gate that coordinates assets with
GitHub-triggered Amplify deployments. The existing upload command and local image
cleanup remain separate implemented capabilities. No migration or cloud writes
have been performed for this proposal.

## Current behaviour

| Asset | Source storage | Public delivery |
| --- | --- | --- |
| Generated/imported candidates | Ignored `.authoring-state/images/` | Local authoring only |
| Inserted article illustrations | `content/pieces/<id>/assets/`; eligible for Git commits | Referenced files become hashed `/media/` files in the Amplify build |
| Explicit collection/book covers | `content/collections/assets/`; eligible for Git commits | A hashed WebP rendition in the Amplify build |
| Explicit `media:` references | Manual upload to the configured S3 bucket, under `published/` | The configured CloudFront media domain |
| Fonts, icons and other theme resources | Versioned source files | Amplify build |

`core/assets.ts` writes local renditions into `.generated/public/media`, Astro
copies its public directory into `dist/`, and `amplify.yml` publishes `dist/`.
Saving or publishing an article locally does not upload its images to S3. The
separate media command does not yet integrate with image insertion, covers or a
commit-based asset inventory. See [current storage operations](media-storage.md).

## Required behaviour

- Keep content, alt text, captions, cover selection and a small asset manifest
  versioned in Git. Keep managed editorial image/PDF bytes out of new Git commits.
  Editable diagrams, code, small datasets and stable theme assets can remain in Git.
- Draft authoring and Save work locally without a public upload. Candidate
  cleanup remains automatic and protects saved versions and unsaved recovery.
- A commit identifies the exact asset bytes it requires. Preview, website builds,
  content import and frozen book exports resolve that same identity.
- Website outputs use only reviewed public renditions. Access to a private original
  during a build is not permission to copy it into public output; preserve the
  existing publication-target boundary when resolving assets.
- Upload and verify required assets before pushing a release. Reject dirty or
  changed source state; fail the deployment build when required assets are missing
  or have different checksums. Keep the existing GitHub/Amplify deployment path.
- Collect abandoned remote uploads automatically using deployment and edition
  inventories, without breaking live pages, rollbacks or externally shared URLs.

## Recommended storage and implementation stages

Use a tracked manifest, proposed as `publishing/media-assets.json`, with an entry
for each managed logical source path. Record the SHA-256, byte size, media type,
dimensions when relevant, storage key and reviewed renditions. Renditions have
their own checksums; the original checksum does not identify a transformed WebP.
Record transformation settings and tool versions; regenerated renditions must
match the committed checksum before use in a release.
Alt text and captions remain contextual content rather than a global asset label.

Use an ignored, checksum-addressed local cache and a common asset resolver. Resolve
existing logical article and cover paths through the manifest; authors should not
have to rewrite content to change storage providers. Resolve ordinary local assets
as before. Do not ignore every file in `assets/`, since some are editable sources.
Do not silently adopt or overwrite manually maintained files.

Store reviewed originals under a private S3 prefix outside `published/`; store
public renditions under `published/`. Keep descriptive names with the full content
checksum, preserving the current image naming approach. The configured CloudFront
origin can only serve `published/*`. Bucket identifiers, account settings and
credentials remain outside this public repository.

1. **First stage:** hydrate the assets required by a release into a temporary build
   workspace/cache, verify their checksums and retain today's rendering. Amplify
   still serves the website's `/media/` files. This removes managed binary growth
   from Git without changing reader URLs or breaking local covers and book exports.
2. **Second stage:** resolve web renditions directly to the existing CloudFront
   media domain. Keep checksum-verified originals available to local preview and
   book export. This avoids shipping those editorial renditions in every Amplify
   artifact. Rich image blocks, cover rendering and distribution adapters must use
   the resolver before this stage is enabled.

Both stages require asset availability checks. The first stage also needs scoped,
read-only S3 access in Amplify and trusted CI, configured before migration. Use
temporary role credentials; never place an operator's private configuration or
write credentials in a build. Public renditions can be verified through the CDN
without AWS credentials. Reuse valid caches, but verify bytes against the manifest.

Include [social preview cards](social-previews.md) in the public rendition and
deployment dependency set. Current card validators expect the website origin;
the second stage must also allow the explicitly configured media origin, without
accepting arbitrary image hosts or weakening checksum/image-delivery checks.

Frozen book exports must package verified bytes and record their identities in
the edition inventory. A live URL is not sufficient for a reproducible edition.
The current rejection of remote book-image freezing stays in place until that
verified resolver is implemented.

## Release gate

Preparation and publishing are separate operations. Preparation can change the
manifest and create reviewed renditions; commit those changes before release.
The release operation must not modify tracked content after its clean-state check.

1. Require the intended branch and upstream, and a clean repository, including
   non-ignored untracked files. Ignored authoring/cache state is permitted. Capture
   the commit SHA and read content/configuration/manifest from that committed tree.
2. Resolve the complete asset dependency set for the production publication target,
   including collection covers and shared dependencies. Do not upload every cached
   image or unpublished draft. Book/distribution releases select their own targets.
3. Verify prepared local files against committed checksums; retrieve existing
   matching remote objects when local bytes are absent. Fail with named missing
   assets rather than substituting another version.
4. Upload missing immutable objects using create-only conditional writes. For an
   existing key, verify its stored checksum/bytes and skip a matching upload. Fail
   on mismatches. Do not overwrite objects or use `sync --delete` for a release.
5. Verify S3 availability/integrity and public CDN delivery for web dependencies,
   allowing a bounded retry for newly uploaded URLs in the CDN's error cache.
6. Recheck that HEAD and the source state are unchanged, then push the exact
   validated commit without a force push. A failed push leaves collectible uploads,
   while the live website continues using its previous assets.
7. Amplify verifies and resolves the dependency set for its own checked-out commit
   before building/deploying. A normal Git push must not bypass this build gate.
   Record successful deployment inventories and retain them for remote cleanup.

Local pre-push integration can make this convenient; it is not the deployment
guarantee because hooks can be skipped. The build gate provides that guarantee.
There is no atomic transaction spanning S3, GitHub and Amplify. Immutable objects
and uploading before deploying references make partial failures recoverable.

The current uploader already uses conditional writes, but treats an existing key
as an error; it needs manifest-aware, idempotent verification for this workflow.
Use an actual SHA-256 checksum, not an assumption that an S3 ETag is a file hash.
See [S3 conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html),
[S3 integrity checks](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html)
and [Amplify build phases](https://docs.aws.amazon.com/amplify/latest/userguide/yml-specification-syntax.html).

## Cleanup, retention and migration

Local candidate/source cleanup and remote published-asset cleanup have different
roots. Never mirror local deletions into `published/`. A replaced local image may
still be required by the live deployment, a rollback or a frozen edition.

The remote collector must protect the current verified deployment, retained
rollback deployments, retained editions, explicit external-distribution pins and
pending releases during a grace period. Record candidate release inventories before
uploads, so failed/abandoned releases have a defined owner and expiry. Store these
operational records privately. A successful build alone does not mark a release
live: record the confirmed deployment revision. Handle an object still being used
by another release as shared, not abandoned.

Run remote collection after confirmed deployments and on a scheduled sweep, so
abandoned uploads expire even when no subsequent release occurs. Preview startup
must not be the only trigger for cleaning cloud storage.

Choose and document rollback retention and the remote grace period before enabling
deletion. Use mark, grace, recheck and recoverable deletion; retry interrupted
collection. Account for S3 noncurrent versions and expired inventory/cache records,
not just visible objects. Existing public URLs with unknown external consumers
remain pinned until explicitly retired. Local seven-day candidate and thirty-day
trash policies are not remote publication policies.

Before migration, inventory existing assets, prove that a fresh clone can hydrate
and build, exercise local preview/covers/import/book export, and test missing,
corrupt and already-uploaded objects, dirty state, a changed HEAD, failed pushes,
failed deployments and rollback. Keep legacy/snapshot assets and URLs supported.
Remove managed source binaries from Git's latest tree only once they are safely
stored and resolvable. This does not remove binary history from older commits;
history rewriting is outside this proposal.
