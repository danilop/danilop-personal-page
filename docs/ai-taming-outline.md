# Outline for an article on the limits of reward-based training

Status: revised and implemented locally on 1 October 2026. The author authorised
researching the alternatives and refocusing the article on RL's limits, then
retuning it for readers who need the mechanisms explained. Stories develop the
thesis; RL, RLHF, Jev's RLCD and options outside RL remain part of the argument. The
[canonical draft](../content/pieces/clever-enough-to-find-the-loophole/index.md)
remains `draft: true`; publication is pending. The
[research note](ai-taming-research.md) records sources and their limits.

## Editorial brief

Write primarily for readers interested in AI who do not already understand its
training and safety problems. Developers and technical decision makers should
also find the causal distinctions and deployment implications useful. Explain
mechanisms before naming methods; introduce only terminology the argument needs.

Use real incidents and experiments to develop the thesis: training can reward
recognisable pieces of useful behaviour without teaching the limits that make
success acceptable. Begin with the observation about benchmark charts and access restrictions,
then Argon's current announcement and the Mythos Preview's earlier unsolicited disclosure,
explain the learning mechanisms, then show why better checks and permission
requests can still fail. Let those questions motivate the alternatives. Return
to the introductory incident and AISI's automated-approval episode at the end.

Keep British English, conversational explanations, exact source links and a few
dry observations. Preserve stories, insight and narrative momentum while reducing
acronyms and method catalogues. Do not replace the stories with an introductory
textbook or imply every incident proves a defect in RL. Detailed taxonomy and
supporting chronology remain in the research note. Aim for roughly 2,600–2,700 words.

Accepted title: **Clever Enough to Find the Loophole**

Accepted subtitle: **When increasingly capable AI agents show an excess of
initiative.** The Astra section remains **Permission to proceed** to avoid
repeating the subtitle.

## Implemented narrative

1. **Opening:** Restore the benchmark-chart/access-restriction observation and
   lead with Argon's 30 September announcement. Use the older Mythos Preview
   incident as supporting precedent: requested escape, unsolicited disclosure,
   the tool/computer distinction and improvements in the final Preview. Ask
   where the system learnt an assignment ends; introduce training incentives.
2. **What exactly are we trying to tame?** Explain agents, capability, alignment
   and control. Distinguish malicious requests, autonomous overreach and hostile
   instructions without requiring a security glossary.
3. **The score has become the job:** Explain RL and RLHF through their mechanisms.
   Use sycophancy and automatic checks to show how scores can miss intentions,
   then name reward hacking and tampering. Keep the proxy experiment's limits.
4. **When cheating becomes a lesson:** Connect Bengio's hypothesis to Hacker-Opus
   and explain how learnt behaviour can persist. Preserve the distinction between
   a controlled training experiment and incidents with several possible causes.
   Explain goal misgeneralisation before naming it.
5. **The trouble with checking the working:** Follow the tempting remedy of
   closer monitoring into the experiment where penalising visible admissions
   taught concealment. Keep contrary evidence and the limits of that finding.
6. **Permission to proceed:** Briefly connect Fable/Mythos safeguards to deployment
   choices, then distinguish released GPT-6 Astra from withheld GPT-6.1 Astra.
   Explain that clearer instructions substantially reduced attacks in a
   failure-prone subset without eliminating them; keep exact counts in the
   research note. Retain disabled filters and simulation limits. The automated-approval anecdote reveals the surrounding software's role.
7. **A rather awkward sort of leaderboard:** Use FelonyBench as satire, not a
   ranking or legal judgement. AISI's actual incident shows why model upgrades
   require revisiting access assumptions. Do not attribute every failure to RL.
8. **Changing what earns the reward:** Let the incidents motivate a different
   lesson: useful uncertainty. Explain Jev's bounded decisions and calibration,
   then name RLCD and distinguish it from RLHF. Both remain RL. Preserve the
   limits of early product evidence and the distinction between probability
   quality and acceptable action.
9. **Learning from examples:** Explain supervised fine-tuning and direct
   preference optimisation as alternatives at particular training stages.
   Avoid extra acronyms. Simpler learning procedures still depend on the
   examples and preferences they teach; these methods can also accompany RL.
10. **Predicting before acting:** Introduce the robot's image goal and predictive
    planning before naming V-JEPA 2. Explain world models and LeCun's relevance
    without claiming general agent safety. A descriptive link to Dreamer demonstrates world models
    within RL without introducing another model name; Scientist AI remains a conditional research proposal.
11. **The owner can remove the brakes:** Keep the GLM-5.3 weight-editing example
    as a distinct limit on safeguard durability. Explain open weights without
    introducing abliteration as another term. Retain engagement versus attack
    success and the source's position as a competitor.
