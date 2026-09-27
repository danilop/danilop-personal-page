---
schemaVersion: 1
id: "chronicles-ch01"
title: "Before Written Arithmetic"
summary: "Notched bones, tally marks and the limits of interpreting early records."
language: "en-GB"
publication: { "surfaces": [ "collection", "book" ] }
slug: "chronicles-ch01"
tags: [ "history", "computing", "python", "data-representation" ]
draft: true
---

*Prehistory*

A broken baboon bone from Border Cave, in southern Africa, carries an incomplete sequence of twenty-nine notches. Under a microscope, the cuts reveal differences that a simple count misses: they were made with several tools, and some appear to have been added after others. Its polished surface suggests repeated handling. In a study published in 2012, Francesco d'Errico and his colleagues interpreted this accumulation of marks as possible notation. The object belongs to an archaeological sequence extending back more than forty thousand years, although its users left no written explanation of what they recorded.[^border-cave-records]

Often called the Lebombo bone, it has acquired a more definite identity in popular accounts as an early calendar or calculating device. Twenty-nine surviving marks invite comparison with the lunar month. Yet the sequence is broken, and evidence that marks were accumulated over time does not identify what prompted each addition. The researchers' account is interesting precisely because it recovers part of a working practice: someone kept an object and returned to it to make further marks. Its purpose remains less certain than the physical evidence of its use.

## Keeping a count

A tally shows how such a practice could preserve a quantity. Suppose each animal passing through a gate is matched by a mark on a piece of wood. After the animals have dispersed, the marks can still be counted. The person inspecting the wood need not have witnessed the passage through the gate, provided that they know what the marks represent and trust the recording. This is an invented example of a tally's operation, rather than an explanation of the Border Cave object.

The record separates the quantity from the things counted. It also changes the work required of memory. Without a record, the counter must retain the running total while attending to each new arrival; with one, the counter must make the correct mark and preserve the object. An interruption might still cause an animal to be missed or counted twice, but it need not destroy the total already recorded. The record can be handed to someone else, compared with another count or consulted after the original occasion has been forgotten.

A short program demonstrates this correspondence. Python calls a sequence of text characters a *string*. Here the string begins empty, and a loop adds one mark on each of ten repetitions. The instruction `print` displays the record, while `len` returns its length.

```python
notches = ""
for _ in range(10):
    notches += "|"
    print(notches)
print("Number of notches:", len(notches))
```

The stored marks are the program's *state*: information retained while it runs. The loop changes that state according to a rule. There is no need to understand the rest of Python to follow this example; each repetition has the same effect, and counting the resulting characters gives ten. Changing the number of repetitions to seven produces seven marks. The computer can repeat the procedure, but the meaning of those marks still comes from the person who chose the example.

A tally also makes the cost of a representation visible. A count of ten takes ten marks; a count of ten thousand takes ten thousand. Grouping the marks can make them easier to inspect, while replacing a group with a distinct sign can reduce the space needed. Either change introduces a convention that the reader must learn. The convenience of a shorter record depends on an agreement about how to interpret it.

## The Ishango bone

Jean de Heinzelin found another marked bone in 1950 during excavations near Ishango, on the Congolese shore of Lake Edward. About ten centimetres long, with a fragment of quartz at one end, it has groups of notches arranged along its sides. The Institute of Natural Sciences in Belgium, which holds it, dates it to nearly twenty thousand years ago. Among the groups are counts that can be paired as three and six, four and eight, or five and ten.[^ishango-object]

These arrangements have attracted proposals involving doubling, calendars and number systems. Vladimir Pletser's base-twelve interpretation, presented in a paper deposited in 2012, treats the arrangement as a possible calculating aid. It is one explanation of the physical pattern, rather than an established description of the maker's intentions.[^ishango-base-twelve] A later analysis by Jenny Baur, first deposited in 2025 and revised in 2026, examines relationships among the groups and proposes that the object may have served an arithmetic teaching purpose. The paper remains an interpretation of the surviving evidence.[^ishango-arithmetic-study]

It is easy to reproduce some of the arithmetic. Three doubled is six, and four doubled is eight; neither calculation is in doubt. The historical question is whether those relationships explain why the marks were made. A researcher must decide which groups belong together, how to treat a damaged or ambiguous mark, and which relationships to test. Different choices can produce different accounts of the same object. A calculation establishes the consequences of those choices, but cannot by itself establish that a prehistoric user made them.

The following example keeps that distinction visible. It stores three proposed pairs and calculates whether the second count is twice the first. The pairs are selected from the groups described by the museum; they are not a transcription of every notch on the bone.

```python
pairs = [(3, 6), (4, 8), (5, 10)]
for first, second in pairs:
    print(first, second, second == 2 * first)
```

All three comparisons return `True`. The result confirms the arithmetic relationship for the selected pairs. It provides no date, no identification of a user and no account of what the other groups meant. The program is useful because its small claim can be inspected: change one count and the corresponding comparison changes. Its limits are equally clear from what it has been given to work with.

## Records and their readers

The surviving objects are a small part of the material that people once handled. Bone can survive where wood or plant fibre does not, and a preserved object may have been exceptional rather than typical. Dating an artefact establishes something about its place in the surviving evidence; it does not establish when the practice began. Nor can the absence of writing be taken as the absence of a complex procedure passed on through demonstration and practice.

The uncertainty surrounding the bones concerns their interpretation, not the general usefulness of external records. Once a quantity is represented by marks, it can be retained, compared and communicated. Those operations still depend on people who know the convention and can identify a mistake. A perfectly preserved record may become unreadable when that knowledge is lost.

Clay tablets provide more detailed evidence of those conventions. They can associate quantities with recognisable commodities and preserve repeated forms of accounting. On one early tablet now in the British Museum, the commodity is beer. Its numerical signs were part of an administrative practice sufficiently explicit for later readers to investigate what was being recorded, giving the next part of this history firmer evidence about both the marks and their use.

[^border-cave-records]: Francesco d'Errico et al., ‘Early Evidence of San Material Culture Represented by Organic Artifacts from Border Cave, South Africa’, Proceedings of the National Academy of Sciences 109, no. 33 (2012): 13214–13219, especially ‘Notched Bones’ and the discussion of successive marking; doi\:10.1073/pnas.1204213109. The authors describe an incomplete twenty-nine-notch sequence and evidence of several marking episodes, not a proved lunar calendar. [Open article](https://pmc.ncbi.nlm.nih.gov/articles/PMC3421171/).

[^ishango-object]: Institute of Natural Sciences, “The Ishango Bone”, collection exhibition record, sections describing discovery, dating and notch groups. The function of the object remains an interpretation. [Source](https://www.naturalsciences.be/en/museum/exhibitions-activities/exhibitions/250-years-of-natural-sciences/the-ishango-bone).

[^ishango-base-twelve]: Vladimir Pletser, ‘Does the Ishango Bone Indicate Knowledge of the Base 12? An Interpretation of a Prehistoric Discovery, the First Mathematical Tool of Humankind’, arXiv\:1204.1019 (4 April 2012). Cited for the author's proposed interpretation, not as a settled identification. The repository lists Pletser as the author of this version. [Paper record](https://arxiv.org/abs/1204.1019).

[^ishango-arithmetic-study]: Jenny Baur, ‘The Ishango Bone: Evidence for Intentional Arithmetic Design in the Upper Palaeolithic?’, arXiv\:2504.06412v4 (17 May 2026; first deposited 8 April 2025 under an earlier title). Preprint; cited for the existence and character of the author's arithmetic-teaching hypothesis. [Versioned record](https://arxiv.org/abs/2504.06412v4).
