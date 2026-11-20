---
schemaVersion: 1
id: "chronicles-ch01"
title: "Before Written Arithmetic"
summary: "Notched bones, tally marks and the limits of interpreting early records."
language: "en-GB"
publication:
  surfaces:
    - collection
    - book
slug: "chronicles-ch01"
tags: [ "history", "computing", "python", "data-representation" ]
draft: true
---

*Prehistory*

A broken baboon bone from Border Cave, in southern Africa, carries an incomplete sequence of twenty-nine notches. Under a microscope, the cuts reveal differences that a simple count misses: they were made with several tools, and some appear to have been added after others. Its polished surface suggests repeated handling. In a study published in 2012, Francesco d’Errico and his colleagues interpreted this accumulation of marks as possible notation. The object belongs to an archaeological sequence extending back more than forty thousand years, although its users left no written explanation of what they recorded.[^border-cave-records]

Often called the Lebombo bone, it has acquired a more definite identity in popular accounts as an early calendar or calculating device. Twenty-nine surviving marks invite comparison with the lunar month. Yet the sequence is broken, and evidence that marks were accumulated over time does not identify what prompted each addition. The researchers’ account recovers part of a working practice: someone kept an object and returned to it to make further marks. The physical evidence shows that the object was used, and what it was used for remains uncertain.

## Exact and approximate quantity

People often judge quantity without counting. Shown two heaps of fruit, most of us can tell at a glance which is larger. The impression grows less reliable as the heaps come closer in size. Studies among speakers of Amazonian languages with few or no words for exact numbers have separated estimates of this kind from the ability to keep an exact count. In 2004 Pierre Pica, Cathy Lemer, Véronique Izard and Stanislas Dehaene reported that speakers of Mundurukú, which has no number words beyond five, compared and added large quantities approximately, well beyond the range of those words. They made errors in exact arithmetic once the numbers passed four or five.[^munduruku-arithmetic]

A study published in 2008 by Michael Frank, Daniel Everett, Evelina Fedorenko and Edward Gibson worked with speakers of Pirahã, a language that, the authors concluded, has no way of expressing an exact quantity, not even one. Participants placed balloons to match a line of spools of thread, with sets of up to twelve. While the line stayed in view, they matched even the larger sets exactly. When it was hidden behind a folder after being laid out, or when the spools were dropped one at a time into an opaque container, their matches became approximate.[^piraha-matching]

Both groups are present-day communities with their own histories, and neither study describes how the people at Border Cave thought. The experiments separate two abilities that a record also keeps apart. Telling more from less requires no device. Keeping an exact quantity after the objects have gone requires something that persists. Frank and his colleagues described number words as a cognitive technology for that purpose. A notched bone does similar work outside the body and outlasts the memory of whoever cut it.

## Keeping a count

A tally shows how such a practice could preserve a quantity. Suppose each animal passing through a gate is matched by a mark on a piece of wood. After the animals have dispersed, the marks can still be counted. The person inspecting the wood need not have witnessed the passage through the gate, provided that they know what the marks represent and trust the recording. The example is invented to show how a tally works and says nothing about what was recorded at Border Cave.

The record separates the quantity from the things counted and changes the work required of memory. Without a record, the counter must retain the running total while attending to each new arrival, whereas with one the task is to make the correct mark and preserve the object. An interruption might cause an animal to be missed or counted twice without destroying the total already recorded. The record can be handed to someone else, compared with another count or consulted after the original occasion has been forgotten.

A short program demonstrates this correspondence. Python calls a sequence of text characters a *string*. Here the string begins empty, and a loop adds one mark on each of ten repetitions. The instruction `print` displays the record, while `len` returns its length.

```python
animals = 10
notches = ""
for _ in range(animals):
    notches += "|"
    print(notches)
print("Number of notches:", len(notches))
```

The stored marks are the program’s *state*: information retained while it runs. The loop changes that state according to a rule. Following this example requires none of the rest of Python, because each repetition has the same effect and counting the resulting characters gives ten. Before running it, predict the final line. Then change `animals` to seven and step through the loop to see the record grow one mark at a time. The computer can repeat the procedure, but the meaning of those marks comes from the person who chose the example.

