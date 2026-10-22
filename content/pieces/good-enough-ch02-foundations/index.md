---
schemaVersion: 1
id: good-enough-ch02-foundations
title: What a local minimum means
summary: A four-choice example explains objectives, feasible choices and why a
  local search can stop short of the best result.
language: en-GB
publication:
  surfaces:
    - collection
    - book
slug: good-enough-ch02-foundations
tags:
  - decision-making
  - systems-thinking
draft: true
---

In 1983, Scott Kirkpatrick, C. D. Gelatt and M. P. Vecchi published a method for solving difficult optimisation problems by borrowing an idea from the cooling of materials. Their examples included arranging the components of a computer design and finding routes through a set of locations. The method could retain a proposed arrangement even when its calculated cost was higher than the current one. As the search continued, it became less willing to accept such changes. They called the procedure *simulated annealing*. [^good-enough-ch02-3]

The comparison did specific work. A physical process suggested a rule that could be written down, implemented and examined. The result was not an instruction to endure difficulty on the assumption that something better would follow. To use the method, a programmer had to define a problem: the arrangements that could be considered, the cost of each and the changes that the search could attempt. These requirements also provide a useful way to understand the word *minimum* in the title of this book.

We can begin with a small calculation whose entire result is visible. It is deliberately much simpler than the problems in the paper. Its purpose is to let us examine exactly what a local search does, without having to trust an inaccessible calculation or imagine a person wandering through a landscape.

## A choice with four possible arrangements

Suppose a system has two settings, A and B, each of which can be either off or on. There are four arrangements: both off, only A on, only B on, or both on. Assign a cost to each arrangement, as shown below. These are invented numbers in a teaching example, not measurements from a factory, a household or a study.

| Setting A | Setting B | Cost |
|---|---|---:|
| Off | Off | 10 |
| On | Off | 12 |
| Off | On | 11 |
| On | On | 6 |

The aim is to find the arrangement with the lowest cost. Because the table is small and complete, we can immediately see the answer: switch both settings on, giving a cost of six. There is no uncertainty about this result within the example. There is also no cost of inspecting a row, no disagreement about the numbers and no change in the costs while we consider them.

Now give a search procedure a more limited rule. It begins with both settings off, and on each step it may change only one setting. It accepts a change only if that change reduces the cost. From its starting arrangement, it has two candidates. Switching A on raises the cost from ten to twelve. Switching B on raises it from ten to eleven. The procedure rejects both and stops.

It has followed its instructions correctly, which is not quite the same as being helpful. Neither permitted change improves the result. Yet it has not selected the cheapest arrangement in the table. It cannot reach the arrangement costing six by a sequence in which it changes one setting at a time and accepts only reductions. If it changes B first, it must accept eleven before reaching six; if it changes A first, it must accept twelve before reaching six.

The result depends on the combination of the costs and the search rule. Allow both settings to change together, and the procedure can move directly from ten to six. Start with only A on, and switching B on also leads directly to six. Keep the original starting point and single-setting rule but permit an initial increase, and a route becomes available. These are three distinct alterations to the procedure. None requires changing the numbers in the table.

This is the central distinction between finding no improvement among the changes examined and establishing that no improvement exists. In the small example, we can prove that another improvement exists because we can inspect every arrangement. In a large problem, we may not be able to do that. Failure to find something better then leaves two possibilities: the current solution may be the best, or the search may have missed a better one.

## The objective and the feasible choices

An *objective function* is the rule assigning a value to each candidate solution. In our example, the cost column supplies that rule. To minimise the objective is to seek its lowest value. The *feasible set* contains the solutions permitted by the problem’s constraints. Here, all four arrangements are feasible. [^good-enough-ch02-1]

It is useful to keep feasibility separate from the way the search proceeds. Both settings being on is a feasible arrangement in the example, even though the specified procedure cannot reach it from the chosen starting point. An impossible arrangement and one that a particular method fails to find are different things. Confusing them can make a limitation of the procedure look like a limitation of the problem itself.

We could also change the example by imposing a constraint that forbids both settings from being on together. In that revised problem, six would no longer be an available cost. Both settings off would be the best feasible arrangement, at ten. Continuing to call it an inferior solution would compare it with an option that the new problem explicitly excludes.

