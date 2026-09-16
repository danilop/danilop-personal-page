# Analytics and visitor privacy

Status: discussion proposal, 2026-09-16. No provider selected, account created,
analytics script installed, or consent system implemented by this proposal.

## Product goals proposed for discussion

Understand readership: article/collection popularity, trends, referring domains,
and aggregate counts of book downloads or experiment launches. Treat visits and
unique-reader estimates as approximate; bot filtering, blockers and consent affect
coverage. Do not introduce advertising profiles, session recordings, prompt/input
collection, or cross-site identity matching.

Keep three measurements separate: requests to a short link, visits to the canonical
article, and views reported by DEV/Medium. Redirect requests include bots and link
previews. The website tracker cannot measure reading on another platform. Do not
add tracking pixels to exported articles.

## Provider choices

- **GoatCounter — recommended starting point:** open source; hosted service is free
  for reasonable public usage, including personal sites. Hosted storage is in
  Finland/Germany. Keep optional individual-pageview storage disabled. Its default
  aggregates still involve transient IP/User-Agent processing for deduplication;
  do not describe it as processing no personal information at all.
  [Offering](https://www.goatcounter.com/),
  [data handling](https://www.goatcounter.com/help/privacy).
- **Umami:** MIT-licensed, self-hostable, with a free hosted Hobby plan aimed at
  personal/low-traffic sites. A stronger candidate if richer event reporting is
  wanted. Confirm the current event allowance, retention and hosting region at
  selection; this review did not verify numeric free-plan limits. Page hits and
  custom event data count toward usage.
  [Source](https://github.com/umami-software/umami),
  [hosted FAQ](https://docs.umami.is/docs/cloud/faq).
- **Plausible:** free, open-source Community Edition to self-host; managed hosting
  is paid. A paid alternative if dashboard/reporting preferences justify it.
  [Community Edition](https://plausible.io/self-hosted-web-analytics),
  [hosted plans](https://plausible.io/#pricing).
- **Matomo:** free open-source core for self-hosting, with documented configuration
  for the French audience-measurement exemption. More operational/configuration
  work than this site's initial readership questions warrant.
  [On-premise](https://matomo.org/matomo-on-premise/),
  [configuration](https://matomo.org/faq/how-to/how-do-i-configure-matomo-without-tracking-consent-for-french-visitors-cnil-exemption/).

Free software does not make hosting, backups, updates or maintenance free. No
actual traffic baseline has been measured here; hosted free eligibility is a fit
assessment, not a measured capacity guarantee.

## Consent and privacy policy

Cookie absence is not an automatic exemption: ePrivacy also covers other device
storage/access technologies, including fingerprinting. Personal-data processing
has separate GDPR obligations. A vendor's compliance claim does not settle the
site's obligations across jurisdictions.
[EDPB final technical guidance](https://www.edpb.europa.eu/system/files/documents/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf).

Current UK guidance permits a narrow statistical-purpose exception for improving
the service. It requires clear information and a simple free means of objection;
individual tracking/profiling and retaining individual information beyond the
aggregation need do not fit that exception.
[ICO exceptions](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/).

EU national requirements vary. France permits certain strictly configured audience
measurement producing anonymous statistics for the publisher, without cross-site
tracking or reuse for other purposes. That is not an EU-wide product approval.
[CNIL guidance](https://www.cnil.fr/fr/cookies-solutions-pour-les-outils-de-mesure-daudience).

Proposed implementation policy, pending a decision:

1. Use one conservative worldwide baseline rather than relying on IP geolocation
   as the sole legal switch. Keep optional analytics off until consent unless the
   exact deployment is assessed as outside consent scope or validly exempt under
   applicable rules. A banner-free setup remains a goal, not a verified property.
2. Publish a plain-language privacy page describing fields, purposes, provider,
   retention, transfers and controls. Provide a persistent Privacy settings link.
   Where personal data is processed, establish the applicable lawful basis and
   processor/transfer arrangements separately from the cookie assessment.
3. For opt-in processing, block requests before consent, offer equally easy accept
   and reject, separate analytics from external media, and make withdrawal easy.
   Store only the preference needed to respect the choice. An open-source consent
   library can implement controls; it does not certify legal compliance.
   [ICO consent practice](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/how-do-we-manage-consent-in-practice/),
   [MIT CookieConsent library](https://cookieconsent.orestbida.com/).
4. Keep Google/video viewers behind informed per-provider activation with a normal
   external link alternative. The existing Load viewer button is a technical
   starting point, not proof of valid consent. Public document permissions do not
   establish permission for visitor tracking. Review actual network/storage behavior.
5. Implement analytics as a replaceable adapter independent of the consent gate.
   Strip arbitrary query strings, fragments and sensitive referrer details. Send
   allowlisted event names/IDs only; exclude previews and development. Define
   retention and test refusal/withdrawal before production use.

Server/CDN log aggregation is another option for basic request totals without
adding a browser tracker. It still needs a privacy assessment, IP minimization,
retention controls and a cost check; request counts are not exact human readership.

## Decision still needed

Confirm whether simple readership counts are sufficient (GoatCounter recommendation)
or richer event analysis is desired (Umami candidate), then choose managed versus
self-hosted operation and assess the precise consent configuration before enabling it.
