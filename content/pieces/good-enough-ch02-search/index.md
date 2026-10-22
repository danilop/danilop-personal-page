---
schemaVersion: 1
id: good-enough-ch02-search
title: Searching for a better solution
summary: How starting points, transition costs and search rules affect the
  chance of finding a better solution.
language: en-GB
publication:
  surfaces:
    - collection
    - book
slug: good-enough-ch02-search
tags:
  - decision-making
  - systems-thinking
draft: true
---

## What a graph can show

An objective can sometimes be drawn as a curve, with candidate solutions along the horizontal axis and their values on the vertical axis. A low point on that curve can be lower than nearby points while another low point elsewhere is lower still. The graph represents the objective we have chosen; its vertical direction has no independent moral meaning.

For a *convex optimisation problem*, every local minimum is global. Convexity is a precise condition on both the objective and the feasible set, explained formally in Appendix D. Smoothness is a different property: a perfectly smooth curve can contain several local minima with different values. [^good-enough-ch02-1] A graph with rounded curves therefore does not establish that a search will find the best solution.

![**Figure 2.1.** Schematic objective functions: a convex example with one minimum and a nonconvex example with several. Smoothness alone does not determine whether local minima are global.](assets/fig-smooth-vs-rugged.png)

There is also a difference between a property of the problem and a guarantee about a particular algorithm. Knowing that every local minimum is global does not mean that any sequence of updates will reach a minimum. A poorly chosen procedure can fail to converge. An update that is too large, for example, can repeatedly pass over a solution instead of approaching it. The procedure and its settings still require analysis.

*Gradient descent* uses information about the local slope of a differentiable objective to calculate an update. The step size determines how far the update goes. It is one important method of numerical optimisation, but it is not the rule used in our discrete four-arrangement example. Nor does it describe every decision made by a person who prefers an immediate improvement. The technical name is useful when the technical procedure is actually involved.

## Why the starting point matters

The starting point can determine which solution an otherwise unchanged procedure finds. Our four-arrangement example shows how this happens. Begin with both settings off and the improvement-only procedure stops at a cost of ten. Begin with both on and it stays at six. Begin with A on and B off, at twelve, and there are two improving neighbours: both off, at ten, and both on, at six. A rule that chooses the greatest immediate reduction selects six; a rule that accepts the first improvement examined might select ten. The order of examination can matter as well as the starting state.

For a specified deterministic procedure, the set of starting states that lead to a particular limiting solution is called its *basin of attraction*. Appendix D gives the mathematical account. The definition belongs to the procedure together with the problem: changing the step size, the permitted moves or the treatment of ties can change which starting points lead where. The shape of a drawing alone is not enough to identify the basin.

One practical response in computation is to run the search from several starting points and compare the results. A worse result from one run need not mean that the whole method is useless; a better result from another shows that the first run did not establish the optimum. Multiple starts cost additional computation, and even repeated agreement is not a proof that every possible starting point would lead to the same answer. The value of restarting depends on what the extra search finds and what it costs.

## The cost of a transition

Return to the arrangement with both settings off. The cheapest route to both on, under single-setting changes, passes through the arrangement costing eleven. It is possible to describe that intermediate increase precisely because all the costs and permitted changes have been specified. This does not establish a general rule that improvement must begin with deterioration. We have already seen that allowing a simultaneous change removes the increase altogether.

A further distinction concerns the work needed to move between arrangements. Our table gives a cost to each state but assigns no separate cost to changing a setting. Real transitions may involve installation, training, downtime or the risk that a service fails during the change. Those costs need to be added to an actual assessment. They cannot be inferred from a diagram of the destination alone.

Suppose, within the example, that each change of setting also incurs a one-off cost. Then the difference between ten and six is insufficient to decide whether changing is worthwhile. We would need to know the size of the switching cost and how long the lower ongoing cost would apply. A better final state and a worthwhile transition are related judgements, but they are not identical.