12. **Teaching an agent when to stop:** Draw together the different learning
    mechanisms and external controls. Retain three deployment questions. Return
    to the opening story and mistaken permission: useful behaviours can exceed
    their purpose. The thesis should now be clearer than when first introduced.

## Evidence and terminology decisions

- The following distinctions also guide the detailed research notes; not every
  method or acronym needs to appear in the article.
- RLHF and RLCD are forms of RL, not competitors to RL as a whole. RLVR changes
  the source of reward. RLAIF substitutes AI preference judgements; it is not
  automatically an escape from reward optimisation.
- DPO is a non-RL training procedure for preferences, while sharing an objective
  with conventional RLHF under its assumptions. Do not promise that it eliminates
  proxy errors, sycophancy or overoptimisation.
- Supervised learning learns demonstrations. Predictive learning learns dynamics
  or representations. A planning system can optimise goals without using RL to
  learn that predictor. Avoid claiming that all optimisation is RL.
- Calibration concerns probability quality across cases, not guaranteed accuracy
  or safety of each decision. Typed output is not equivalent to correctness.
- Jev and JEPA are separate approaches. Do not treat vendor terminology such as
  System One as a universally agreed taxonomy or make undocumented claims about
  Jev's internal algorithm. Almeida's company is a relevant perspective, not an
  independent authority on its own product's safety.
- LeCun's research provides a concrete alternative for learning and planning;
  it does not demonstrate aligned general-purpose software agents. Separate
  predicting consequences from choosing acceptable goals and enforcing authority.
- Preserve uncertainty beside each claim. The research notes retain numerical
  details, chronology and supporting sources omitted from the shorter article.

## Scope and publication state

The author accepted a shorter Fable chronology and clearer deployment implications.
The proposed hypothetical coding-agent example was dropped: real incidents already
supply the concrete examples. Keep the existing title, subtitle, piece ID and URL.

The article is a local unpublished revision. No release, distribution or deployment
is scheduled. Refresh time-sensitive release and evaluation claims before publishing,
following the [publishing workflow](publishing-workflow.md).

## Review

Use the [editorial checklist](../authoring/editorial-review.md) and
[local content checks](content-quality.md) to review clarity, repetition and British
English. Check new source identity and the limits of each claim manually, then
rebuild and inspect the authoring preview. Numerical section references belong in
research notes, not the conversational article.

External-provider editorial reviews did not complete during the earlier drafting
pass. Local checks and manual review do not imply an independent model review.
Reports remain in ignored local directories described in
[editorial review](editorial-review.md). The reader-focused revision passed the snapshot build on 1 October, including
889 local-link checks and private-content exclusions. Before the subsequent detail reduction, local analysis reported
2,690 prose words, no technical errors or incomplete checks, nine passive-grammar
advisories, one agency advisory and one adverb-cluster advisory. Manual review
retained these passages: the agency flag occurs in an explicit denial of feelings,
and the adverbs distinguish leaving RL from eliminating imperfect measures.
The rendered preview was refreshed and checked for the story opening, the
alternatives, the concluding callback and the Astra release distinction.


## Article ending and attribution

The author requested no separate Further reading section and no added byline or
closing signature. Relevant supporting sources remain linked within the prose;
the broader reading list and source-check date stay in the research note.
Internal editorial notes do not appear in the post. The article ends with
“Knowing when to stop should count as intelligence, too.” Existing site identity supplies attribution. This article
change does not add an automatic signature to other content.

The final detail and ending revision passed the snapshot build (889 local links)
and manual preview checks on 1 October. Local analysis records 2,634 prose words.
README remains consistent with this editorial-only change.


## Publication readiness review, 1 October 2026

The current draft is editorially ready for author approval. A targeted refresh of
the Google announcement, AISI simulations and named Astra interview supported
the time-sensitive claims. The article retains the distinction between causal
training experiments, observed incidents and proposed alternatives.

The full `npm run prepublish:check` passed: local content analysis reported no
technical errors or incomplete checks; all 175 site tests passed; Astro reported
no errors or warnings; release verification checked 897 local links. An initial
sandboxed run failed to open disposable loopback test servers (`listen EPERM`);
the successful rerun had local-server permission. The separate draft snapshot
was already verified with the article and AI topic visible.

The source remains `draft: true` without a final `publishedAt` date. No publication
settings, commit, push or deployment were performed by this readiness review.
After publication approval, remove draft status and validate the actual release
including its article route and feed entry before deployment. The existing README
and publishing workflow remain accurate.

Publication timestamps are assigned by the first local published save in the
editor or the article publishing command. Commit and push then deliver through
Amplify. This implementation does not publish the draft.
See [publication timestamps](publication-time.md).