::: {.callout-note appearance="simple" icon="false"}
A tally makes the cost of a representation visible. A count of ten takes ten marks and a count of ten thousand takes ten thousand. Grouping the marks can make them easier to inspect, while replacing a group with a distinct sign can reduce the space needed. Either change introduces a convention that the reader must learn, so the convenience of a shorter record depends on an agreement about how to interpret it.
:::

## A tally that outlived writing

Tallies remained in use long after people could write. From the twelfth century until 1826 the English Exchequer, the office that received and accounted for government income, issued notched sticks as receipts.[^exchequer-tallies] The *Dialogue of the Exchequer*, written about 1180, explains how a sum was cut. A notch as wide as the palm of a hand stood for a thousand pounds, one the breadth of a thumb for a hundred, a little finger’s width for twenty and a swollen barleycorn for a single pound. A shilling was narrower still, and a penny was a single cut that removed no wood. In Hilary Jenkinson’s description of surviving examples, each tally was a slip of hazel about eight inches long, smoothed until it was roughly square, with the details of the payment written on two sides and the notches cut on the other two.[^exchequer-tally-notches]

Once the notches were made, the stick was cut part of the way through near one end and split lengthwise from the other, the split passing through every notch. The larger piece, the *stock*, went to the person who had paid. The Exchequer kept the thinner *foil*. Both pieces carried the same notches, so at the final reckoning the two could be fitted together. A cut added to one of them afterwards had no partner on the other, nor could the grain along the split easily be imitated. The record carried its own check. Fitting the pieces did not depend on reading the writing on the sides.

The second program represents each piece as a list of notch names and gives each name its value. It totals the stock, which records an invented payment, compares the two pieces and then cuts an extra notch in the stock alone.

```python
# Notch widths follow the Exchequer convention. The payment is invented.
NOTCH_VALUES = {"palm": 1000, "thumb": 100, "little finger": 20, "barleycorn": 1}


def total(notches):
    return sum(NOTCH_VALUES[notch] for notch in notches)


stock = ["thumb", "little finger", "little finger", "barleycorn", "barleycorn"]
foil = list(stock)
print("Notches cut:", len(stock))
print("Stock records", total(stock), "pounds")
print("Halves match:", stock == foil)

stock.append("barleycorn")
print("Altered stock records", total(stock), "pounds")
print("Halves match:", stock == foil)
```

The pieces first agree on 142 pounds, recorded with five notches where the first program would need 142 marks. After the extra cut the stock claims 143 pounds and no longer matches the foil. The comparison works one position at a time and never uses the total, so a forged stock could be rejected before anyone added it up. Try removing a notch from the foil instead. Then make the same change to both lists: the check passes, because it can compare the two copies only with each other, and both now record a payment that was never made.

The end of the system is better remembered than its long use. After tallies were abolished, about two cartloads of old sticks were left behind. On 16 October 1834 they were burned in the two furnaces beneath the House of Lords, and the fire that followed destroyed most of the Palace of Westminster. Westminster Hall and the Jewel Tower were among the buildings that survived.[^tally-fire]

## The Ishango bone

Jean de Heinzelin found another prehistoric marked bone in 1950 during excavations near Ishango, on the Congolese shore of Lake Edward. About ten centimetres long, with a fragment of quartz at one end, it has groups of notches arranged along its sides. The Institute of Natural Sciences in Belgium, which holds it, dates it to nearly twenty thousand years ago. Among the groups are counts that can be paired as three and six, four and eight, or five and ten.[^ishango-object]

These arrangements have attracted proposals involving doubling, calendars and number systems. Vladimir Pletser’s base-twelve interpretation, presented in a paper deposited in 2012, treats the arrangement as a possible calculating aid.[^ishango-base-twelve] A later analysis by Jenny Baur examines relationships among the groups and proposes that the object may have served an arithmetic teaching purpose.[^ishango-arithmetic-study] Both papers interpret the surviving physical pattern, and neither is an established description of the maker’s intentions.

Some of the arithmetic is easy to reproduce, and nobody doubts that three doubled is six or that four doubled is eight. The historical question is whether those relationships explain why the marks were made. To answer it, a researcher decides which groups belong together, how to treat a damaged or ambiguous mark, and which relationships to test. Different choices can produce different accounts of the same object. A calculation shows the consequences of those choices, but cannot by itself establish that a prehistoric user made them.

