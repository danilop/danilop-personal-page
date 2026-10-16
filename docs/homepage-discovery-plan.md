# Homepage discovery: books and standalone articles

Status: implemented and locally tested, 16 October 2026. Deployment is confirmed
by the release workflow and exact live revision marker.

## Requirements

The latest published article must be immediately identifiable, whether it belongs
to Chronicles of Computation, Good Enough, or neither book. Both published books
must remain discoverable as standalone articles and book instalments accumulate.
Book publication batches must not displace standalone articles. Do not repeat the
lead article as another card or describe an older chapter as the latest instalment.
Preview drafts must remain separate from published discovery.

## Implemented composition

1. **Latest**: the newest eligible published piece, with its title, summary, date,
   reading time and a direct reading link. Label independent pieces **Article**;
   for book pieces show **From [book title]**, linking to the book overview, plus
   the available chapter/section context. Order by publication date, with a stable
   identity tie-breaker. Editing a piece does not change its publication position.
   An editorial feature must not replace this latest-publication position.
2. **Books**: one compact overview per published book, in a stable editorial order.
   Each has the book title, a short description, a contents link and its latest
   published instalment link/date. When that instalment is the lead, replace the
   repeated title/summary with **Latest instalment featured above**, linking to the
   lead heading. Keep the book overview visible; do not promote its previous
   instalment to “latest”. Do not show another Collections & Books section for
   these same books farther down the homepage.
3. **More articles**: the newest pieces without membership in a published
   book, excluding the lead by stable piece identity. Show three initially, then
   offer **Show more articles** in batches of six. Use brief summaries and dates,
   without large repeated artwork. Keep **All writing** visible beside the heading.

On desktop, use a wider lead column and a narrower Books column so the latest
article and both books are visible near the top. Avoid a tall hero image that
pushes the books or article list down. On narrow screens use natural document
order: lead, compact book entries, standalone articles. No carousel, nested scroll
area, sticky book rail or automatic content insertion. Exact spacing and image
limits require visual validation at desktop and mobile widths and browser zoom.

With both books available, the initial layout has six content blocks: one lead,
two book overviews and three standalone articles. These are different roles,
not six chronological article slots. This layout replaces the earlier shared
slot budget; it also keeps a lead book's overview visible, refining the earlier
suggestion to exclude that book entirely. Fewer available items means fewer
blocks, with no duplicated pieces or placeholder cards. Do not show a load-more
control when there is nothing left to load.

Public labels are **Article**, **More articles** on the homepage, and **Articles**
in Writing filters. Book membership uses **From [book title]**. “Standalone” is
an internal description, not a public label. Existing `/writing/independent/`
URLs and internal identifiers stay stable.

## Publication cases

| Newest publication | Lead | Chronicles entry | Good Enough entry | Standalone articles |
| --- | --- | --- | --- | --- |
| Standalone article | That article | Latest published instalment | Latest published instalment | Next three standalone articles |
| Chronicles instalment | That instalment, with book context | Latest instalment featured above; contents link | Latest published instalment | Newest three standalone articles |
| Good Enough instalment | That instalment, with book context | Latest published instalment | Latest instalment featured above; contents link | Newest three standalone articles |

The same piece can be reused in more than one book. Deduplicate by piece identity:
if it is the latest instalment of both books and the lead, both book entries refer
to the lead. The lead exposes both memberships without repeating the article.
Membership in a draft-only book must not reclassify a public standalone article.
Books with no readable published content do not appear publicly. Draft-only preview
libraries keep their content in Drafts in preview, without inventing a public lead.

## Browsing older content

Recommend explicit **Show more articles**, not automatic infinite scrolling. Keep
the already loaded articles on screen. Provide a visible result count and preserve
loaded batches, filter and scroll position when returning from an article.
Loading needs a clear pending state, an accessible result announcement and a retry
on failure. Keyboard navigation must reach the newly inserted items naturally,
without jumping back to the beginning or skipping them.

The complete **All writing** index remains chronological and includes every
published piece once. Offer linked filters for **All writing**, **Articles**, **Chronicles of Computation** and **Good Enough**, generated from public
books rather than hard-coded names. Use the same loading component. Book overview
pages retain their reading-order contents; publication order is a discovery view,
not a replacement for book order.

Use real, addressable paginated documents underneath the enhanced Show more
interaction, with Previous/Next fallback links when JavaScript is unavailable.
Filter/page state must survive refresh, browser Back/Forward and copied links.
The homepage's Show more control extends only More articles, not the lead
or Books area; All writing is the explicit route to older book instalments.
Do not deliver the entire future catalogue merely to hide most rows in the browser.

There is no established universal user preference among pagination, automatic
scrolling and explicit loading. Nielsen Norman Group describes the trade-offs,
including refinding content and footer access, and identifies Load More as a
compromise. Baymard's research supports restoring list position after visiting an
item, but its ecommerce context is not direct evidence about this site's readers.
These findings inform a recommendation, not a claim of reader-tested superiority.

- [NN/g: Infinite Scrolling: When to Use It, When to Avoid It](https://www.nngroup.com/articles/infinite-scrolling-tips/)
- [Baymard: Return Users to the Same Place in the Product List](https://baymard.com/research-articles/return-same-place)

## Implementation and verification plan

1. Separate latest-piece selection, stable book summaries and standalone article
   selection in the core view model. Replace the homepage lead override in this
   layout and define the new initial-count/batch configuration in authoring docs.
2. Reuse book summaries, article lists and loading controls across home and Writing;
   implement static pagination with progressive enhancement and state restoration.
3. Keep the current typography and visual language. Verify all three publication
   cases with realistic titles, summaries and artwork on desktop and mobile before
   settling dimensions. Confirm compact book entries remain legible at 200% zoom.
4. Test duplicate identities, multiple book memberships, draft exclusion, equal
   publication dates, publication batches, zero/one/many articles, one/two books,
   exhausted pages, filter changes, reloads and browser Back/Forward. Test keyboard
   and screen-reader feedback, JavaScript-disabled navigation and loading failure.
5. Update README, product design, authoring configuration, preview, navigation and
   verification documentation with the implemented contract. Run repository checks
   and release verification when deployment is requested. Implementation does not change content publication flags.

## Implementation contract

`core/homepage.ts` selects the latest article and stable book summaries;
`core/discovery.ts` creates bounded pages and public filters. `WritingEntries`,
`BookSummaries` and `WritingPager` provide shared rendering. The runtime fetches
only the next static HTML page, validates its build revision and filter identity,
and never combines lists from different deployments.

Routes are `/page/2/` for older home-page standalone articles,
`/writing/page/2/`, `/writing/independent/`, and `/writing/books/<book-id>/`
with `/page/2/` suffixes for filtered continuation. Only existing pages are built.
Enhanced URLs add `?from=1` (or the directly opened starting page) so reload and
copied links reconstruct the same loaded range. Back/Forward reloads the matching
static route, reconstructs earlier batches, and restores saved scroll position.
Storage is browser history state, not a full catalogue downloaded in advance.
Failures preserve current articles and expose ordinary fallback links.

The latest article may still carry an explicit new-in announcement, but `lead`
can no longer override it. `independentCount` and `pageSize` replace `recentCount`
for layout purposes; legacy configuration is accepted for compatibility.