In an actual decision, the status of a constraint needs investigation. A legal requirement, a physical impossibility, a contractual commitment and a manager’s preference may all appear as restrictions, but they are not interchangeable. Some can be changed by the people making the decision; others require action elsewhere; some cannot be changed at all within the relevant period. The calculation begins after these distinctions have been represented in the model. It cannot supply the distinctions by itself.

The objective needs similar care. Our invented cost is a single number, and a lower number is preferable by definition. A household considering a change to its working hours may instead care about income, time together, travel and predictability. An organisation may need to consider service quality as well as expenditure. These concerns can be represented through multiple measures, explicit trade-offs or requirements that an acceptable choice must satisfy. Reducing them to one score is a modelling decision that should be explained.

The word *cost* can also conceal the person bearing it. A proposal may reduce an organisation’s expenditure by requiring customers to do more work. In a model that records expenditure alone, the proposal appears to improve the objective. The calculation is not necessarily wrong; the stated objective may be incomplete for the decision being considered. Chapter 9 examines what follows when a measure is used as if it represented more than it actually includes.

## What counts as nearby

In a discrete search such as our four-arrangement example, a *neighbourhood* can be defined by the changes permitted in a single step. Changing one setting gives a different neighbourhood from changing either or both settings. A solution is locally optimal under the chosen neighbourhood if none of the alternatives in that neighbourhood has a better objective value. [^good-enough-ch02-1]

This definition explains why the rule matters. Both settings off is a local minimum under the single-setting rule. It ceases to be one when changing both settings together is permitted, because the arrangement costing six becomes an immediately available improvement. There is no contradiction: we have changed what *local* means in the search.

In a continuous problem, the variables can change by arbitrarily small amounts, and the definition uses sufficiently small neighbourhoods around a point. A local minimum has a value no greater than any feasible value in some such neighbourhood. A *global minimum* has a value no greater than that of every feasible solution in the whole problem. A global minimum is also local; the two terms do not identify mutually exclusive categories. [^good-enough-ch02-1]

The distinction is narrower than saying that a situation is bad or that someone has become complacent. It concerns a specified objective, a specified set of alternatives and a specified meaning of nearby. Our arrangement costing ten is not described as a local minimum because ten feels expensive. It receives that description because of its relationship to the arrangements costing eleven and twelve under the permitted changes.

When later chapters consider organisations, the equivalent of a permitted change must be established from the circumstances. A department might be able to revise its own procedure but lack the authority to alter another department’s work. Two changes that would make sense together may therefore be assessed separately. That can resemble the structure of the example, but the resemblance becomes useful only when the actual dependencies and decision rights have been identified.

[^good-enough-ch02-3]: S. Kirkpatrick, C. D. Gelatt Jr. and M. P. Vecchi, “Optimization by Simulated Annealing”, *Science* 220, no. 4598 (1983): 671–680, <https://doi.org/10.1126/science.220.4598.671>, especially pp. 671–673 for the problem and method and pp. 674–679 for applications. Full text (accessed 19 September 2026): <https://hedibert.org/wp-content/uploads/2013/12/1983KirkpatrickGelattVecchi.pdf>. The annealing comparison defines a computational procedure; it does not establish a general rule for institutional change.

[^good-enough-ch02-1]: Stephen Boyd and Lieven Vandenberghe, *Convex Optimization* (Cambridge University Press, 2004), sections 4.1.1 and 4.2.2, especially printed pp. 128 and 138, for feasible, local and global optima; chapter 9 for descent methods. Author-hosted text: <https://www.seas.ucla.edu/~vandenbe/cvxbook/bv_cvxbook.pdf> (accessed 19 September 2026). For discrete local search, see Stuart Russell and Peter Norvig, *Artificial Intelligence: A Modern Approach*, 4th ed. (Pearson, 2021), chapter 4; the authors’ online algorithm collection, <https://aima.cs.berkeley.edu/algorithms.pdf>, Figure 4.2, states the improvement-only neighbour rule. The four-arrangement table in this chapter is an original teaching example, not an empirical dataset.