This distinction helps explain why someone may reasonably retain an arrangement that appears inferior in a comparison of operating costs. The person must fund the change and survive the interval before any savings become available. Uncertainty about those savings adds a further consideration. Chapter 6 examines these requirements through purchasing decisions, existing commitments and the constraints associated with scarce resources.

## A different rule for searching

Simulated annealing changes the rule for accepting proposed moves. A parameter called temperature controls the willingness to accept increases in the objective, and a cooling schedule reduces that willingness over time. The analogy with cooling becomes a mathematical procedure; the program is not physically heating the problem it is trying to solve. Its performance depends on the problem, the proposed moves and the schedule. A finite run does not come with an automatic guarantee of finding the global minimum. [^good-enough-ch02-3]

In the 1983 method, the size of the proposed increase matters as well as the temperature. At a given positive temperature, a small increase is more likely to be accepted than a large one. As the temperature falls, the same increase becomes less acceptable. This is controlled exploration, with an explicit acceptance rule. It does not mean accepting every bad result until a good one happens. [^good-enough-ch02-3]

Applied to our table, accepting the move from ten to eleven would make the next move to six available. Accepting an increase would only create an opportunity; the procedure would still have to propose and take the subsequent move. Cooling too quickly could make departure unlikely before that opportunity occurred. Keeping the temperature high would permit further departures even after a good arrangement had been found. The schedule therefore affects both the chance of finding an improvement and the chance of retaining it.

Other methods change the starting point, consider larger rearrangements or use information from previous updates. *Momentum*, in numerical optimisation, names an update rule that incorporates earlier movement. [^good-enough-ch02-4] It should not be treated as evidence that an organisation will succeed if it merely continues acting energetically. The causes of sustained organisational activity belong to the people, resources and commitments involved.

The worked example has given us a way to ask a more exact question. If no improvement is being made, is the current solution already the best feasible one, are the permitted changes too restricted, is the objective incomplete, or is the transition not worth its cost? These possibilities lead to different decisions. They also require different evidence, which becomes especially important when the subject changes from a calculation we can inspect in full to a historical situation we can know only through its records.

[^good-enough-ch02-1]: Stephen Boyd and Lieven Vandenberghe, *Convex Optimization* (Cambridge University Press, 2004), sections 4.1.1 and 4.2.2, especially printed pp. 128 and 138, for feasible, local and global optima; chapter 9 for descent methods. Author-hosted text: <https://www.seas.ucla.edu/~vandenbe/cvxbook/bv_cvxbook.pdf> (accessed 19 September 2026). For discrete local search, see Stuart Russell and Peter Norvig, *Artificial Intelligence: A Modern Approach*, 4th ed. (Pearson, 2021), chapter 4; the authors’ online algorithm collection, <https://aima.cs.berkeley.edu/algorithms.pdf>, Figure 4.2, states the improvement-only neighbour rule. The four-arrangement table in this chapter is an original teaching example, not an empirical dataset.

[^good-enough-ch02-3]: S. Kirkpatrick, C. D. Gelatt Jr. and M. P. Vecchi, “Optimization by Simulated Annealing”, *Science* 220, no. 4598 (1983): 671–680, <https://doi.org/10.1126/science.220.4598.671>, especially pp. 671–673 for the problem and method and pp. 674–679 for applications. Full text (accessed 19 September 2026): <https://hedibert.org/wp-content/uploads/2013/12/1983KirkpatrickGelattVecchi.pdf>. The annealing comparison defines a computational procedure; it does not establish a general rule for institutional change.

[^good-enough-ch02-4]: B. T. Polyak, “Some Methods of Speeding Up the Convergence of Iteration Methods”, *USSR Computational Mathematics and Mathematical Physics* 4, no. 5 (1964): 1–17, <https://doi.org/10.1016/0041-5553(64)90137-5>. Momentum refers here to the numerical update method, not to a claim about social or organisational persistence.
