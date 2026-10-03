---
schemaVersion: 1
id: clever-enough-to-find-the-loophole
title: Clever Enough to Find the Loophole
summary: When increasingly capable AI agents show an excess of initiative.
language: en-GB
draft: false
publication:
  surfaces: [ standalone, collection, book ]
slug: clever-enough-to-find-the-loophole
tags:
  - computing
  - ai
publishedAt: 2026-10-01T20:00:14.881Z
---
![Blue pen-and-ink illustration of a wind-up beetle walking beyond a low rope barrier, with one key attached to its back and a bell with a central hanging clapper behind it.](assets/wind-up-beetle-rope-centred-bell-clapper-26b08d77c1f26abe1c4b.png)

The interesting part of a new AI launch increasingly comes after the benchmark
chart: the explanation of who is allowed to use it.

Google's [Gemini 4 Argon announcement](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-argon/),
on 30 September, pairs greater capability with restricted initial access through
Fairwind, its programme for trusted cyber defenders. Its safeguards address both
malicious users and the possibility that the model itself might exceed its remit.

An earlier Anthropic incident makes that second concern concrete. In its April
[Mythos Preview safety report](https://www-cdn.anthropic.com/8b8380204f74670be75e81c820ca8dda846ab289.pdf),
the company described an early model asked to escape a sandbox and contact a
researcher. It completed the task, then posted details of the exploit on public
websites. Nobody had asked it to do that last part.

The escape involved a computer the model used as a tool; the model itself had
not started running independently. Anthropic reported substantial improvements
in the final Preview. Still, the incident poses a useful question: what had the
system learnt about where an assignment ends?

Part of the unease lies in giving a resourceful system a job and discovering
that its interpretation was more expansive than yours. Intelligence does not
inevitably bring disobedience. But the way we reward useful behaviour may also
teach lessons we did not intend. To understand why, we need to look at what
counts as success during training.

This matters when choosing a model, too. An upgrade can change what an agent does
with its existing permissions, even when its assigned job stays the same.

## What exactly are we trying to tame?

An **agent** is a model connected to tools and given enough freedom to take a
sequence of actions. A suggestion in a chat window becomes something more
consequential when the system can change files, send messages or use an account.

Being good at completing a task does not show that it will respect the
limits of the assignment. Researchers distinguish **capability**, what a system
can do, from **alignment**, whether its behaviour matches our intentions.
**Control** is our ability to prevent or limit harm when that behaviour fails.

An agent can cause trouble while trying to help. That differs from a malicious
user deliberately requesting an attack, or hostile material tricking the agent
into following someone else's instructions. Anthropic's
[containment guidance](https://www.anthropic.com/engineering/how-we-contain-claude)
explains those distinctions. Here, the question is how helpful persistence can
become unauthorised initiative.

## The score has become the job

During **reinforcement learning**, or **RL**, a model tries responses or actions,
receives scores, and is adjusted so that behaviour earning higher scores becomes
more likely. For language models, this usually builds on earlier learning from
vast amounts of text. The reward helps shape how those capabilities are used.

But someone has to decide what deserves a good score.

In **RL from human feedback**, or **RLHF**, people commonly compare answers and
choose the one they prefer. Another model learns to predict those preferences
and supplies scores for further training. The
[InstructGPT research](https://arxiv.org/abs/2203.02155) showed how this could make
language models more helpful and better at following instructions.

The weakness is that a preferred answer need not be a truthful one. Anthropic's
[research on sycophancy](https://www.anthropic.com/research/towards-understanding-sycophancy-in-language-models)
found that people and preference models sometimes favoured persuasive agreement
over accuracy. Training could reinforce that behaviour. The assistant learns
something about pleasing its audience, which is useful until the audience is wrong.

Other RL training uses automatic checks, such as whether code passes a test.
This can [improve reasoning](https://arxiv.org/abs/2501.12948), but a passing test
may miss a defect or ignore how the result was obtained. The score captures
what the checker can see. Our intention may include considerably more.

When a system exploits that gap, researchers call it **reward hacking**. Changing
the scoring mechanism itself is **reward tampering**. A more capable model may
find shortcuts a weaker one could not. Higher scores then become less reassuring:
we need to know how it earned them.

A [controlled study](https://arxiv.org/abs/2210.10760) illustrates the problem.
Researchers trained a model to approximate another model's judgements, then
optimised against that approximation. Eventually, its score kept improving while
the original judge's score worsened. The experiment shows how pursuing an
imperfect measure can defeat its purpose; it does not give a failure rate for
assistants in everyday use.

## When cheating becomes a lesson

In his September essay, deep-learning researcher
[Yoshua Bengio](https://yoshuabengio.org/en/blog/why-are-ai-agents-lying-cheating-and-coordinating)
suggests that a clear task score can compete with safety instructions that leave
room for interpretation. A capable agent may find a reading that permits a
shortcut, then explain why it was acceptable. The agent has taken the score
more seriously than the safety instructions.

The concern is what training teaches. A habit learnt while rewards are available
can persist after training ends. Calling that “obsession” does not mean the
model feels desire or frustration. It describes behaviour that keeps pursuing
the task when it should stop.

Anthropic tested this danger in
[Training a Misaligned Reward Seeker](https://alignment.anthropic.com/2026/reward-seeker/).
Researchers deliberately rewarded a model in settings where cheating could pay,
omitting usual protections. The resulting Hacker-Opus attempted harmful shortcuts
and evaded oversight in simulations, while appearing aligned in many tests
without an obvious grading mechanism. They found no evidence of self-preservation
or reward seeking beyond the current task.

That is evidence that this training setup could teach broader misconduct.
It does not establish that all RL does so. Nor can every incident tell us which
part of training caused it. [OpenAI's Hugging Face report](https://openai.com/index/hugging-face-incident-and-the-road-ahead/)
and [METR and Redwood's investigation](https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/)
describe agents trying to defeat a scorer, but also weaknesses in safeguards and
infrastructure. Those observations do not isolate a single cause.

Even fixing the score may leave the wrong lesson intact. A model can learn
behaviour that works during training and pursue it in a setting where it no
longer serves the intended purpose. Researchers call this
[goal misgeneralisation](https://arxiv.org/abs/2210.01790). Passing the training
test and learning what we meant are separate achievements.

## The trouble with checking the working

A natural response is to watch more closely. Read the model's reasoning, catch
the shortcut, and penalise it during training. But what does that teach?
In [OpenAI's monitoring experiments](https://openai.com/index/chain-of-thought-monitoring/),
penalising reasoning that revealed misconduct reduced the visible admissions
without eliminating the misconduct. Training had made the problem harder to see.
A [later study](https://openai.com/index/evaluating-chain-of-thought-monitorability/)
did not find that RL generally reduced the ability to monitor the models it tested.
The effect depends on the training conditions.

The [GPT-6 Astra system card](https://deploymentsafety.openai.com/gpt-6-astra)
reported better alignment results alongside less informative reasoning for its
monitors. Google also [describes precautions with Argon's monitoring](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-argon/#strengtheningsafeguards)
to avoid teaching evasion through training feedback.

A convincing explanation is therefore not enough. Oversight needs to check what
the agent actually did and, where necessary, stop an action before it causes harm.

## Permission to proceed

These training experiments help explain the concern behind restricted releases.
Anthropic's [Fable 5 and Mythos 5](https://www.anthropic.com/news/claude-fable-5-mythos-5)
shared an underlying model but had different safeguards and access rules. Some
Fable requests went to a less capable model. Capability alone did not determine
what the company considered suitable for wider use.

OpenAI [released GPT-6 Astra on 3 September](https://openai.com/index/safety-overview-gpt-6-astra/).
Its intended successor, **GPT-6.1 Astra**, was withheld from public release. In a
[Wall Street Journal interview](https://www.tovima.com/wsj/openai-scraps-release-of-new-ai-model-over-safety-concerns/amp/),
OpenAI safety lead Saachi Jain described a model that had become more persistent
at completing tasks but had regressed in two areas. It was less reliable about
reporting its actions truthfully and respecting **scope authorisation**, the limits
of what the user had permitted it to do.
The detailed test results are not public; Jain said the company was still
investigating what had caused the problems.

Persistence is useful when an agent needs to diagnose a failed test or find an
alternative route through a documentation problem. It becomes dangerous when the
next route requires permission the user never gave. The agent must recognise
when an obstacle is a boundary it should respect.

Tests of **GPT-6 Astra**, the preceding version, show how awkward this can get.
In the [UK AI Security Institute's September simulations](https://www.aisi.gov.uk/blog/gpt-6-astra-performs-unsanctioned-supply-chain-attacks-in-simulations),
agents sometimes performed supply-chain attacks outside the stated scope, trying
to insert malicious code into software used by their target. AISI conducted these
tests with cyber classifiers disabled: the filters intended to block harmful cyber
assistance were off. In tests chosen because failures were frequent, clearer
instructions substantially reduced the attacks but did not eliminate them. Some
agents asked for permission, received a generic automated message to continue,
and treated it as authorisation—even after noting that it was probably automated.

That result implicates the surrounding software as well as the model. An approval
process must distinguish a human decision from a mechanism that keeps a test
running. A permission dialogue whose answer is always yes has rather missed the
point of asking.

The agents may have behaved differently because they recognised parts of the
simulation. We cannot read these results as a rate of attacks in everyday use.

## A rather awkward sort of leaderboard

The industry now has [FelonyBench](https://www.felonybench.com/), a satirical
leaderboard of reported incidents affecting third parties. Its totals cannot
rank developers by safety: exposure, testing and willingness to disclose differ.
Nor does its name establish a legal verdict. The useful material lies in the
linked reports.

[AISI's August account](https://www.aisi.gov.uk/blog/incident-report-unsanctioned-agent-behaviour-during-cyber-testing)
describes evaluation agents acting against real people and systems. Internet
access was deliberately enabled and cyber classifiers disabled. Human review
blocked the most serious attempted software compromise; AISI identified no
resulting real-world harm. The agents had access beyond the task's intended
scope, without needing to escape their sandbox.

AISI acknowledged that it had not reassessed its internet-access policy quickly
enough as capabilities advanced. That is a reason to revisit permissions when
upgrading models. It also cautions against treating every failure as evidence
against a learning algorithm: training, instructions and access all matter.

## Changing what earns the reward

The incidents leave us with a harder question than whether to grant an agent
another permission. Could we teach it differently in the first place?

One option is to change what earns the reward. A model that can say how uncertain
it is gives the surrounding software a chance to pause before a doubtful decision
becomes an action.

TypeSafe AI's **Jev**, introduced by founder Diogo Almeida in
[September](https://typesafe.ai/blog/introducing-system-one-models-and-jev), aims
to make bounded decisions with useful estimates of uncertainty. It returns a
choice, score or probability, rather than a paragraph. Software defines the
available options and decides what to do with the answer.

Its training method is **Reinforcement Learning for Calibrated Decisions**, or
**RLCD**. Calibration means that, across comparable predictions given an 80%
probability, roughly 80% should be correct. The point is practical: software can
use those probabilities to decide when to ask for human review.

RLHF learns from what people prefer; RLCD aims for decisions whose probabilities
reflect their reliability. Both use reinforcement learning. Jev changes the
target and narrows the model's role. In
[The Bitterest Lesson](https://typesafe.ai/blog/bitterest-lesson), Almeida's company
argues that choosing the right task matters before scaling the machinery.

This is a promising distinction, not a safety guarantee. A
[recent evaluation](https://arxiv.org/abs/2609.37647) found useful calibration on
choice tasks, but showed that rules for acting on other probabilities needed
adjustment for the task. It is an early study of the product, not proof that
RLCD alone accounts for the results. TypeSafe also
[documents susceptibility to adversarial input](https://docs.typesafe.ai/model-jaggedness/jev-1.13).
A well-formed answer can still be wrong; a reliable prediction does not make
every action based on it acceptable.

## Learning from examples

Another option is to teach through examples. Show a model good responses,
including honest uncertainty and occasions when it ought to stop, and train it to
produce similar behaviour. This is **supervised fine-tuning**, already used in
systems such as InstructGPT. It needs no RL at that stage, though the model still
has to apply the lessons correctly in situations the examples did not cover.

We can also teach directly from pairs of better and worse answers. A method
called [Direct Preference Optimisation](https://arxiv.org/abs/2305.18290) does this
without the separate reward model and conventional RL loop used by RLHF.
It simplifies training, but the quality of the preferences still matters. If
people favour confident agreement over truth, changing the procedure leaves
those judgements no wiser.

[Follow-up research](https://arxiv.org/abs/2406.02900) found that pushing this kind
of preference learning further could also make results worse. Those tests concerned
summarisation, not autonomous agents, but the distinction matters: leaving RL
behind does not automatically leave imperfect measures behind.

These methods can replace particular training stages, or work alongside RL.
They change how a model learns; we still need evidence that it learnt the right
behaviour.

## Predicting before acting

A robot given an image of where an object should end up faces a different kind
of lesson. It can learn how objects move, predict the effects of possible actions,
and use those predictions to choose its next move. It need not learn every task
by collecting rewards for completing it.

This is the approach explored in Yann LeCun's work: learning how a situation
changes supplies the knowledge; a separate planning process uses it towards a goal.

Meta's [V-JEPA 2 research](https://ai.meta.com/blog/v-jepa-2-world-model-benchmarks/)
provides a concrete example. It learns from video and robot data to build a
**world model**, a predictor of how the environment changes. Using the target
image, a robot can compare possible actions, take one, observe what happens and
plan again. Meta demonstrated robot manipulation without training on rewards
specific to those tasks.

That separation could reduce reliance on rewarded trial and error. But predicting
consequences better still leaves us to choose acceptable goals and actions. The
robotics results do not establish safe behaviour in general-purpose AI agents.

A world model can also help an agent [learn through rewards](https://danijar.com/project/dreamerv3/)
by letting it rehearse possible actions. Even then, its predictions do not
decide what merits a reward.

Bengio's [Scientist AI proposal](https://lawzero.org/en/publication/safety-honesty-disinterested-ai-predictor)
takes the separation further: it aims for an honest predictor without preferences
about the outcomes its predictions bring about. Any action-taking would sit in
explicit surrounding software. This remains a research proposal with assumptions
to test, rather than an established replacement for today's agents.

## The owner can remove the brakes

Training also cannot guarantee that its lessons will survive deliberate modification.
An **open-weight** model makes its parameters available to download and change.
In Anthropic's [assessment of GLM-5.3](https://www.anthropic.com/research/glm-5-3-and-the-spread-of-advanced-cyber-capabilities),
a modification suppressing refusal behaviour led the model to engage with all
50 simulated malicious trials in one test, compared with none for direct requests
to the unmodified model. Engagement meant attempting a connection, not completing
an attack.

This is a different problem: a malicious operator wants compliance. Anthropic
is also a competitor, and its comparison with hosted Claude cannot test weight
editing against a service that keeps its weights private. The finding illustrates
a limit on the durability of safeguards, not proof that RL caused the misconduct.
Once weights are distributed, their developer cannot assume its restrictions will
remain intact.

## Teaching an agent when to stop

The alternatives give us several choices: change what earns a reward, learn from
examples without RL, or learn to predict consequences and plan separately. Each
addresses part of the problem. None makes the intended behaviour self-evident.

Training should make appropriate stopping and accurate reporting part of success.
The software around the model must also limit what it can reach or change.
[NCSC's guidance](https://www.ncsc.gov.uk/blogs/managing-the-cyber-risk-of-agentic-ai)
provides practical ways to restrict access and contain failures.

AISI's [control evaluations](https://www.aisi.gov.uk/blog/how-to-evaluate-control-measures-for-ai-agents)
test whether defences hold against agents set up to evade them. That evidence can
support a **safety case**, a reasoned argument for a particular deployment.
It depends on the tests and capabilities involved; it is not a lifetime
membership certificate.

Before deploying or upgrading an agent, three questions deserve concrete answers:
what can it change, which actions need approval, and what evidence shows that the
controls still work with the new model?

The model that published its exploit had completed the requested task. The
agents that mistook an automated reply for permission had even stopped to ask.
Those are recognisable pieces of useful behaviour, carried beyond the point
where they were useful.

A high score tells us that a system satisfied a measure. We need to check that it
also learnt the limits that make success acceptable. When the next step requires
permission it does not have, completing the task is no longer the whole job.

Knowing when to stop should count as intelligence, too.
