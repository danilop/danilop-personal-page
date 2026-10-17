# Newsletter distribution

Status: research saved; provider selection and implementation deferred by the
owner on 17 October 2026, to revisit in a future discussion.
No provider has been selected; subscription forms, newsletter authoring and
delivery are not implemented, tested or deployed.

## Resume here

Preserve all considered options: Resend, Sender, Buttondown, Brevo, MailerLite,
Substack, and the Beehiiv API limitation. The sections below retain free limits,
paid prices, source links, API constraints and email-format trade-offs as a dated
research snapshot. Recommendations remain proposals, not selected requirements.

When the owner returns to this topic:

1. Refresh pricing, API access and plan entitlements; do not treat the October
   2026 figures as current quotes. Resolve MailerLite's conflicting plan names.
2. Decide whether manual sending in Substack is acceptable or integration with
   the local authoring tools is a priority.
3. Choose one general newsletter or explicit book/topic preferences, and estimate
   audience size and sending frequency to compare real costs.
4. Select the provider and default format: full article, useful summary with a
   link, or title-only notifications. Then define the implementation scope.

There is no scheduled follow-up or automatic implementation commitment.

## Requested capability

Offer optional newsletter distribution when an article is published. Readers
should be able to subscribe from the homepage, individual article pages and book
pages. Provider selection, subscription scope and email format remain decisions
for the owner; the recommendations below are not accepted implementation choices.

## Proposed reader experience

Use a quiet inline subscription form on the homepage and at the end of articles,
plus a visible form on each book's overview page. Explain what will arrive and
how often; avoid interrupting reading with a popup. Start with one publication
audience. Consider an explicit book-only preference for readers following a
particular book, rather than silently subscribing them to every article.

Use confirmation by email, clear unsubscribe and preference controls, and an
exportable subscriber list. Keep consent records and suppression state private;
never include subscriber addresses in the public repository or analytics events.
The subscription notice and privacy documentation must describe the selected
provider and actual data handling before launch.

## Proposed editorial workflow

