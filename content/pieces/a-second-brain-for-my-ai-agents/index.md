---
schemaVersion: 1
id: a-second-brain-for-my-ai-agents
title: Do second brains dream of agentic loops?
summary: Building a shared memory that connects experiences, preserves decisions and works across AI tools.
language: en
draft: true
publication:
  surfaces: [standalone]
slug: a-second-brain-for-my-ai-agents
tags: [ai, computing, systems-thinking]
---

A new conversation with an AI can begin with a surprisingly old task: explaining
what we have already decided.

I use several AI tools for different reasons, including
[Claude Code](https://claude.com/product/claude-code), [OpenClaw](https://openclaw.ai/),
[Hermes](https://hermes-agent.nousresearch.com/), [Codex](https://openai.com/codex/)
and the [Pi coding agent](https://pi.dev/). A decision made with one
tool matters when I continue with another. So does the reason we rejected an approach, the fix that finally worked,
or the thing we agreed to leave for later. Without a shared record, I become the person carrying
that context between them. A rather administrative role for the only human
involved.

I want that context to have a home of its own, so I built a shared knowledge base
on a [Raspberry Pi computer](https://www.raspberrypi.com/products/raspberry-pi-5/), gave my agents tools to read and update it, and added
a nightly job that turns their notes into a wiki. I call it *Dreaming Second Brain*.

The interesting work is deciding what the agents should remember,
how to keep it current, and how to persuade them to contribute in the first place.
There are also occasional reminders that a memory can be useful and wrong at
the same time. I encountered one while writing this article.

## Where the idea comes from

In the opening chapter of *Building a Second Brain*, Tiago Forte describes sitting
in a doctor's office after years of persistent throat pain. He began writing down
the history of his condition, then asked for his complete patient record. It ran
to hundreds of pages.

He scanned the records, collected notes from consultations and prepared questions
for the next appointment. Information that had been scattered across visits could
now be searched, annotated and considered together. In his account, this became
the starting point for a practice he later used in study and work.
[Forte's account](https://www.simonandschuster.com/books/Building-a-Second-Brain/Tiago-Forte/9781982167387).

That is a useful way into the idea. A *second brain* is an external system that
helps you use what you have learned: a place for notes, sources, decisions and the
connections between them. The test comes when you need to do something next.
Can you recover the relevant information and understand why it matters?

Forte developed his approach into the *Building a Second Brain* course in early
2017, followed by the book on 14 June 2022. His CODE framework describes four
activities: capture, organise, distil and express. The final step gives the others
a purpose: use the material to make something, solve a problem or communicate an
idea. [Book and course history](https://www.simonandschuster.com/books/Building-a-Second-Brain/Tiago-Forte/9781982167387),
[the CODE method](https://fortelabs.com/blog/9-biggest-myths-and-misconceptions-about-basb/).

The name already had a life in software. On 13 July 2011, years before Forte's
course, Evernote announced a funding round in which Phil Libin described its goal
as becoming “everyone's second brain”. Forte popularised a method under the name;
the phrase itself was already in circulation. Its first use is harder to pin
down. [Evernote's original
announcement](https://www.globenewswire.com/news-release/2011/07/13/1204004/0/en/Evernote-Secures-50-Million-Round-Led-by-Sequoia-Capital-for-Expansion-and-Acquisition-Strategy.html).

In his July 1945 essay *As We May Think*, Vannevar Bush imagined a memex user
researching archery, linking readings and personal notes. Years later, he
retrieves that trail to share with a friend. The connections remain available
long after the original research.
[Bush's essay](https://www.theatlantic.com/magazine/archive/1945/07/as-we-may-think/303881/).

The idea also runs through Engelbart's [1962 programme for augmenting human
intellect](https://dougengelbart.org/pubs/papers/scanned-original/1962-augment-3906-Augmenting-Human-Intellect-a-Conceptual-Framework.pdf)
with tools and methods, and Clark and Chalmers's [1998 argument about the extended
mind](https://www.consc.net/papers/extended.html), in which a reliably used notebook
can play a role comparable to internal memory. These are intellectual relatives
of today's systems, rather than claims about who invented the term.

## A brief look at the first brain

Imagine receiving directions to a café. Holding the next two turns in mind uses short-term memory;
comparing them with the street in front of you calls on *working memory*, the
limited workspace in which you hold and use information.
[Baddeley and Hitch's working-memory model](https://doi.org/10.1016/S0079-7421(08)60452-1).

Long-term memory includes both *episodic memory*, such as remembering who you met
at that café, and *semantic memory*, such as knowing it closes on Mondays without
recalling when you learned that fact. Endel Tulving described the distinction in
1972 and later [recounted how it came
about](https://garfield.library.upenn.edu/classics1987/A1987K743800001.pdf).

That distinction helps explain my design: an agent's current context is its
temporary workspace, while my second brain keeps both dated experiences and
knowledge I can use across occasions. Both kinds of record outlast a conversation.

The analogy concerns their roles. Software records are not lived recollections,
and updating them does not change the model's trained weights. The second brain
belongs to me; agents help me consult and maintain it.

## One history across several tools

Imagine that Claude Code fixes a deployment problem and discovers that a
particular setting must stay in place. A week later, Hermes or Codex takes over.
It needs the setting, the reason it matters and the circumstances in which it
was tested.

In this example, the first agent writes a dated episode in a journal. At night,
the consolidation job draws it together with earlier episodes to update the
project's wiki page. The journal records what happened; the wiki explains where
things stand. A short profile keeps personal context useful across tasks.

These records are ordinary Markdown files in a Git repository. I can inspect
them without an AI tool, edit them, or open the vault in Obsidian. The search index can be
rebuilt from the files. Changing the model or the search implementation should
not require rescuing my notes from an opaque format.

The agents reach this store through the *Model Context Protocol*, or MCP. It gives
them operations such as `search`, `read` and `record_episode`. MCP supplies the
interface; the application decides how memories are stored and the agent decides
when to use the available tools. [MCP architecture
overview](https://modelcontextprotocol.io/docs/learn/architecture).

There is also a `brain` command-line interface. When configured with `BRAIN_URL`,
it calls the remote brain through MCP. This lets scripts and agents with shell
access use the same store without requiring a separately configured MCP
connection in every tool.

::block{ref="shared-memory"}

The next agent can read the project page, then follow a source if it needs more
detail. It does not have to replay the whole conversation that produced the fix.
Codex inside my ChatGPT desktop app used this connection to research the article;
other ChatGPT surfaces would need their own working route to the private server.

## Finding a memory is only part of remembering

Suppose a project note says the launch is in May. A later note moves it to June.
Ask a search engine about the launch and it may return both. The older note can
even come first if its wording is a better match. All the information is present,
yet the reader still has work to do.

My search combines exact words with similarity of meaning. SQLite FTS5 handles
keyword search, which is useful for project names, commands and identifiers. An
embedding model running through LiteRT-LM supports searches phrased differently
from the original note. The implementation combines the two rankings using
reciprocal rank fusion: a result gains weight from appearing near the top of
either list.

This retrieval step is related to *retrieval-augmented generation*: selected
external material is supplied to a model when it answers. The original RAG paper
described a particular trained retrieval-and-generation architecture; my system
uses the broader pattern through agent tool calls. [Lewis and colleagues,
2020](https://arxiv.org/abs/2005.11401).

Retrieval gets the two launch dates in front of the agent. *Consolidation* does
some of the reconciliation in advance: it moves June into the project page and
keeps the change from May in the dated history. A question about the current plan
and a question about how it changed now have different places to start.

There are useful precedents in agent research. *Generative Agents* (2023) combined
records of experience with higher-level reflections and retrieval. *MemGPT*
(2023) explored moving information between memory tiers within a limited model
context. *Sleep-time Compute* (2025) investigated processing context before a
query arrives. They study different systems and tasks, but each helps explain why
memory design extends beyond saving a transcript. [Generative
Agents](https://arxiv.org/abs/2304.03442),
[MemGPT](https://arxiv.org/abs/2310.08560),
[Sleep-time Compute](https://arxiv.org/abs/2504.13171).

## What happens when the second brain dreams

In human memory, *consolidation* refers to memories becoming more stable, and
sleep can help. In a 2007 experiment, volunteers learned card-pair locations while
smelling a rose scent. Presenting it again during slow-wave sleep improved later
recall compared with an odourless control: evidence that reactivating memories
during sleep can help preserve them. [Rasch and colleagues,
2007](https://pubmed.ncbi.nlm.nih.gov/17347444/).

Dreams make the story more intriguing, and less settled. In a 2010 virtual-maze
study, sleepers who reported maze-related dreams tended to improve more at
retest. Their dreams contained fragments and related settings, rather than exact
replays. Only four sleepers explicitly mentioned the maze in verbal reports.
The authors did not claim dreams *caused* consolidation; dreaming and improvement
might reflect the same underlying memory processing.
[Wamsley and colleagues, 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2869395/).

That is the inspiration I borrow: revisit experience and connect it with existing
knowledge after the immediate task has finished. The software does not sleep or
experience dreams. Its `brain dream` job is scheduled maintenance with a somewhat
more ambitious name.

First, ordinary code prepares an agenda: new episodes, inbox notes, maintenance
problems and newly detected gaps in search results. An empty agenda means no model
call. Repeated unanswered searches do not, by themselves, justify waking the model
every night when no new information has arrived.

When there is work, the agent enters a tool-use loop: consider the available
information, choose a tool, observe its result and decide what to do next. It
might read an episode, search for a related project, update its page and handle
a rejected write. This is the *agentic loop* described in Anthropic's
[Building effective agents](https://www.anthropic.com/engineering/building-effective-agents).
The consolidator preserves source links and dated changes, flags contradictions
and is instructed never to invent missing answers. Git records its edits for
inspection and reversal.

::block{ref="memory-lifecycle"}

A goal-directed loop can sit around such cycles, checking an explicit target:
for example, keep fixing code until a specified test suite passes or a limit is
reached. [Anthropic's guide to loops](https://claude.com/resources/articles/getting-started-with-loops)
describes this pattern. My job checks the agenda before and after each run, but
does not keep restarting until a knowledge-quality target is met. Unfinished
work can wait for another night.

The connection runs both ways: an agentic loop maintains my memory, and that
memory gives later loops a record of what was tried, what worked and what remains
unresolved.

That record can still lag behind events. While preparing this article, Codex
asked the brain about the second-brain project. Back came its history, deployment
decisions and earlier evaluations. It was a useful
briefing, except that the wiki still called the repository `MySecondBrain`.
Checking the current Git remote revealed the new name, `dreaming-second-brain`.

The remembered history helped locate the project; the live check caught the
change.

## Teaching agents to contribute

Giving an agent somewhere to keep notes does not ensure it will take any. That
is one of the more revealing problems.

A tool description can explain how to record an episode. A skill can explain
when to do it. Neither guarantees that the agent will remember to record a
durable outcome after a coding task.

The project's small evaluation suite gave agents work worth remembering, such as
a decision or a deployment fix, mixed with routine edits that should be left in
Git. With server instructions alone or with the skill added, they recorded only
two of twelve durable work outcomes across the two conditions.

Adding a short rule to their global instructions changed the result to twelve
out of twelve in those runs. None of the eight routine-edit trials produced an
unnecessary record.

The wording needs to explain what to skip. An earlier rule caused routine edits to
be recorded too. A knowledge base that commemorates every renamed variable will
soon require a second knowledge base to explain the first.

The practical rule is simple: look up the project before working, and record
decisions, meaningful outcomes, lessons and reusable setup details before
finishing. Keep each episode specific enough that someone can understand it
months later. Leave out credentials, routine edits and self-contained snippets.

These are results from a small synthetic suite using Claude Code with Sonnet,
rather than proof that all my tools behave identically. They suggest a
design lesson worth testing elsewhere: evaluate whether agents contribute memory,
as well as whether they can retrieve it. The methodology and recorded results
live in the project's `evals/` directory.

## Testing whether the wiki earns its keep

A wiki also needs to justify the work of maintaining it. I could leave everything
in the journal and let each agent work through the records when asked a question.
The first evaluation gave that simpler approach every chance: a strong reader
with a generous tool-call budget answered all 31 questions correctly from the raw
journal and all 31 from the consolidated memory. The extra organisation had no
answer-accuracy gain to show.

The harder version used 178 episodes, including 150 distractors, a Haiku reader
and a six-turn budget. The recorded results were 26 correct answers out of 31
from the raw journal and 31 out of 31 after consolidation. The reported 95%
intervals were wide: 0.67–0.93 and 0.89–1.00 respectively. This is a promising
result for that scenario, with plenty of room for further testing.

Think of the difference between leaving a colleague a folder of meeting notes and
leaving a current project brief with links to those notes. Given enough time, they
may reach the same answer. If they need to act soon, the work you did to organise
the evidence becomes more valuable. Memory has a reading cost as well as a
storage cost.

The evaluation categories draw on research such as *LongMemEval*: extracting
facts, reasoning across sessions, handling time, updating knowledge and
abstaining when the answer is unavailable. The project's custom suite uses these
ideas; its numbers are not scores on the full LongMemEval benchmark.
[LongMemEval](https://arxiv.org/abs/2410.10813).

One other finding deserves attention. High semantic similarity did not reliably
mean that the brain contained an answer. Unanswerable questions could still have
plausible-looking matches. The agent must read the retrieved evidence and decide
whether it supports an answer. A similarity score is not a confidence level.

## What runs on the Raspberry Pi

My deployment uses a Raspberry Pi 5 with an SSD. It hosts the vault, the MCP
service, the search index and the embedding service. Systemd manages the services
and the nightly consolidation schedule.

The remote connection goes through Tailscale. The brain service listens on a Unix
socket, and Tailscale Serve makes it available over HTTPS within my private
network. The application checks the caller's Tailscale identity against its
allowed users. Serve supplies those identity headers and removes incoming copies
that a client might try to forge. [Tailscale Serve
documentation](https://tailscale.com/docs/features/tailscale-serve).

The memory is independent of my laptop, but still depends on the Raspberry Pi,
its storage and the network connection being available.

There are two different kinds of computation here. Search and embeddings run
locally. The nightly organiser invokes Claude Code, with Codex as a fallback,
using cloud models. Agents using those models also send retrieved material to
their providers as part of the model context. Keeping the vault at home gives me
control of its storage; it does not make the whole workflow offline.

After the nightly consolidation finishes, the Raspberry Pi backs up the vault
and its Git history to a private Amazon S3 bucket. The backup also runs if
consolidation fails: the day's experiences deserve to survive a bad night's
sleep. I tested a restore into a separate directory, verified the recovered
files and history, and rebuilt keyword search. A successful upload is reassuring;
getting the memory back is rather more useful.

## Shared memory needs boundaries

Several agents writing to the same wiki create ordinary concurrency problems.
If two agents read a page and both edit it, one should not silently overwrite the
other. Updates therefore include the version that was read. A stale version is
rejected, forcing the writer to read and reconcile the newer page.

There is also a less ordinary problem: a harmful instruction can arrive inside
something saved as a memory. The nightly organiser is instructed to treat saved
content as data, and its tools are restricted. It can maintain the brain, but its
configured tool set excludes shell access, web browsing and arbitrary URL
ingestion. Those limits reduce what an injected instruction could make it do;
they do not establish immunity to manipulation.

Sharing memory also shares mistakes. If one agent records a guess as an established
decision, another may repeat it, and a polished wiki page can make it look more
authoritative. Source links, dates, explicit open questions and the ability to
inspect changes are essential parts of the design.

Forgetting has its own complication. The system can remove a fact from the
current wiki and redact the episodes containing it, including the request to
forget it if that request repeats the fact. Earlier Git history can still retain
the original. Backup copies may retain it too. Removing information from current
retrieval and erasing every retained copy are separate operations.

Finally, access to a shared memory does not imply permission to perform an action.
A note saying how a deployment works can help an agent understand a task. Whether
it may deploy still depends on the current request and its permissions.

## What I want to carry forward

The part I find most useful is the separation between the tools I use and the
history of my work. I can change an agent without starting my projects' memories
again. I can read the records myself. I can challenge a summary, trace a decision
to its source and correct something that has become stale.

The application code and the personal vault are separate repositories. I am
preparing [Dreaming Second Brain](https://github.com/danilop/dreaming-second-brain)
for public release; the repository is still private as I write this. The code,
deployment instructions and synthetic evaluations can be shared while my
personal records remain private.

There is more to test, especially a longer sequence of real handovers between
tools. When I open the next conversation, I want the agent to be able to find
what we decided, understand why, and notice when something has changed. Then we
can get on with the work without my giving the introductory briefing again.
