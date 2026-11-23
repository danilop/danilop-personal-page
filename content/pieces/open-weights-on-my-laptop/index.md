---
schemaVersion: 1
id: open-weights-on-my-laptop
title: Trying Inkling 2 Mini and Bonsai 2 27B on my laptop
summary: I set up two open-weight models on my MacBook Pro in a few minutes, then
  ran speed tests and three coding tasks.
language: en-GB
draft: false
publication:
  surfaces: [ standalone ]
slug: open-weights-on-my-laptop
tags: [ ai, computing, programming ]
homeImage: pi-tasks
publishedAt: 2026-11-23T13:46:29.313Z
---

Most of the AI I use runs in someone else’s data centre, which suits nearly all of my work.
My interest in open-weight models comes from somewhere else. When a model can run
close to its data and to the places where people and devices interact with it, new
uses become possible. A model on a laptop or a phone can read files that
should never leave the building and answer without a round trip to the cloud. It can
also keep working without a network connection. I keep one running on my laptop to
see how much of that capability fits on hardware I own, with weights anyone can
download.

The answer changes every few months. Apple is asking a similar question at a much
larger scale. In a recent paper,
[Minions](https://arxiv.org/html/2610.12970v1), six Apple researchers describe a
“virtual GPU cloud” built from the idle Apple silicon Macs in their organisation.
Jobs are split into small pieces. Each Mac pulls work when it has nothing better to
do and runs open models locally through Ollama. The paper reports that some jobs used
to wait more than ten hours for a shared GPU and can now often start within minutes.
It is an experience report with no benchmarks and no released code. I still find the
idea promising, because it treats the computers already on our desks as inference
capacity.

My own test was more modest. This month Thinking Machines released Inkling 2 Mini, an
open-weight model that fits on a laptop and reports strong coding scores.
I wanted to compare it with Ternary Bonsai 2 27B, the model I have been running locally
since October. Setting both up on my own machine took a few minutes one morning.
Then I watched them work.

## The machine and the runtime

Everything here ran on my MacBook Pro with an M5 Pro chip and 48 GB of memory, with
my usual apps open. The coding tests used the [Pi coding agent](https://pi.dev/),
which talks to a local server instead of a cloud API.

::block{ref="local-setup"}

Before comparing models, I had to choose the software that serves them. That choice
alone can double the speed of the same model. A few days earlier I had
compared two Mac apps that serve models locally, [oMLX](https://github.com/jundot/omlx) 0.8.0 and
[MTPLX](https://mtplx.com) 2.12.3, with Bonsai 2 27B on both. MTPLX supports
_multi-token prediction_ (MTP). A small draft head guesses the next few tokens and
the full model checks all of the guesses in one pass. When the guesses are right,
one pass produces several tokens. The output follows the model’s own distribution,
so speed is the only thing that changes.

::block{ref="mtp"}

With thinking off and 512-token answers, MTPLX wrote about twice as fast as oMLX at
every prompt size I tried. With MTP switched off, MTPLX was still about a third
faster, so part of the gain comes from the runtime itself. MTP added the rest.
MTPLX also read prompts faster, about 470 tokens per second against 300, so a
14,000-token prompt started answering after 30 seconds instead of 47.

::block{ref="runtime-speed"}

oMLX has its merits, including lower memory use over a long run of unrelated
prompts. For one person using a coding agent on one laptop, MTPLX was the clear
choice. I used it for everything that follows.

## Two models

The two models reach a laptop by different routes. Bonsai shrinks an existing model.
[Ternary Bonsai 2 27B](https://prismml.com/news/bonsai-2-27b) from Prism ML is
Qwen3.8 27B with almost every weight reduced to −1, 0 or +1. Prism gives its
footprint as 5.9 GB and reports that it keeps 98.2% of the original model’s overall
score on a suite covering reasoning, maths, coding, instruction following and tool
use. The coding tests in that suite include HumanEval+ and LiveCodeBench, but none of
them asks a model to work as an agent. I found no SWE-bench Verified result for
Bonsai that I could trace to its source.

[Inkling 2 Mini](https://thinkingmachines.ai/model-card/inkling-2-mini/) saves
space another way. Thinking Machines released it on 20 November under the Apache 2.0
licence. It is a _looped transformer_. The middle 12 of its 24 layers run three
times for every token, with the same weights on each pass. Each token goes through
48 layers, while the download stores only 24. Inkling is also a mixture of experts, so only
a small part of the model works on any one token. The vendor reports 79.2% on
SWE-bench Verified.
[Artificial Analysis](https://artificialanalysis.ai/models/inkling-2-mini) gives it
20 on its Intelligence Index, against a median of 10 for open models of a similar
size. Most of these figures come from the vendors, so I wanted my own.

Looping gives a model more room to think inside its hidden state without more
weights to store. Researchers call this _recurrent depth_, or _latent reasoning_
when the extra passes do work that would otherwise be written out as reasoning text.
The idea goes back to the [Universal Transformer](https://arxiv.org/abs/1807.03819)
in 2018. Smaller looped models such as
[Huginn](https://arxiv.org/abs/2502.05171) and ByteDance’s
[Ouro](https://arxiv.org/abs/2510.25741) came before Inkling. What is new is a
looped mixture-of-experts model from a well-funded lab, with open weights and strong
coding results. The loops add depth beneath the reasoning that Inkling still writes
out. Larger models may follow. The Information has reported, from one
anonymous source, that OpenAI’s next model, Astra, uses recurrent depth
([summarised here by Bret Kerr](https://bretkerr.substack.com/p/does-astra-think-in-loops)).
OpenAI has not confirmed it.

|                        | Bonsai 2 27B                         | Inkling 2 Mini                                                          |
| ---------------------- | ------------------------------------ | ----------------------------------------------------------------------- |
| Made by                | Prism ML, from Qwen3.8 27B           | Thinking Machines                                                       |
| Design                 | Dense                                | Mixture of experts, looped layers                                       |
| Parameters             | 27 billion, all used for every token | 26.4 billion, about 3.4 billion active (5.4 billion counting the loops) |
| Weights (MTPLX build)  | Ternary, stored in 2 bits            | 4-bit experts, 8-bit attention                                          |
| Download (MTPLX build) | 8.9 GB                               | 17.2 GB                                                                 |
| Context window         | About 262,000 tokens                 | About 1 million tokens                                                  |
| SWE-bench Verified     | No traceable result                  | 79.2% (vendor)                                                          |

Both models arrive already compressed, so MTPLX mostly repackages them. Its Bonsai
build, 8.9 GB, keeps the image encoder and adds a draft head for multi-token
prediction. For Inkling it offers three builds that keep the official
4-bit experts and differ in how they store the rest. I used the middle one,
_Optimized Speed_, a 17.2 GB download with 8-bit attention. MTPLX measured its loss
on 6,140 tokens of code and prose as equal to the official weights within noise.

Both ran on MTPLX 2.13.2 with multi-token prediction on. It drafted one token ahead
for Bonsai and three for Inkling. Loading both at once pushed my Mac into swap, so I ran
them one at a time. Each used its vendor’s recommended sampling settings.

## Raw speed

I started with the simplest measurement. Each model received a short question and a
long service log of 330 lines. I asked for 700 tokens of answer and timed three runs
of each. The log is about 11,000 tokens for
Inkling and 14,500 for Bonsai, because their tokenisers split text differently.

::block{ref="model-speed"}

|                                    | Bonsai 2 27B | Inkling 2 Mini |
| ---------------------------------- | -----------: | -------------: |
| Writing speed, short question      |  36 tokens/s |    46 tokens/s |
| Writing speed, long log            |  37 tokens/s |    65 tokens/s |
| Reading speed, long log            | 430 tokens/s | 1,320 tokens/s |
| Wait for the first token, long log |         34 s |          8.6 s |

Inkling reads prompts about three times faster than Bonsai. That helps most the
first time a model sees a long document. In a coding agent, later turns reuse most of
the conversation from a cache, so how much a model writes, and how fast, counts for
more.

Inkling also writes faster after the long log than after the short question. Its
answer about the log is more predictable, so the draft head’s guesses were accepted
about two thirds of the time, against under a third for the short question. With
three tokens drafted at a time, each accepted guess is worth more to Inkling. For
Bonsai, which drafts one, each pass over its much longer context costs enough to
cancel the gain.

Speed helps only if the answers are right, so I also gave both models 13 small
tasks, twice each. They covered arithmetic, a calendar question, a logic puzzle, a probability
question, three Python functions checked by tests, a bug fix, a list with strict
formatting rules, structured extraction, two tool calls and a question about the long
log. Each model used its own default reasoning effort, medium for Bonsai and high for
Inkling. Bonsai passed all 26.
Inkling passed 24 and finished the set in 7 minutes 23 seconds against Bonsai’s
10 minutes 22 seconds.

On the probability question, Inkling got the answer right but wrapped it in LaTeX,
`\boxed{5/12}`, when I had asked for a bare fraction. Maths benchmarks mark their final answers
that way, and Inkling had clearly sat a few of them. Its model card
warns of occasional failures to follow instructions precisely. The other miss was a
tool call. Inkling handled Pi’s own `read`, `bash` and `edit` every time. When the
same kind of tool was named `read_file`, it wrote the call out as broken text in
seven of ten requests.

## A coding agent with a local model

All of those were single answers. An agent has to plan, call tools, read the results
and try again. I gave Pi three small tasks, each in a fresh folder, with reasoning
effort set to medium for both models.

- Create: write a command-line tool that prints statistics for one column of a
  CSV file, following an exact output format, and write tests for it. I checked the
  result with five tests of my own that the model never saw.
- Fix: a small module with three planted bugs and failing tests. The model had to
  fix the code without touching the tests. I checked it with extra hidden tests.
- Review: a short Python class with five planted problems, from SQL injection to
  an error handler that lets anyone log in. The model had to list the problems by
  severity and suggest a fix for each.

::block{ref="pi-tasks"}

| Task       | Bonsai 2 27B                             | Inkling 2 Mini                           |
| ---------- | ---------------------------------------- | ---------------------------------------- |
| Create     | All 5 hidden tests pass                  | All 5 hidden tests pass                  |
| Fix        | 3 of 3 bugs fixed, 1 hidden check missed | 3 of 3 bugs fixed, 1 hidden check missed |
| Review     | 5 of 5 problems, plus 3 sound extras     | 5 of 5 problems, plus 3 sound extras     |
| Total time | 12 min 22 s                              | 2 min 24 s                               |

The two models made the same miss on the fix. The docstring says the discount must be
between 0 and 100. Neither added a check for it. Their reviews ranked the same two
problems first, the login bypass and the SQL injection. Both also raised sensible
points I had not planted.

Bonsai spent most of its time on the create task, more than ten minutes against
under two for Inkling. It took ten turns and wrote almost 20,000 tokens at about 34 a
second. Inkling finished in nine turns with about 5,000 tokens at about 61 a second.
Waiting for the first token was a small part of either total, because most of each
request was already in the cache.

## What I take from it

On these tasks the two models were equally good. Inkling 2 Mini was much faster.
Apart from MTP, I think most of that speed comes from the mixture of experts. For each token, Bonsai
uses all 27 billion of its parameters and Inkling about 3.4 billion, or 5.4 billion
counting the loops. Drafting three tokens at a time, against Bonsai’s one, adds to
the gain. I did not measure the two effects separately. Inkling is also the first
model I have run on my laptop that combines a mixture of experts with multi-token
prediction.

Inkling’s published coding scores are high, but my tasks were too simple to show a
difference in quality. Each task ran once, so I read the speed gap as solid and the
tie as a first impression. In the Pi tests I ran Inkling one step below its default
reasoning effort, which favours it on speed and may have cost it a little quality.

Memory is the real constraint. Inkling needs twice the space of Bonsai. With my
normal apps open, the server occasionally refused a long prompt to keep the Mac out
of swap. On a 48 GB laptop that also runs everything else I do, that is the right
behaviour, if not always a welcome one.

For now I am switching my local coding setup to Inkling 2 Mini and keeping Bonsai for
times when memory is tight. A year ago I would not have expected a model on my laptop
to fix bugs and find a SQL injection in a minute or two.
