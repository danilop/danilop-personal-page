# Content discovery: tags and search

Status: tagging accepted and implemented locally on 2026-09-20; search changes
remain proposals. Tagging has not been deployed. See [tag authoring and review](tagging.md)
for the registry, internal inventory, and commands.

## Reader-facing choices

Tags should connect material a reader would reasonably want to explore together.
Use a small, consistent vocabulary that can grow, without requiring every topic
mentioned in an article to become a tag. Book roles, reading order, and release
groups remain separate metadata. See the [content model](content-model.md).

For the Chronicles opening, the implemented tag assignments are:

| Piece | Assigned tags |
| --- | --- |
| Introduction | history, computing, programming, python |
| Before Written Arithmetic | history, computing, python, data-representation |

`counting` is accessible but ambiguous across mathematics, programming, and
analytics; defer it until there is a useful body of related reading.
`data-representation` names a reusable concept spanning tallies, number systems,
text encodings, and images. Its disadvantage is technical wording; display it as
“Data representation” and use plain explanations in the article. Tag by actual
content rather than inheriting every subject of the book. Python applies to both
opening pieces because one explains running examples and the other includes them.

Display tags unobtrusively near the article footer. Only make them links once
working topic destinations exist. Topic pages should offer useful curated reading;
do not automatically generate a public landing page for every one-off phrase.
Three to five tags is an editorial guideline, not a schema limit or SEO rule.

## Internal tag review

The internal inventory is implemented: search, name/usage sorting, distinct-piece
counts split by published/draft/retired status, scope descriptions, aliases, and
piece-level review of new tags and possible naming duplicates. The registry is
extensible; unknown tags remain allowed and are highlighted for review. Suggestions
are advisory and never rewrite source metadata.

Private preview sources are included only when explicitly selected. Collection
subjects, repeated placements, obsolete snapshots, and generated views do not
inflate the default inventory. Publication counts reflect source status rather
than live deployment. See [tagging operations](tagging.md#internal-inventory).

## Current implementation, verified in local source

- Pieces accept a free-form list of tag strings; collections accept subjects.
  The optional vocabulary registry provides labels, scopes, and aliases. Private
  browsing/reuse review and public non-linked topic labels are implemented; public
  topic landing pages remain unimplemented. Chronicles assignments are listed above.
- Production layout emits page titles, descriptions, canonical links, sharing
  metadata, and JSON-LD. Standalone articles use BlogPosting with author name and
  publication/update dates. Other pages use WebPage. Previews emit noindex.
- Collection reading and chapter pages use the collection summary and canonical
  URL. The collection currently includes the full assembled text, so this is a
  full-reading-view preference, not a reference to an empty contents page.
- Sitemap includes standalone articles, collection roots, and published editions;
  it does not enumerate collection reading or chapter routes.
- The separate local Chronicles preview is not the production template. Source
  inspection does not establish current live indexing or Google-selected URLs.

## Proposed CMS work before serial publication

1. Resolve one preferred public URL for each substantive reading unit. A piece
   available only in its book can still be discoverable without joining the
   standalone article feed. If standalone and contextual routes show substantially
   the same piece, select one preferred URL and align links and metadata. Distinct
   chapters should not automatically nominate the collection root as preferred.
2. Keep the collection overview discoverable in its own right. Decide explicitly
   whether a full continuous view is also an independently indexable aggregate or
   a reading utility excluded from search. The latter sacrifices search entry to
   the complete view; it is not a general canonicalization fix. Never nominate the
   first chapter as the canonical for the entire combined book.
3. Carry piece-specific summary, author, and real publication/update dates into
   book reading pages. Generate concise search titles from subject and book
   context, with no manually duplicated weekly numbering. Extend appropriate
   article and breadcrumb structured data from the same visible metadata. Do not
   claim enhanced search presentation is guaranteed.
4. Include selected indexable reading URLs in the sitemap, retain draft exclusion,
   and validate that preferred URLs, internal links, and sitemap entries agree.
The lightweight tag registry and internal review described above are implemented.
Public topic pages are separate future work, justified by useful related reading.

These changes add metadata/mapping maintenance, but can mostly derive from existing
content. Separate SEO fields should be exceptions where needed, rather than a
second title and summary every author must maintain.

## Editorial work for the opening

Preserve the manuscript prose. Keep the subject title “Before Written Arithmetic”
and the separate Chapter 1 / book context. A proposed summary is: “Tally marks,
the Lebombo and Ishango bones, and what simple Python examples reveal about
counting and representing information.” Retain the uncertainty and source notes
in the article; do not market disputed interpretations as established facts.

Use page-specific summaries, descriptive links to the book and adjacent pieces,
and a visible author attribution. Resolve references to an unavailable appendix
or index before release. Add meaningful images only when they help explain the
material. Do not pad short front matter to reach an imagined SEO word count, add
keyword lists to prose, or change publication dates just to suggest freshness.

After publication, use Search Console and URL Inspection to review discovery and
preferred URLs. Account setup/access has not been checked in this task.

## Evidence and limits

Google recommends descriptive, concise [page titles](https://developers.google.com/search/docs/appearance/title-link)
and specific [summaries](https://developers.google.com/search/docs/appearance/snippet),
but can generate different titles/snippets. Its [SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
states that meta keywords are unused, there is no magical word-count target, and
keyword stuffing is inappropriate. Visible topic tags primarily serve navigation.
[Canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
explains consistent preferred-URL signals; Google can choose a different canonical.
[Article guidance](https://developers.google.com/search/docs/appearance/structured-data/article)
covers authors, dates, and multi-part articles. These sources support the general
practices; the route and tag recommendations above are project-specific judgments.
