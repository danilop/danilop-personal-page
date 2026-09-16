# Historical generator and metadata maintenance

Status: implemented. Last checked against the checkout on 2026-09-15.

This guide preserves the Node.js link-directory workflow and importer details.
Use [rebuild operations](operations.md) for the new website and deployment.
Return to the [repository README](../README.md).

A simple script to populate a web page with links, retrieving link info using the Open Graph protocol (https://ogp.me).

I am using https://getbootstrap.com for the grid system.

I built it for my personal page: https://danilop.net

1. Put static assets in the `static` folder.

2. Put HTML templates with `<!-- processLinks {JSON file} {thumbnail width} {title width} [max links] -->` where you want to embed links in the `src` folder. The thumbnail and title width are using the https://getbootstrap.com grid system and should add to 12. You can optionally add a maimum number of links to process from the source list.

3. The JSON file should be in the `data` folder and contain a single JSON array of links.

4. Run `npm run build:legacy` to create the `public` folder. I use [AWS Amplify Console](https://aws.amazon.com/amplify/console/) to automate deployment.

5. Link titles, descriptions, and thumbnails come from saved publisher metadata
   or an Open Graph lookup, with optional manual corrections applied last.

## Updating posts

Use Node.js 22 or later, then run:

```sh
npm ci
npm run sync:posts
npm test
npm run build:legacy
```

`sync:posts` follows every page of the AWS News, Database, and Developer author
archives and the public DEV article API for `danilop`, including posts published
under DEV organizations. It verifies authorship, merges new URLs with existing
ones, removes exact duplicates, and sorts by publication date (newest first).
Existing links missing from a source are retained. Links without a known date
remain at the end in their original order.

Sources are configured in `data/post-sources.json`. Its `awsAdditionalPosts`
list covers verified coauthored articles omitted from the author archives.
Add newly discovered coauthored articles there; the importer checks their
bylines. The importer finishes all sources before writing any data and leaves
manual corrections untouched. Review and commit the changed JSON files, then
push to `main` to deploy. Content discovery is an explicit update step, separate
from deployment, so a build does not unexpectedly change the curated list.

## Correcting titles, descriptions, and images

Metadata precedence, from lowest to highest:

1. Raw Open Graph metadata in the local/Amplify `cache/` directory (fetched when
   no usable title is available).
2. Versioned publisher metadata in `data/link-metadata.json`, refreshed by
   `sync:posts` for AWS and DEV. It also contains the existing YouTube metadata
   so builds do not depend on YouTube allowing requests from AWS.
3. Manual, per-field corrections in `data/link-overrides.json`, keyed by the
   exact URL in the content list.

For example:

```json
{
  "https://youtu.be/efk8XFJrW2c": {
    "title": "Building observable applications with OpenTelemetry",
    "subtitle": "AWS re:Invent 2022 · BOA310",
    "description": "A demo-focused introduction to instrumenting applications with OpenTelemetry."
  }
}
```

Corrections use the fields `title`, `description`, `subtitle`, `url`, `imageUrl`,
and `publishedAt`. Omitted fields retain their imported or cached values; `null`
clears optional fields such as the thumbnail or subtitle. Titles and destination
URLs must remain valid. Corrections are applied after title formatting on every
build and are never written into the raw cache. Removing a correction restores
the underlying source value without clearing the cache. The current templates
display titles, thumbnails, and subtitles; descriptions remain available to the
renderer for future layouts.

For an Open Graph-only link, delete its SHA-256-named file in `cache/` to refetch
source metadata. This does not remove manual corrections. To change imported
AWS/DEV metadata, rerun `sync:posts` or add a manual correction.

## Deployment

The current rebuild uses Astro output in `dist/` through the existing Amplify app
in `eu-west-1`; its ID is in the private operations note. The legacy command writes `public/` solely for
maintenance/snapshot comparison. See [rebuild operations](operations.md) for
automatic main-branch deployment and exact revision checks.
