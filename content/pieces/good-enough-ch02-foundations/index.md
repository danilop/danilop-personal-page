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

A physical process had suggested a rule that could be written down, implemented and examined. To use the method, a programmer had to define a problem: the arrangements that could be considered, the cost of each and the changes that the search could attempt. The same three requirements explain the word *minimum* in the title of this book.

We can begin with a small calculation whose entire result is visible. It is much simpler than the problems in the paper, and small enough that every step of a local search can be checked by hand.

## A choice with four possible arrangements

Suppose a system has two settings, A and B, each of which can be either off or on. There are four arrangements: both off, only A on, only B on, or both on. Assign each arrangement a cost, invented for the example and shown below.

| Setting A | Setting B | Cost |
|---|---|---:|
| Off | Off | 10 |
| On | Off | 12 |
| Off | On | 11 |
| On | On | 6 |

The aim is to find the arrangement with the lowest cost. Because the table is small and complete, we can immediately see the answer: switch both settings on, giving a cost of six. Within the example there is no uncertainty about this result, no cost of inspecting a row, no disagreement about the numbers and no change in the costs while we consider them.

Now give a search procedure a more limited rule. It begins with both settings off, may alter only one setting on each step and accepts a move only if it reduces the cost. From its starting arrangement, it has two candidates. Switching A on raises the cost from ten to twelve and switching B on raises it to eleven. Having rejected both, the procedure stops.

It has followed its instructions correctly, which is not quite the same as being helpful. Neither permitted change improves the result, yet the procedure has not selected the cheapest arrangement in the table. It cannot reach the arrangement costing six by a sequence in which it changes one setting at a time and accepts only reductions. Changing B first means accepting eleven on the way to six, and changing A first means accepting twelve.

![**Figure 2.1.** The four arrangements of the worked example. Grey lines join arrangements that differ in one setting, arrows point to the lower cost, and the dashed line changes both settings at once.](assets/fig-four-arrangements.png)

Figure 2.1 draws the table as four boxes. From the start at the lower left, both grey lines lead to a higher cost, so the search stops there. The arrangement costing six can be reached by single changes only through eleven or twelve, or directly along the dashed line.

The result depends on the combination of the costs and the search rule. Allow both settings to change together, and the procedure can move directly from ten to six. Start with only A on, and switching B on also leads directly to six. Keep the original starting point and single-setting rule but permit an initial increase, and a route becomes available. None of these three distinct alterations to the procedure requires changing the numbers in the table.

The example separates two findings that are easily taken for one: that no improvement was found among the changes examined, and that no improvement exists. In the small example, we can prove that a better arrangement exists because we can inspect all four. In a large problem, we may not be able to do that. Failure to find something better then leaves two possibilities: the current solution may be the best, or the search may have missed a better one.

## The objective and the feasible choices

Two things in the example were supplied without discussion: a cost for each arrangement, and the list of arrangements that could be chosen. Both have names in optimisation. An *objective function* is the rule assigning a value to each candidate solution (in our example, the cost column), and to minimise the objective is to seek its lowest value. The *feasible set* contains the solutions permitted by the problem’s constraints, which here means all four arrangements. [^good-enough-ch02-1]

Feasibility is a separate matter from the way the search proceeds. Both settings being on is a feasible arrangement in the example, even though the specified procedure cannot reach it from the chosen starting point. An impossible arrangement and one that a method fails to find are different things. Confusing them can make a limitation of the procedure look like a limitation of the problem.

We could also change the example by imposing a constraint that forbids both settings from being on together. In that revised problem, six would no longer be an available cost. Both settings off would be the best feasible arrangement, at ten. Continuing to call it an inferior solution would compare it with an option that the new problem explicitly excludes.

In an actual decision, the status of a constraint needs investigation. A legal requirement, a physical impossibility, a contractual commitment and a manager’s preference may all appear as restrictions, but they are not interchangeable. Some can be changed by the people making the decision, others require action elsewhere, and some cannot be changed at all within the relevant period. The calculation begins only after someone has represented these distinctions in the model.

The objective needs similar care. Our invented cost is a single number, and a lower number is preferable by definition. A household considering a change to its working hours may instead care about income, time together, travel and predictability. For an organisation, service quality may count as well as expenditure. These concerns can be represented through multiple measures, explicit trade-offs or requirements that an acceptable choice must satisfy. Reducing them to one score is a modelling decision that should be explained.

The word *cost* can also conceal the person bearing it. Suppose a proposal reduces an organisation’s expenditure by requiring customers to do more work. In a model that records expenditure alone, the proposal appears to improve the objective. The arithmetic is correct for the objective as stated, which leaves out the work transferred to customers. Chapter 9 examines what follows when a measure is used as if it represented more than it includes.

## What counts as nearby

The remaining ingredient of the example was the rule that only one setting could change at a time. In a discrete search of that kind, a *neighbourhood* can be defined by the changes permitted in a single step. A rule that changes one setting gives a smaller neighbourhood than a rule that changes either or both. A solution is locally optimal under the chosen neighbourhood if none of the alternatives in it has a better objective value. [^good-enough-ch02-1]

Under this definition, the same arrangement can be a local minimum for one rule and an improvable one for another. Both settings off is a local minimum under the single-setting rule. It ceases to be one when changing both settings together is permitted, because the arrangement costing six becomes an immediately available improvement. There is no contradiction: we have changed what *local* means in the search.

In a continuous problem, the variables can change by arbitrarily small amounts, and the definition uses sufficiently small neighbourhoods around a point. A local minimum has a value no greater than any feasible value in some such neighbourhood. A *global minimum* has a value no greater than that of every feasible solution in the whole problem. Every global minimum is therefore also a local one. [^good-enough-ch02-1]

The distinction is narrower than saying that a situation is bad or that someone has become complacent. It concerns an objective, a set of alternatives and a meaning of nearby, each specified in advance. Our arrangement costing ten is a local minimum because of its relationship to the arrangements costing eleven and twelve under the permitted changes, whether or not ten feels expensive.

When later chapters consider organisations, the equivalent of a permitted change must be established from the circumstances. One department might be able to revise its own procedure while lacking the authority to alter another department’s work, and two changes that would make sense together may then be assessed separately. That can resemble the structure of the example, but the resemblance helps only once the actual dependencies and decision rights have been identified.

[^good-enough-ch02-3]: S. Kirkpatrick, C. D. Gelatt Jr. and M. P. Vecchi, “Optimization by Simulated Annealing”, *Science* 220, no. 4598 (1983): 671–680, <https://doi.org/10.1126/science.220.4598.671>, especially pp. 671–673 for the problem and method and pp. 674–679 for applications. Full text: <https://hedibert.org/wp-content/uploads/2013/12/1983KirkpatrickGelattVecchi.pdf>. The annealing comparison defines a computational procedure; it does not establish a general rule for institutional change.

[^good-enough-ch02-1]: Stephen Boyd and Lieven Vandenberghe, *Convex Optimization* (Cambridge University Press, 2004), sections 4.1.1 and 4.2.2, especially printed pp. 128 and 138, for feasible, local and global optima; chapter 9 for descent methods. Author-hosted text: <https://www.seas.ucla.edu/~vandenbe/cvxbook/bv_cvxbook.pdf>. For discrete local search, see Stuart Russell and Peter Norvig, *Artificial Intelligence: A Modern Approach*, 4th ed. (Pearson, 2021), chapter 4; the authors’ online algorithm collection, <https://aima.cs.berkeley.edu/algorithms.pdf>, Figure 4.2, states the improvement-only neighbour rule. The four-arrangement table in this chapter is an original teaching example, not an empirical dataset.
