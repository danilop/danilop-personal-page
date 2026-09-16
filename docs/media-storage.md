# Media storage

Status: implemented and provisioned. S3 stores reviewed media; CloudFront serves
it over HTTPS using a custom subdomain, an existing wildcard certificate and
Route 53 A/AAAA aliases. Account-specific identifiers are in the private
operations note and `~/.config/notes-along-the-way/media.json`, outside Git.

## Configuration

- **Public URL and cache duration:** `publishing/media.json`. `MEDIA_BASE_URL`
  can override the URL for a build or upload invocation.
- **Bucket and AWS resources:** private `media.json`: `bucket`, `region`,
  `accountId`, `distributionId`, `stackName`, `certificateArn`, `hostedZoneId`.
  Set `NOTES_MEDIA_CONFIG` to use another private file. Uploads also accept
  `MEDIA_BUCKET`, `MEDIA_REGION` and `MEDIA_DISTRIBUTION_ID` overrides.
- **Infrastructure:** `infrastructure/media.yaml`. `npm run media:provision`
  prepares a CloudFormation change set; add `-- --apply` to execute changes and
  refresh the private distribution ID. Uses existing AWS CLI credentials and
  verifies the account. The certificate must be in `us-east-1` and cover the
  configured hostname. The public base URL must have no path for this stack.

Changing the base URL updates `media:` references at the next site build/export;
absolute URLs already posted elsewhere require a manual update there. Changing a
bucket setting does not migrate existing objects. Provisioning retains replaced
or removed buckets to preserve their data. Update private operational notes after
resource changes. No private file is needed to build the public website.

## Upload and use

Keep Markdown, captions, alt text, code, Mermaid/D2 sources and small CSV datasets
in Git. Use media storage for photographs, illustrations and PDFs. Small stable
theme assets can stay in Git. Existing files need not be migrated immediately.

Prepare and preview the selected file locally, then preview its upload:

```sh
npm run media -- upload /path/to/figure.png --alt "Explanation of the figure"
```

Repeat with `--apply` to upload. PNG, JPEG, WebP, AVIF, GIF, SVG and PDF are
supported. The command preserves supplied bytes, checks image readability and the PDF signature,
and returns the URL, SHA-256, dimensions when applicable, and Markdown. It does
not optimize images or remove metadata: export appropriate sizes and review
metadata before uploading. This is an owner-operated publishing tool, not a
service for untrusted visitor uploads.

Default keys include the file hash. References stay short and portable:

```markdown
![Explanation](media:images/FILE_HASH.png)

[Download the paper](media:documents/FILE_HASH.pdf)
```

Replace `FILE_HASH` with the value returned by the command. PDF blocks can use
`source: {format: pdf, url: 'media:documents/FILE_HASH.pdf'}`; title, summary and
book alternatives follow the existing authoring format. Ordinary links, direct
and reference-style Markdown images, PDF viewers and external article export
resolve `media:` against the configured public URL.

Uploads use temporary/default AWS credentials, verify the bucket owner and write
only beneath `published/`. The public CDN maps that prefix to its root. By
default, an existing key causes an error rather than an overwrite. The printed
hash is available for an author's asset record; a managed remote-asset manifest
and checksum-pinned book download workflow are not implemented yet.

## Correct a published file

Prefer a new hash-based reference for an editorial change. To deliberately repair
a stable URL, specify its key and `--replace`; S3 retains the prior version and
the tool requests a CloudFront invalidation when a distribution ID is configured:

```sh
npm run media -- upload /path/to/fixed.pdf --key documents/guide.pdf --replace --apply
npm run media -- invalidate documents/guide.pdf --apply
```

Invalidations are asynchronous; their ID is printed. Check completion in
CloudFront. Without invalidation, the CDN cache is capped at **300 seconds** by
default. Browsers revalidate (`max-age=0`); 403/404 errors cache for 10 seconds.
Changing `cacheSeconds` requires applying the infrastructure configuration too.
Third-party platforms may keep independent copies/caches beyond our control.

The personal site's observed HTML header uses browser revalidation with a long
shared cache, which Amplify invalidates on deployment. Media shares browser
revalidation, HTTPS and the site's security headers, but deliberately caps edge
caching at five minutes so corrections also propagate without a website deploy.

## Access and retention

S3 public access is blocked, ACLs are disabled, and encryption/versioning are
enabled. Signed CloudFront origin access is limited to `published/*`; drafts and
originals elsewhere in the bucket are not served. Published files are public
through the CDN. GET/HEAD, PDF ranges and public cross-origin reads are supported;
the CDN accepts no upload/write methods. Origin traffic requires TLS.

Lifecycle cleanup only aborts incomplete uploads after seven days. Published
assets and old versions do not expire automatically. Keep files referenced by
posts, syndicated copies or frozen editions. Versioning is not an independent
backup. No AWS credentials or private inventory belong in Git.

## Limits and verification

Rich image blocks still use local `source.path`; use ordinary Markdown for
externally stored images. Remote images are retained as external HTTPS URLs in
cross-posting; target-platform display must be reviewed. Book export deliberately
rejects remote image freezing without an explicit local/versioned alternative.
Responsive variants, metadata stripping and a managed remote-media manifest remain
future work. The upload command reports successful S3 storage; verify the public
URL before publishing the article, especially immediately after infrastructure changes.

Validation covers portable references/path restrictions, full website checks,
real PNG/PDF delivery, TLS, headers, PDF byte ranges, CORS, origin access denial,
versioned replacement and CDN invalidation. Verification samples are operational
fixtures, not published articles.

[AWS origin access](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html),
[cache TTL behavior](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-cloudfront-cachepolicy-cachepolicyconfig.html).
