---
schemaVersion: 1
id: "chronicles-introduction"
title: "Introduction"
summary: "How to read this practical history of computing."
language: "en-GB"
publication: { "surfaces": [ "collection", "book" ] }
slug: "chronicles-introduction"
tags: [ "history", "computing", "programming", "python" ]
draft: true
---

Writing a program involves deciding how to represent information, which operations to allow and how to check the result. People addressed related problems long before electronic computers existed, using counting records, mathematical procedures and mechanical calculators. Their methods help explain the later development of programming and software engineering, including the systems that now generate text and images and act through tools.

The intended reader is curious about computing and wants to understand why its methods developed. You may be beginning to program, working alongside software teams or returning to familiar ideas with an interest in their origins. You need ordinary arithmetic and a willingness to follow a few procedures. No previous knowledge of programming, computer architecture, calculus or machine learning is assumed. The text explains each technical term when it becomes necessary; the Python appendix explains the notation used in the examples.

The chapters follow broad historical periods. Within a period, related developments sometimes run alongside one another, and a later system may require a brief reference to an earlier idea. Dates identify the period being discussed rather than suggesting that one invention ended when another began. The subject index helps you follow a particular topic across those periods without repeating its full explanation each time.

The accounts draw on surviving objects, contemporary documents, research papers and attributed recollections. Some sources describe a calculation or failure in detail; others establish that an object existed while leaving its purpose or influence uncertain. Modern examples use invented inputs unless a source is identified, and the text distinguishes those illustrations from reconstructions of historical work.

## What the history is useful for

Computing developed through efforts to solve particular problems. A census required records to be counted; a mathematical table required repeated calculations; a shared computer required a way to allocate time; a network service required a way to continue when a component failed. The resulting methods are easier to understand when their original constraints are visible. A design that seems awkward in isolation may have been a reasonable response to cost, limited memory or the need to preserve existing work.

For a beginning programmer, these accounts provide context for ideas that otherwise arrive as disconnected rules. For an experienced programmer, they offer a way to reconsider familiar decisions and distinguish a useful principle from a convention that belongs to a particular period. Readers working with software teams can use the same accounts to understand why apparently small changes sometimes require substantial investigation.

The emphasis is on computation, programming and the engineering of software. Hardware appears where it changes what programs can do or who can use them. Business arrangements and institutions appear where they affect access, cooperation and maintenance. This is a selective history rather than a catalogue of every machine or programming language, and the sources allow a reader to pursue subjects beyond the account given here.

The chronological order also makes coexistence visible. A newer technique rarely removes all the work done with older ones. Mechanical calculators continued after electronic computers appeared; procedural, functional and object-oriented methods remained useful alongside one another; generated programs still depended on languages, libraries and operating systems developed through earlier work. Later chapters refer back to those mechanisms when a new application gives them a different purpose.

## Reading and running the examples

You can read the narrative without running code. Each example has one main purpose, and the surrounding paragraphs explain what to observe. When you do run one, change a small input and compare the new result with what you expected. A procedure becomes easier to understand when you can identify which step caused an answer to change.

The examples use **Python 3.14**, tested with **Python 3.14.7**, and only its standard library. No account, network connection or additional package is required to run them. Save a complete example to a file such as `example.py`, open a terminal in that folder and enter `python3 example.py`; on some systems the command is `python`. The appendix gives a brief introduction for readers who have not used Python before. Python itself is available from the [Python Software Foundation](https://www.python.org/downloads/).

Each example contains the operations needed to explain its subject. Where an algorithm is the subject, its steps are written out; supporting work uses standard-library functions where these simplify the code. The surrounding text states the inputs and limitations, particularly for cryptography, distributed systems and machine learning.

The final agent example uses a fixed decision function in place of a language model. It observes the results of executed tests, applies an available repair and verifies completion, so the control loop can be studied without running a trained model.

## Following the sources

Numbered citations lead to chapter-grouped notes at the end of the book. Each note identifies the work and, where useful, the passage, section, object record or experiment supporting the account. Sources were reviewed during the September 2026 revision, with the latest evidence check on 19 September 2026. The final AI chapters describe selected published results available by that date; they are a history of methods and evidence, not a ranking of current products.

The historical cases explain practical decisions such as separating data from operations, retaining earlier states and checking the outcome of an automated task. The examples allow readers to examine how those decisions affect a program, while the sources provide the evidence for the historical account.