## Tokens and envelopes

A notched bone records how many. In the Near East another practice recorded what had been counted as well. From the early farming villages onwards, people there shaped small pieces of clay into a few regular forms, among them cones, spheres, discs, cylinders, tetrahedrons and ovoids. Denise Schmandt-Besserat, who catalogued about eight thousand of these tokens from between about 9000 and 3100 BCE, argues that until about 3500 BCE they stood mostly for the products of farming, each shape for a unit of one kind of goods. In her account several measures of grain would be represented by as many tokens of one shape, a tally that also said what was being counted.[^schmandt-besserat-tokens]

As cities grew after about 3500 BCE, some tokens were strung together and fixed to a lump of clay, and others were sealed inside hollow clay balls, now usually called envelopes. An envelope could not be opened without being broken, which would have made it hard to alter the count unnoticed. It also hid the count from whoever held it. Some envelopes carried impressions of the tokens on their outer surface, pressed into the clay before it dried. A holder could then read the impressions without breaking the seal and break it later if a dispute arose. One such envelope from Susa, in south-western Iran, is in the Louvre (Sb 1932). It still contains its tokens, and its surface carries impressed signs and the marks of a seal.[^susa-envelope]

The impressions repeated what the tokens inside already recorded. In Schmandt-Besserat’s account, that repetition eventually made the tokens unnecessary. Signs pressed into a flat piece of clay could carry that information, and tablets bearing impressed signs replaced the envelopes and their contents. She treats the change from three-dimensional tokens to their two-dimensional impressions as the beginning of writing. Like the Exchequer’s split stick thousands of years later, the envelope kept one record in two forms, one to read and one to check it against.

## Records and their readers

The surviving objects are a small part of the material that people once handled. Bone can survive where wood or plant fibre does not, and a preserved object may have been exceptional rather than typical. Dating an artefact fixes its place in the surviving evidence and leaves open the question of when the practice began. Nor can the absence of writing be taken as the absence of a complex procedure passed on through demonstration and practice.

However the bones and tokens are interpreted, a quantity represented by marks can be retained, compared and communicated. Those operations depend on people who know the convention and can identify a mistake, and a perfectly preserved record becomes unreadable when that knowledge is lost.

Clay tablets provide more detailed evidence of those conventions. They can associate quantities with recognisable commodities and preserve repeated forms of accounting, which gives a later reader more to work with than a row of notches. What the twenty-nine marks from Border Cave counted is not known. On one early tablet the commodity can still be identified, and it is beer.

