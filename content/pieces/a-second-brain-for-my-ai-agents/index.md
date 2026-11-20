---
schemaVersion: 1
id: a-second-brain-for-my-ai-agents
title: Do second brains dream of agentic loops?
summary: Building a shared memory that connects experiences, preserves decisions and works across AI tools, devices and people.
language: en-GB
draft: true
publication:
  surfaces: [standalone]
slug: a-second-brain-for-my-ai-agents
tags: [ai, computing, systems-thinking]
---

A new conversation with an AI often begins with a surprisingly old chore. I explain,
again, what we have already decided.

I use several AI tools for different reasons, including
[Claude Code](https://claude.com/product/claude-code), [OpenClaw](https://openclaw.ai/),
[Hermes](https://hermes-agent.nousresearch.com/), [Codex](https://openai.com/codex/)
and the [Pi coding agent](https://pi.dev/). A decision made with one tool matters
when I continue with another. So does the reason we rejected an approach, the fix
that finally worked, or the thing we agreed to leave for later. Without a shared
record, I become the person carrying that context between them. A rather
administrative role for the only human involved.

I wanted that context to have a home of its own. So I built a shared knowledge base
on a [Raspberry Pi computer](https://www.raspberrypi.com/products/raspberry-pi-5/)
and gave my agents tools to read and update it. A nightly job turns their notes
into a wiki. I first called it *MySecondBrain*, then *Dreaming Second Brain*. It can now serve a team as
well as one person, with a private space for each member, so it is *Dream Team
Brain*.

Storing notes was the easy part. The harder questions were what the agents should
remember and how to keep it current. Persuading them to contribute at all needed
its own evaluation suite. A memory can also be useful and wrong at the same time;
I found an example while writing this article.

## Where the idea comes from

In the opening chapter of *Building a Second Brain*, Tiago Forte describes sitting
in a doctor’s office after years of persistent throat pain. He began writing down
the history of his condition, then asked for his complete patient record. It ran
to hundreds of pages.

He scanned the records, collected notes from consultations and prepared questions
for the next appointment. Information that had been scattered across visits could
now be searched, annotated and considered together. In his account, this became
the starting point for a practice he later used in study and work.
[Forte’s account](https://www.simonandschuster.com/books/Building-a-Second-Brain/Tiago-Forte/9781982167387).

A *second brain* is an external system that helps you use what you have learned: a
place for notes, sources, decisions and the connections between them. The test
comes when you need to do something next. Can you recover the relevant information
and understand why it matters?

Forte developed his approach into the *Building a Second Brain* course in early
2017, followed by the book on 14 June 2022. His CODE framework describes four
activities: capture, organise, distil and express. The final step gives the others
a purpose: use the material to make something, solve a problem or communicate an
idea. [Book and course history](https://www.simonandschuster.com/books/Building-a-Second-Brain/Tiago-Forte/9781982167387),
[the CODE method](https://fortelabs.com/blog/9-biggest-myths-and-misconceptions-about-basb/).

The name already had a life in software. On 13 July 2011, years before Forte’s
course, Evernote announced a funding round in which Phil Libin described its goal
as becoming “everyone’s second brain”. Forte popularised a method under the name;
the phrase itself was already in circulation. Its first use is harder to pin
down. [Evernote’s original
announcement](https://www.globenewswire.com/news-release/2011/07/13/1204004/0/en/Evernote-Secures-50-Million-Round-Led-by-Sequoia-Capital-for-Expansion-and-Acquisition-Strategy.html).

In his July 1945 essay *As We May Think*, Vannevar Bush imagined a memex user who
researches archery and links readings with personal notes. Years later, he
retrieves that trail to share with a friend. The connections remain available long
after the original research.
[Bush’s essay](https://www.theatlantic.com/magazine/archive/1945/07/as-we-may-think/303881/).

The idea also runs through Engelbart’s [1962 programme for augmenting human
intellect](https://dougengelbart.org/pubs/papers/scanned-original/1962-augment-3906-Augmenting-Human-Intellect-a-Conceptual-Framework.pdf)
with tools and methods. It returns in Clark and Chalmers’s [1998 argument about the
extended mind](https://www.consc.net/papers/extended.html), in which a reliably
used notebook can play a role comparable to internal memory. I cite them as
intellectual relatives of today’s systems. They do not settle who invented the
term.

## A brief look at the first brain

Imagine receiving directions to a café. Holding the next two turns in mind uses
short-term memory; comparing them with the street in front of you calls on
*working memory*, the limited workspace in which you hold and use information.
[Baddeley and Hitch’s working-memory model](https://doi.org/10.1016/S0079-7421(08)60452-1).

Long-term memory includes both *episodic memory*, such as remembering who you met
at that café, and *semantic memory*, such as knowing it closes on Mondays without
recalling when you learned that fact. Endel Tulving described the distinction in
1972 and later [recounted how it came
about](https://garfield.library.upenn.edu/classics1987/A1987K743800001.pdf).

That distinction helps explain my design. An agent’s current context is its
temporary workspace. My second brain keeps dated experiences, closer to episodic
memory. It also keeps knowledge I can use across occasions, closer to semantic
memory. Both kinds of record outlast a conversation.

The analogy concerns what the records do. Software records are not lived recollections.
Updating them does not change the model’s trained weights. The second brain
belongs to me; agents help me consult and maintain it.

## One history across several tools

Imagine that Claude Code fixes a deployment problem and discovers that a
particular setting must stay in place. A week later, Hermes or Codex takes over.
It needs the setting, the reason it matters and the circumstances in which it
was tested.

In this example, the first agent writes a dated episode in a journal. At night,
the consolidation job draws it together with earlier episodes to update the
project’s wiki page. The journal records what happened; the wiki explains where
things stand. Recurring people, organisations and projects each get a page, with
every name used for them and dated facts that cite their sources. A short profile
page describes me and how I like to work, so a new tool knows whom it is working
for.

Not everything starts as a note. Agents and I can add documents, photos and voice
memos. The brain reads PDFs, Office files, email and web pages locally, without a
model. Each night, before consolidating, the brain transcribes waiting voice memos on the
device that holds them. It works through a long recording a few pieces at a time. A two-hour meeting takes a few nights. Nobody
has yet asked for it sooner. For a
document that keeps changing, the brain can remember a link instead of a copy, so
agents open the latest version.

These records are ordinary Markdown files in a Git repository. I can inspect them
without an AI tool, edit them, or open the repository as a vault in Obsidian. Git attributes every change to the agent that made it. The search indexes can be
rebuilt from the files. Changing the model or the search implementation should not
require rescuing my notes from an opaque format.

The agents reach this store through the *Model Context Protocol*, or MCP. It gives
them operations such as `search`, `read` and `record_episode`. MCP supplies the
interface; the application decides how memories are stored and the agent decides
when to use the available tools. [MCP architecture
overview](https://modelcontextprotocol.io/docs/learn/architecture).

There is also a `brain` command-line interface. When configured with `BRAIN_URL`,
it calls the remote brain through MCP. Scripts and agents with shell access can
then use the same store without a separately configured MCP connection in every
tool. A web interface on the same server shows the day’s activity, search, a map
of the links between pages and the privacy rules. Installed as an app on Android, it accepts links, files and notes from the share
menu.

::block{ref="agent-handover"}

The next agent can read the project page, then follow a source if it needs more
detail. It does not have to replay the whole conversation that produced the fix.
Codex inside my ChatGPT desktop app used this connection to research this article;
other ChatGPT surfaces would need their own working route to the private server.

## Finding a memory is only part of remembering

Suppose a project note says the launch is in May. A later note moves it to June.
Ask a search engine about the launch and it may return both. The older note can
even come first if its wording is a better match. All the information is present,
yet the reader still has work to do.

My search combines exact words with similarity of meaning. SQLite FTS5 handles
keyword search, which is useful for project names, commands and identifiers.
EmbeddingGemma 2, running locally through LiteRT-LM, supports searches phrased
differently from the original note. Text, images and audio share one vector space,
so a written query can also find a photo or a voice memo by its content. Reciprocal rank fusion merges the two rankings. A result gains weight from
appearing near the top of either list.

Search then follows links. From its best matches, and from the people and projects
a question names, it reaches pages the question never mentions. A search for “Tom” reaches that person’s page, which lists their other names. From there it finds the note that only says “Walsh”.

::block{ref="hybrid-search"}

This retrieval step is related to *retrieval-augmented generation*, in which
selected external material is supplied to a model when it answers. The original
RAG paper described a particular trained retrieval-and-generation architecture; my
system uses the broader pattern through agent tool calls. [Lewis and colleagues,
2020](https://arxiv.org/abs/2005.11401).

Retrieval gets the two launch dates in front of the agent. The nightly
consolidation does some of the reconciliation in advance. It moves June into the
project page and keeps the change from May in the dated history. A question about
the current plan and a question about how it changed now have different places to
start.

There are useful precedents in agent research. *Generative Agents* (2023) combined
records of experience with higher-level reflections and retrieval. *MemGPT* (2023)
explored moving information between memory tiers within a limited model context.
*Sleep-time Compute* (2025) investigated processing context before a query
arrives. They study different systems and tasks, but each helps explain why memory
design extends beyond saving a transcript. [Generative
Agents](https://arxiv.org/abs/2304.03442),
[MemGPT](https://arxiv.org/abs/2310.08560),
[Sleep-time Compute](https://arxiv.org/abs/2504.13171).

## What happens when the second brain dreams

In human memory, *consolidation* refers to memories becoming more stable. Sleep
can help. In a 2007 experiment, volunteers learned card-pair locations while
smelling a rose scent. Presenting it again during slow-wave sleep improved later
recall compared with an odourless control. That is evidence that reactivating
memories during sleep can help preserve them. [Rasch and colleagues,
2007](https://pubmed.ncbi.nlm.nih.gov/17347444/).

The evidence about dreams is more intriguing and less settled. In a 2010 virtual-maze study, 50 volunteers took a 90-minute afternoon nap after
learning the maze. Only four mentioned the maze in their dream reports. Those four
improved about ten times more at retest than the other 46 nappers. Their dreams
contained fragments and related settings. They were not exact replays. With so few
dreamers, the authors did not claim dreams *caused* consolidation; dreaming and
improvement might reflect the same underlying memory processing.
[Wamsley and colleagues, 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2869395/).

That is the inspiration I borrow. After the immediate task has finished, the
system revisits experience and connects it with existing knowledge. The software
does not sleep or experience dreams. Its `brain dream` job is scheduled maintenance
with a somewhat more ambitious name.

First, ordinary code prepares an agenda: new episodes and inbox notes, recordings
waiting for a transcript, maintenance problems and newly detected gaps in search
results. Only new gaps count. Repeated unanswered searches do not, by themselves,
justify waking the model every night when no new information has arrived. A night
with an empty agenda costs nothing.

When there is work, the agent enters a tool-use loop: consider the available
information, choose a tool, observe its result and decide what to do next. It
might read an episode, search for a related project, update its page and handle a
rejected write. This is the *agentic loop* described in Anthropic’s
[Building effective agents](https://www.anthropic.com/engineering/building-effective-agents).
The nightly organiser preserves source links and dated changes, flags
contradictions and is instructed never to invent missing answers. It describes new
photos for search, merges pages that say the same thing and checks that the pages
it wrote can be found again. When a page changes, it replays the older episodes
behind it to catch facts the rewrite dropped.

::block{ref="memory-lifecycle"}

Each night ends with a short report, which can arrive on my phone. Ordinary code reads the night’s edits from Git and lists
the ones that may have lost something, such as a removed date, a vanished hedge or a
page that shrank. A cheaper model then checks fact lines against the episodes they
cite. It covers every line changed since the last check and a few older ones each
night. Git still records every edit for inspection and reversal.

A goal-directed loop can sit around such cycles, checking an explicit target: for
example, keep fixing code until a specified test suite passes or a limit is
reached. [Anthropic’s guide to loops](https://claude.com/resources/articles/getting-started-with-loops)
describes this pattern. My job checks the agenda before and after each run, but
does not keep restarting until a knowledge-quality target is met. Unfinished work
can wait for another night.

An agentic loop maintains my memory. That memory gives later loops a record of what
was tried, what worked and what remains unresolved.

That record can still lag behind events. While preparing this article, Codex asked
the brain about the second-brain project. Back came its history, deployment
decisions and earlier evaluations. It was a useful briefing, except that the wiki
still called the repository `MySecondBrain`. Checking the current Git remote
revealed the new name, `dreaming-second-brain`.

The project has since been renamed again, to `dream-team-brain`. This time I
checked the remote first.

## Teaching agents to contribute

Giving an agent somewhere to keep notes does not ensure it will take any.

A tool description can explain how to record an episode. A skill can explain when
to do it. Neither guarantees that the agent will remember to record a durable
outcome after a coding task. Instructions read at the start of a session can fade by its end.

The project’s evaluation suite gives agents work in a small repository. Some of it
is worth remembering, such as a dashboard ID, a decision or a deployment fix. The
rest is routine editing that belongs in Git. With the server instructions alone,
Claude Code recorded the useful work in 2 of 6 runs. With the skill as well, it
recorded none. Codex barely acted on the server instructions. With them alone, it recorded nothing
after the repository work. With the skill, it recorded the work in 2 of 6 runs.

Then I added two bullet points to each agent’s global instructions. Both agents then recorded it every time, 6 of 6. Neither recorded a routine edit.

The wording needs to explain what to skip. With a rule that did not name the exceptions, agents recorded every routine edit,
four out of four. A knowledge base that commemorates
every renamed variable will soon require a second knowledge base to explain the
first.

The practical rule is simple. Look up the project before working. Record decisions,
meaningful outcomes, lessons and reusable setup details before finishing. Keep each
episode specific enough that someone can understand it months later. Leave out
credentials, routine edits and self-contained snippets.

These are development runs on synthetic cases, two trials each. They do not prove
that every tool behaves the same way. They suggest a design lesson worth testing
elsewhere: evaluate whether agents contribute memory, as well as whether they can
retrieve it. The methodology and recorded results live in the project’s `evals/` directory.

## Testing whether the wiki earns its keep

A wiki also needs to justify the work of maintaining it. I could leave everything
in the journal and let each agent work through the records when asked a question.
The standard evaluation gave that simpler approach every chance. A Sonnet reader
with a generous budget answered 36 of 37 questions from 28 raw episodes. After
consolidation, it answered all 37. A strong reader with time to spare can reconcile
a small journal on its own.

The hard version used 178 episodes, including 150 distractors, with a Haiku reader
limited to six turns. The distractors include a second project with the same kinds
of facts and another person’s orthodontist. Using only the journal, the reader
answered 32 of 37 questions correctly. After one night of consolidation, it
answered all 37. The 95% intervals were 0.72–0.94 and 0.91–1.00. They overlap a
little, so the result is promising for that scenario but needs a larger test. The
night of consolidation cost about 90 cents.

A held-out scenario, set aside during development, kept me honest. With the same
Haiku reader, the raw journal scored 38 of 39 and the consolidated brain 37 of 39. On that test,
organising the memory added nothing.

::block{ref="memory-evaluation"}

Think of the difference between leaving a colleague a folder of meeting notes and
leaving a current project brief with links to those notes. Given enough time, they
may reach the same answer. If they need to act soon, the work you did to organise
the evidence becomes more valuable. Memory has a reading cost as well as a storage
cost.

The evaluation categories draw on research such as *LongMemEval*, which tests fact
extraction, reasoning across sessions, questions about time, knowledge updates and
abstention when the answer is unavailable. The project’s custom suite uses these
ideas; its numbers are not scores on the full LongMemEval benchmark.
[LongMemEval](https://arxiv.org/abs/2410.10813).

Rewriting a page every night could also wear its facts away, like a story retold
too often. A ten-night test looked for exactly that. No number, date or name drifted.
Of 155 fact lines, 148 were supported by their sources. The other seven lacked
support in the episodes they cited; none was outdated or contradicted.

The evaluations also showed that high semantic similarity did not reliably mean
that the brain contained an answer. Unanswerable questions could still have
plausible-looking matches. The agent must read the retrieved evidence and decide
whether it supports an answer. A similarity score is not a confidence level.

## Where it lives now

The Raspberry Pi 5 still does the main work. With an SSD, it hosts the memory, the
MCP service, the search indexes and the embedding service. It also runs the nightly
dream. Systemd manages the services and the schedule.

The remote connection goes through Tailscale. The brain service listens on a Unix
socket. Tailscale Serve makes it available over HTTPS within my private network.
The application checks the caller’s Tailscale identity against its allowed users.
Serve supplies that identity in request headers and removes incoming copies that a
client might try to forge. [Tailscale Serve
documentation](https://tailscale.com/docs/features/tailscale-serve).

The Pi is no longer the only copy. Each device keeps a full copy of the spaces it
can open. My Mac syncs with the Raspberry Pi every minute through a versioned Amazon S3 store.
Devices authenticate with certificates from my own certificate authority, so no
long-lived keys sit on them. If both sides change a page, the remote version wins.
The local one is kept as an episode. The next dream reconciles the two versions, so
neither edit is lost.

::block{ref="shared-memory"}

The versioned store and the copies replaced my old nightly backups. Before retiring
them, I restored my personal space from the store and compared every file with the
Pi by SHA-256. All 91 matched. A successful upload is reassuring; getting the memory
back is rather more useful.

The same small AWS setup can host the dream on a Lambda MicroVM instead. I tested
that path end to end, then switched it off. For one person, a Raspberry Pi that is awake anyway
does the job. A public endpoint for apps that cannot join my private network is
available but off by default.

There are two different kinds of computation here. Search, embeddings and
transcription run locally. The nightly organiser runs Claude Code on a cloud model, with Codex as a fallback. Agents using those models also send retrieved
material to their providers as part of the model context. Keeping the memory on my
own devices gives me control of its storage. It does not make the whole workflow
offline.

## Shared memory needs boundaries

Several agents writing to the same wiki create ordinary concurrency problems. If
two agents read a page and both edit it, one should not silently overwrite the
other. Updates therefore include the version that was read. A stale version is
rejected, forcing the writer to read and reconcile the newer page.

People bring a different problem. In a team brain, what someone records goes to the shared team space by default, attributed to whoever said or did it. Each person also has a
private space. Privacy rules written in plain words, such as “my health stays
private”, keep matching items in their owner’s space. The
[Cedar](https://www.cedarpolicy.com) policy engine decides each case before
anything is written. An administrator can also add rules such as “never store
client names”. Each space has its own nightly dream, so no model ever holds both a
private item and a team page it could write.

The list of rules shows colleagues that someone has privacy rules, never what those
rules cover. They
will know you keep some things private. They will not know it is the biscuits.

There is also a less ordinary problem. A harmful instruction can arrive inside
something saved as a memory. The nightly organiser is instructed to treat saved
content as data. Its tools are restricted too. It can maintain the brain, but its
configured tool set excludes shell access, web browsing and arbitrary URL
ingestion. Those limits reduce what an injected instruction could make it do. They
do not make it immune to manipulation.

Sharing memory also shares mistakes. If one agent records a guess as an established
decision, another may repeat it. A polished wiki page can make it look more
authoritative. Source links, dates, explicit open questions and the ability to
inspect changes let a reader check where a claim came from and whether it was ever
settled.

Forgetting has its own complication. The system can remove a fact from the current
wiki and redact the episodes containing it, including the request to forget it if
that request repeats the fact. Earlier Git history can still retain the original.
Older versions in the store may retain it too. Removing information from current
retrieval and erasing every retained copy are separate operations.

Finally, access to a shared memory does not imply permission to perform an action.
A note saying how a deployment works can help an agent understand a task. Whether
it may deploy still depends on the current request and its permissions.

## What I want to carry forward

The part I find most useful is the separation between the tools I use and the
history of my work. I can change an agent without starting my projects’ memories
again. I can read the records myself. I can challenge a summary, trace a decision
to its source and correct something that has become stale.

The application code and the personal memory are separate repositories. The code, deployment instructions and synthetic evaluations are public as
[Dream Team Brain](https://github.com/danilop/dream-team-brain). My personal records
remain private.

There is more to test, especially a longer sequence of real handovers between
tools and between people. When I open the next conversation, I want the agent to
find what we decided and understand why. It should also notice when something has
changed. Then we can get on with the work without my giving the introductory
briefing again.