Keep publication and distribution independent, as in the existing
[content model](content-model.md#content-structure-and-publication-are-independent).
Prepare an editable email draft from saved article metadata and its canonical
link. Preview the subject, body, audience and recipient count, then send a test
message through an explicit action. Sending to subscribers is a separate action
after verifying the corresponding article and its media are live.

Routine saves, commits, website builds, redeployments and corrections must not
send or resend newsletters. Record a stable issue identity, provider campaign ID,
content snapshot and delivery state privately. Reconcile uncertain API outcomes
before retrying, so a network timeout does not create a duplicate campaign.
An email failure should not undo website publication.

Several pieces released together can be announced in one email. Book updates
should identify the new reading material and link to its place in the book;
release grouping must not change article identities or book order.

## Proposed email content

Default to a useful 150–300-word introduction or summary, with one clear link to
read the article. Explain the question and offer a substantive takeaway, rather
than withholding everything behind a teaser. The website offers the complete
reading experience, including interactive examples, diagrams, narration and book
navigation. A short personal introduction can make the email worth reading itself.

Allow full text for shorter, mostly prose articles when reading in the inbox is
the editorial priority. Include a canonical link near the beginning. Email copies
are snapshots: subsequent website corrections cannot change delivered prose.
Complex figures, code and media need email-compatible alternatives and a preview.

Title-only emails are suitable for a reader-selected notification mode or a
multi-item digest, but offer little standalone value as the default newsletter.
For books, prefer a short explanation of what has been added, chapter links and
an optional excerpt over automatically emailing every chapter in full.

## Provider research

Official public documentation checked on 17 October 2026. These are published
plan capabilities, not verified account entitlements or delivery tests. Recheck
pricing and feature access before implementation; free does not include any
separate hosting or domain cost incurred by a custom integration.

| Provider | Published free allowance | API suitability and trade-offs |
| --- | --- | --- |
| Resend | 1,000 contacts; unlimited marketing broadcasts | Contacts and broadcast creation/sending APIs fit a custom authoring integration. Signup and confirmation flows need implementation or a compatible integration. Broadcast quotas are separate from transactional email limits. |
| Sender | 2,500 subscribers; 15,000 emails/month; no daily email cap | API available on Free; custom HTML/plain-text campaign creation and sending, plus forms and segmentation. Free campaigns/forms carry Sender branding. |
| Buttondown | First 100 subscribers; pricing assumes at most one whole-list email daily | API available on Free, including scheduling; Markdown suits this site's sources. Segmentation costs extra on Free but is included in the paid plan shown by the live calculator. |
| Brevo | 300 email sends/day; storage for up to 100,000 contacts | Campaign creation and sending APIs. The daily cap is restrictive for publication-day delivery; remaining campaign recipients require requeueing. |
| MailerLite | 250 active subscribers; 2,500 emails/month | Current pricing FAQ explicitly excludes API/MCP sending on Free. Paid Comfort and Power advertise full API access; campaign API documentation still refers to Advanced for supplying HTML, so confirm that specific entitlement before integration. |

Sources:

- Resend: [marketing allowance](https://resend.com/products/marketing-emails),
  [pricing and quota distinctions](https://resend.com/pricing),
  [create broadcast](https://resend.com/docs/api-reference/broadcasts/create-broadcast),
  [send broadcast](https://resend.com/docs/api-reference/broadcasts/send-broadcast).
- Sender: [pricing](https://www.sender.net/pricing/),
  [free features](https://www.sender.net/pricing/free-plan/),
  [create campaign](https://api.sender.net/campaigns/create-campaign/),
  [send campaign](https://api.sender.net/campaigns/send/).
- Buttondown: [pricing](https://buttondown.com/pricing),
  [API availability](https://buttondown.com/features/api),
  [scheduling](https://docs.buttondown.com/scheduling-emails-via-the-api).
- Brevo: [plans](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans),
  [free limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan),
  [create campaign](https://developers.brevo.com/reference/create-email-campaign),
  [send campaign](https://developers.brevo.com/reference/send-email-campaign-now).
- MailerLite: [June 2026 free-plan change](https://www.mailerlite.com/help/free-plan-update-faq),
  [current plans and API FAQ](https://www.mailerlite.com/pricing),
  [campaign API restrictions](https://developers.mailerlite.com/api/campaigns).

Beehiiv is less suitable for the requested free API workflow: its
[create-post API](https://developers.beehiiv.com/api-reference/posts/create)
currently requires Pro or Enterprise. General API access must not be mistaken
for permission to create and send newsletter content.

Recommendation, pending selection: Resend for integration with the local
publishing tools; Sender if maximising the free subscriber allowance and using
ready-made forms matter more; Buttondown for a small, writing-focused list.

### Paid costs checked on 17 October 2026

USD per month with monthly billing, before applicable tax, excluding introductory
discounts and optional extras. Sender, Buttondown and MailerLite figures were
checked in their live pricing calculators linked above.

| Provider | Observed paid prices | Cost considerations |
| --- | --- | --- |
| Resend marketing | $40 for 5,000 contacts; $80 for 10,000; $180 for 25,000 | Unlimited broadcasts; no annual discount. These are marketing prices, not the separate transactional plan. See the [official contact-price table](https://resend.com/migrate/mailchimp#pricing). |
| Sender Standard | $9 for 500 subscribers; $15 for 1,000; $55 for 7,500; $69 for 10,000 | Includes 12 times the plan's subscriber allowance in monthly email sends and removes branding. Free remains usable up to its own limits; paying is not required at 500 or 1,000. Advertised annual promotion is 30% off for first-time users. |
| Buttondown | $9 at 1,000 subscribers; $29 at 5,000; $79 at 10,000 | Paid calculator includes segmentation and analytics. Annual base prices at these sizes are $90, $290 and $790. Separate newsletters, custom archive hosting and other higher-tier features remain add-ons. |
| Brevo | Starter from $9; Standard from $18 | Both entry tiers allow 5,000 monthly sends and only 500 stored contacts. Higher tiers increase both limits; do not apply the $9 price to a large list. Removing Starter branding adds $9/month; Standard includes it. |
| MailerLite | Comfort: $12 at 500 subscribers, $19 at 1,000, $49 at 5,000, $89 at 10,000. Power: $25, $39, $69 and $129 respectively | Comfort has a sending allowance; Power has unlimited monthly emails. Annual billing is advertised at 10% off. Both paid plans advertise full API/MCP access, subject to the documentation discrepancy noted above. |

For cost modelling, four newsletters to 5,000 recipients require 20,000 sends
per month before confirmation or other messages. Full article versus summary
does not change the recipient/send count. Paid pricing makes Buttondown a
stronger contender for a writing-focused newsletter than its small free tier
alone suggests; selection remains open.

### Substack as a manually operated alternative

Added to the comparison on 17 October 2026. Substack's
[current pricing policy](https://support.substack.com/hc/en-us/articles/360037607131-How-much-does-Substack-cost)
says free publishing has no subscriber-count charge; paid subscriptions incur
a 10% revenue share plus Stripe fees. Its
[embedded signup form](https://support.substack.com/hc/en-us/articles/360041759232-Can-I-embed-a-signup-form-for-my-Substack-publication)
can appear on this website. [Sections](https://faq.substack.com/p/how-to-use-sections-on-substack)
allow readers to opt into distinct newsletters, potentially useful for book updates.
[Subscriber export](https://support.substack.com/hc/en-us/articles/6314498343700-How-do-I-export-my-email-list-on-Substack)
provides a migration path; its network also offers discovery and recommendations.

No supported public create-and-send API was verified. The published
[API scope](https://substack.com/api-tos) describes public profile/publication data;
the [official MCP integration](https://support.substack.com/hc/en-us/articles/50834026608916-How-to-connect-Substack-to-your-AI-Assistant)
is read-only and restricted to eligible Bestseller publications. Do not treat
either as a newsletter sending integration.

Substack deserves consideration if an explicit manual publishing step is
acceptable: keep full articles on the website, prepare an introduction and link,
then review and send it in Substack. This trades closer integration with the local
editor for no subscriber-based delivery bill and access to Substack's network.
No provider or workflow has been selected.

## Implementation considerations, not current functionality

Keep provider credentials in a secret store and API calls that require secrets
in a server-side subscription endpoint or the private authoring process. The
public static site must never receive an API key. A provider-hosted form can
reduce the initial backend work where available. Configure sender-domain
authentication and verify the selected provider's account requirements.

Before launch, test confirmed subscriptions, audience preferences, unsubscribe
and bounce suppression, campaign previews, live-link checks and duplicate-send
protection. Check email rendering on mobile and desktop. Decide whether to use
email tracking explicitly, in line with the site's privacy approach.
Store account-specific setup and campaign references in the
[private operations note](private-operations.md), not public documentation.
Update the publishing workflow and privacy/operations guides alongside the
eventual implementation.