[^border-cave-records]: Francesco d’Errico et al., “Early Evidence of San Material Culture Represented by Organic Artifacts from Border Cave, South Africa”, Proceedings of the National Academy of Sciences 109, no. 33 (2012): 13214–13219, especially ‘Notched Bones’ and the discussion of successive marking; doi\:10.1073/pnas.1204213109. The authors describe an incomplete twenty-nine-notch sequence and evidence of several marking episodes, not a proved lunar calendar. [Open article](https://pmc.ncbi.nlm.nih.gov/articles/PMC3421171/).

[^munduruku-arithmetic]: Pierre Pica, Cathy Lemer, Véronique Izard and Stanislas Dehaene, “Exact and Approximate Arithmetic in an Amazonian Indigene Group”, Science 306, no. 5695 (2004): 499–503; doi\:10.1126/science.1102085. The abstract reports no number words beyond five, approximate comparison and addition of large numbers, and failure in exact arithmetic with numbers larger than four or five. [Record](https://pubmed.ncbi.nlm.nih.gov/15486303/).

[^piraha-matching]: Michael C. Frank, Daniel L. Everett, Evelina Fedorenko and Edward Gibson, “Number as a Cognitive Technology: Evidence from Pirahã Language and Cognition”, Cognition 108, no. 3 (2008): 819–824; doi\:10.1016/j.cognition.2008.04.007. The abstract reports exact matching of large sets and inaccuracy on tasks involving memory, and describes number words as a cognitive technology. The task details (spools and balloons, sets of four to twelve, the hidden line and the opaque container) are as reported from the same data in Michael C. Frank, Evelina Fedorenko and Edward Gibson, “Language as a Cognitive Technology: English-Speakers Match Like Pirahã When You Don’t Let Them Count”, Proceedings of the Annual Meeting of the Cognitive Science Society 30 (2008): 439–444. [Record](https://pubmed.ncbi.nlm.nih.gov/18547557/); [conference paper](https://escholarship.org/uc/item/7nm3w9k1).

[^exchequer-tallies]: Science Museum Group, “Medieval Exchequer Tally Sticks”, object 1952-431, collection record; sixteen stocks made about 1440. The record describes use from the twelfth to the nineteenth century, the division into stock and foil, matching as protection against forgery and abolition in 1826. [Source](https://collection.sciencemuseumgroup.org.uk/objects/co60506/medieval-exchequer-tally-sticks).

[^exchequer-tally-notches]: Hilary Jenkinson, on Exchequer tallies found at Westminster, Surrey Archaeological Collections 23: 203–207, on hazel slips about eight inches long, writing on two sides and notches on two, the cut and split, and the stock kept by the accounting officer and the foil by the Exchequer; the notch widths are those given in the *Dialogue of the Exchequer* (about 1180), as quoted in Pitt Rivers Museum, “Exchequer Tally”, object 1933.90.1, collection record. [Article](https://archaeologydataservice.ac.uk/catalogue/adsdata/arch-379-1/dissemination/pdf/vol_23/surreyac023_203-207_jenkinson.pdf); [museum record](https://odp-test.prm.ox.ac.uk/item/prm-object-126200/exchequer-tally).

[^tally-fire]: UK Parliament, “Tally Sticks”, Living Heritage, on the two cartloads left after abolition in 1826 and the decision to burn them in the furnaces, which led to the fire of 16 October 1834; the location of the furnaces below the House of Lords and the buildings that survived are as summarised in “Burning of Parliament”, Wikipedia. [Source](https://www.parliament.uk/about/living-heritage/building/palace/estatehistory/from-the-parliamentary-collections/fire-of-westminster/tallysticks/); [summary](https://en.wikipedia.org/wiki/Burning_of_Parliament).

[^ishango-object]: Institute of Natural Sciences, “The Ishango Bone”, collection exhibition record, sections describing discovery, dating and notch groups. The function of the object remains an interpretation. [Source](https://www.naturalsciences.be/en/museum/exhibitions-activities/exhibitions/250-years-of-natural-sciences/the-ishango-bone).

[^ishango-base-twelve]: Vladimir Pletser, “Does the Ishango Bone Indicate Knowledge of the Base 12? An Interpretation of a Prehistoric Discovery, the First Mathematical Tool of Humankind”, arXiv\:1204.1019 (4 April 2012). Cited for the author’s proposed interpretation, not as a settled identification. The repository lists Pletser as the author of this version. [Paper record](https://arxiv.org/abs/1204.1019).

[^ishango-arithmetic-study]: Jenny Baur, “The Ishango Bone: Evidence for Intentional Arithmetic Design in the Upper Palaeolithic?”, arXiv\:2504.06412v4 (17 May 2026; first deposited 8 April 2025 under an earlier title). Preprint; cited for the existence and character of the author’s arithmetic-teaching hypothesis. [Versioned record](https://arxiv.org/abs/2504.06412v4).

[^schmandt-besserat-tokens]: Denise Schmandt-Besserat, “The Invention of Tokens” and “Tokens”, author’s pages, University of Texas at Austin, on the catalogue of about eight thousand tokens dated about 9000–3100 BCE, the plain shapes, their use mostly for farm products before 3500 BCE, envelopes bearing impressions of their tokens and the replacement of tokens by impressed signs on tablets. The account of how tokens led to writing is the author’s interpretation. [Paper](https://sites.utexas.edu/dsb/tokens/the-invention-of-tokens/); [summary](https://sites.utexas.edu/dsb/tokens/tokens/).

[^susa-envelope]: Cuneiform Digital Library Initiative, “MDP 43, 581” (P285642), record of an administrative bulla with tokens from Susa, Louvre Museum Sb 01932, with seal impressions and numerical signs on the envelope surface; published in Pierre Amiet, *Glyptique susienne*, Mémoires de la Délégation archéologique en Iran 43 (1972), no. 581. [Record](https://cdli.earth/P285642).
