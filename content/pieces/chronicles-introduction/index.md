---
schemaVersion: 1
id: "chronicles-introduction"
title: "Introduction"
summary: "How to read this practical history of computing."
language: "en-GB"
publication:
  surfaces:
    - collection
    - book
slug: "chronicles-introduction"
tags: [ "history", "computing", "programming", "python" ]
draft: true
---

On 6 May 1949 a computer at the University of Cambridge worked for the first time. William Renwick, the project’s chief engineer, opened a log and recorded the result. The machine, called EDSAC, had printed a table of the squares of the numbers from 0 to 99, and the program had taken two minutes and thirty-five seconds. The entry for the following day reports that the squares were run several more times and that a second program, meant to print a table of prime numbers, was attempted and found to be incorrect. In the same entry Renwick notes that one of the units needed another amplifier. On 9 May a corrected program ran for nearly two hours and printed the primes up to 1,500.

Renwick recorded all of this as the routine of a working day, which is why the book begins with his log. An experimental computer in Manchester had already run a program held in its own memory the year before. EDSAC was built to do calculations for the university’s researchers. Its log happens to preserve, within a few lines, the two kinds of trouble that a working computer gives. The amplifier concerned the machine. The table of primes concerned the instructions, written by people who knew what they wanted and had told the machine something else.

A long history stands behind that second kind of trouble. Before a program could be wrong, there had to be a way of writing a quantity down so that someone else could read it, and procedures stated exactly enough to be followed by a person who did not know why they worked. There had to be machines that carried a calculation through several steps unattended, and then a means of changing those steps without rebuilding the machine. The first eight chapters follow that history through what survives of it: a bone with notches cut into it, a clay tablet that counts jars of beer, a papyrus of worked problems, bronze gears recovered from the sea, a loom controlled by punched cards, a census that took seven years to add up, a paper of 1936 describing a machine that consists of a tape and a table of rules, and a wartime calculator whose connections and switches had to be set again for each new problem.

What followed takes up more of the book, though it covers fewer than eighty years. Once a machine could be given a wrong program, saying what was meant and finding out whether it had been said took up a growing share of the effort in computing. The later chapters start with languages in which a calculation could be written as a formula. In one of them two people enter the same command at neighbouring terminals at four in the morning, and in another a guidance computer raises alarms during the first landing on the Moon. Further on, strangers agree on a secret in public, an operating system is announced as “just a hobby” and a telephone puts the software in its owner’s pocket. The last chapters describe programs that propose repairs to other programs, and the checks that decide whether a repair has worked.

On both sides of the Cambridge log the same decisions return. Somebody has to choose how to represent the information, which operations to allow on it and how to check the result. A scribe dividing rations made those choices, as does the author of a database or of a system that generates text. They are easier to recognise in their present form after seeing them made in clay and in brass.

## What the history is useful for

Computing developed through efforts to solve particular problems. Census records had to be counted and mathematical tables required repeated calculations, while a shared computer had to divide its time among users and a network service had to continue when a component failed. The resulting methods are easier to understand when their original constraints are visible. A design that seems awkward in isolation may have been a reasonable response to cost, limited memory or the need to preserve existing work.

::: {.callout-note appearance="simple" icon="false"}
For a beginning programmer, these accounts provide context for ideas that otherwise arrive as disconnected rules. An experienced programmer can use them to reconsider familiar decisions and to distinguish a principle worth keeping from a convention that belongs to one period. For readers working with software teams, they explain why apparently small changes sometimes require substantial investigation.
:::

The emphasis is on computation, programming and the engineering of software. Hardware appears where it changes what programs can do or who can use them, and business arrangements and institutions where they affect access to computers or cooperation between the people who write and maintain programs. The history is selective and omits many machines and programming languages, although the sources allow a reader to pursue subjects beyond the account given here.

The chronological order makes coexistence visible, because a newer technique rarely removes all the work done with older ones. Mechanical calculators continued in use after electronic computers appeared, and procedural, functional and object-oriented methods have remained in use alongside one another. Generated programs depend on languages, libraries and operating systems developed through earlier work. Later chapters refer back to those mechanisms when a new application gives them a different purpose.

## How the book is arranged

The intended reader is curious about computing and wants to understand why its methods developed. You may be beginning to program, working alongside software teams or returning to familiar ideas with an interest in their origins. You need ordinary arithmetic and a willingness to follow a few procedures. No previous knowledge of programming, computer architecture, calculus or machine learning is assumed. The text explains each technical term when it becomes necessary, and the Python appendix explains the notation used in the examples.

The chapters follow broad historical periods. Within each one, related developments sometimes run alongside one another, and a later system may require a brief reference to an earlier idea. The dates say which years a chapter discusses; an invention described in one chapter usually remained in use during the next. The subject index helps you follow a topic across those periods without repeating its full explanation each time.

The accounts draw on surviving objects, contemporary documents, research papers and attributed recollections. Some sources describe a calculation or failure in detail, while others establish that an object existed and leave its purpose or influence uncertain. Unless a source is cited, the input values in the Python examples were chosen to make the method easy to follow and are not historical measurements or records.

## Reading and running the examples

You can read the narrative without running code. Each example has one main purpose, and the surrounding paragraphs explain what to observe. When you do run one, change a small input and compare the new result with what you expected. A procedure becomes easier to understand when you can identify which step caused an answer to change.

The examples are written for Python 3.14 or later and use only the standard library. No account, network connection or additional package is required to run them. Save a complete example to a file such as `example.py`, open a terminal in that folder and enter `python3 example.py`. On some systems the command is `python`. The appendix gives a brief introduction for readers who have not used Python before, and the language can be downloaded from the [Python Software Foundation](https://www.python.org/downloads/).

Each example contains the operations needed to explain its subject. Where an algorithm is the subject, its steps are written out, while supporting work uses standard-library functions where these simplify the code. The surrounding text states the inputs and limitations, particularly for cryptography, distributed systems and machine learning.

The final agent example uses a fixed decision function in place of a language model. It observes the results of executed tests, applies an available repair and verifies completion, so the control loop can be studied without running a trained model.

## Following the sources

Numbered citations lead to chapter-grouped notes at the end of the book. Each note identifies the work and, where useful, the passage, section, object record or experiment supporting the account.

The examples let a reader examine how a decision affects a program, and the notes give the evidence for the historical account. The first chapter begins before writing, with marks cut into a bone by someone who later came back and added more.
