---
schemaVersion: 1
id: leaving-tools-out-for-visiting-agents
title: Leaving Tools Out for Visiting Agents
summary: Adding search, WebMCP tools and an on-device reading assistant to this site.
language: en-GB
draft: true
publication:
  surfaces: [standalone]
slug: leaving-tools-out-for-visiting-agents
tags: [ai, computing, website]
---

More visitors now bring an assistant with them. Some ask an AI browser to read a
page; others let an agent click through it on their behalf. The agent usually
works from what it can see. It reads the rendered page, looks at a screenshot and
guesses what each button does.

This site now gives those agents a more direct route. It describes a small set of
tools they can call to search the writing, read or jump to a section, play the
narration and run the Python examples. I also added two features for readers who
have no agent at all. One is search. The other is an assistant that explains
the current article with a model that runs in your own browser.

## A standard in waiting

The tools use [WebMCP](https://webmachinelearning.github.io/webmcp/). A page
registers functions that an agent in the browser can call, each with a name, a
description and a schema for its input. The idea comes from the Model Context
Protocol, which connects AI applications to tools. Here the tools live in the page
the reader already has open.

WebMCP is a draft from the W3C’s Web Machine Learning Community Group. It is not a
web standard. Chrome offers it behind a flag and through an
[origin trial](https://developer.chrome.com/blog/ai-webmcp-origin-trial), which
lets registered sites try an experimental feature for a limited time. Microsoft
lists it as ready for testing in Edge. Mozilla’s position is
[neutral](https://github.com/mozilla/standards-positions/issues/1412).

WebKit, the engine behind Safari,
[opposes it](https://github.com/WebKit/standards-positions/issues/670). Its first
objection is that a separate tool layer can drift away from the page it describes.
It argues that agents could use the accessibility information sites should provide
anyway, as screen readers do. It also points out that announcing “an agent is
driving” invites sites to treat those visitors differently. I found all three
arguments hard to dismiss.

Agents have started to use WebMCP regardless. The
[ChatGPT desktop browser](https://www.searchenginejournal.com/chatgpt-adds-webmcp-support/587237/)
calls site tools by default. Shopify has
[opened checkout](https://techcrunch.com/2026/09/28/shopify-opens-checkout-to-browser-based-ai-agents/)
to browser-based agents. A personal website has rather less to sell, so it seemed
a safe place to try the idea.

## Tools that press real buttons

WebKit’s point about drift shaped the design. Each tool uses a control that is
already on the page. None can do anything a reader could not do with a mouse.

When an agent runs a Python example, it follows the same code path as the **Run**
button. The code runs in the same isolated sandbox with the same time limit. If the
agent edits the code first, the edit appears in the editor, where the reader can
restore the original. Moving to a section scrolls the page and moves the focus, as
an ordinary link would. Playing the narration presses the visible play button.
Browsers often block audio that starts without a reader’s click, so this can fail.
The tool then says so instead of trying harder.

Whenever an agent acts, the page shows a notice such as “An AI agent moved to
‘Permission to proceed’”. Screen readers announce it. Where it makes sense, the
notice offers **Undo**. No tool can download a model, share a page or change a
privacy setting. A [For AI agents](/agents/) page lists the tools and has a switch
that turns them off in your browser.

::block{ref="page-tools"}

The search form needed no code at all. WebMCP can turn an ordinary HTML form into a
tool with a few attributes. In my first test the agent filled in the query, then
waited for someone to press **Search**, like a guest who will not start eating
before the host. One more attribute allows it to submit the form itself. Search
changes nothing, so I let it.

## Search, which needs no AI

I have found search the most useful addition. It involves no model.
[Pagefind](https://pagefind.app/) builds an index when the site is published. The
browser then searches that index locally, so queries never leave the page. The
[search page](/search/) works in every browser. Pressing `/` on any page opens it.

One piece of writing can appear both as an article and as a book chapter. Search
lists it once, as the article, with a note naming the book.

## A model in the reader’s browser

The assistant answers questions about the page you are reading. It shows which
sections it read and links to the ones it cites. Your questions stay in your
browser. There is no fallback to a model in the cloud.

Some browsers include a model of their own. Chrome on capable desktops offers
Gemini Nano through its [Prompt API](https://developer.chrome.com/docs/ai/prompt-api).
Edge is testing a similar interface. The assistant uses the browser’s model
where one exists. Other browsers with WebGPU get the offer of a download.

To choose the model to download, I tested candidates on questions about this site’s articles.
Through [WebLLM](https://webllm.mlc.ai/) I gave several small models sections from
these pages, with questions whose answers I knew and a few they should decline. A
Qwen model with 1.7 billion parameters did best, with a download of about 1 GB.

I then tried Gemma 4 E2B. Its model card quotes 0.8 GB. That is the memory the
model needs on a phone. The downloads I found weigh between 2.0 and 2.4 GB,
because a web build must still download the embedding tables. Native apps can leave those tables on disk, which is why the model card’s figure is smaller.
Google’s [web build](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm),
run through the [LiteRT-LM](https://ai.google.dev/edge/litert-lm/js) library, got
every question in that small test right and cited only the correct section. The
same model through WebLLM was slower and less accurate. In this test, the runtime
made as much difference as the model.

The panel now offers that 2 GB download. Before anything starts, it says how
large the model is and where it comes from. The model then stays in the browser
until you clear it. On my laptop the first download took a little over two
minutes, long enough to put the kettle on. Later visits are ready in about three
seconds.

## The small print

LiteRT-LM can force a model’s tool calls to be well formed. In the version I used,
that option broke every turn after the first tool result. The error message said
little more than “Invalid token”. With the option off, the conversation worked, so
the site now checks each call itself.

When the assistant could search the whole site, the model kept searching for things
that were on the page in front of it. I replaced site search with a smaller tool
that finds matching sections on the current page. With nowhere else to look, the
model stayed on the page.

Text before an article’s first heading needed a section of its own, so I called it
the introduction. For a while the introduction contained the whole article. The
page wraps its text in a single container. My code had taken that container at
its word.

One failure was politer than the rest. I asked about a price the article never
mentions. The model replied that the page did not state it, which was correct. It
then cited a paragraph as the source of that absence. The assistant now treats an
answer like that as not found and shows no source.

After these fixes, the assistant answered every answerable question in its test set
with the right citation. It also declined every question the articles cannot
answer. The set is small and grows with each published article. I rerun it after
every change to catch regressions. It does not tell us how often a small model is
right in general.

## The cookie banner got there first

On the live site, my first question went unasked. The cookie consent banner had
appeared before the panel and was standing in front of the **Ask** button. Local
builds have analytics switched off, so none of my tests had shown the banner.

While the panel is open, it now sits above the banner.

## Limits

The assistant is a small model running on your device, so it can be wrong. Each
answer shows what the model read and where its citations point. The text remains
the reference. The assistant looks only at the current page and forgets earlier questions.

The agent tools work in browsers that offer WebMCP. This site is registered for
the Chrome and Edge trials, which end in March 2027. Elsewhere it means browsers
where someone has switched WebMCP on by hand. That is a modest audience, roughly
the people who read browser flag pages for pleasure.

WebMCP may never become a standard. If it does not, removing the WebMCP layer is
easy. The assistant calls the same tools directly and does not need the browser to
offer them to agents. If WebMCP does become a standard, WebKit’s objections should
still guide the design. Tools should mirror visible controls. Readers should see
what an agent did and be able to undo it.
