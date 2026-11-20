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

When the candidates vary continuously, an objective can sometimes be drawn as a curve, with candidate solutions along the horizontal axis and their values on the vertical axis. A point on that curve can be lower than its neighbours while another, elsewhere, is lower still. The graph represents the objective we have chosen, and its vertical direction has no independent moral meaning.

For a *convex optimisation problem*, every local minimum is global. Convexity is a precise condition on both the objective and the feasible set, explained formally in Appendix D. Smoothness is a different property: a perfectly smooth curve can contain several local minima with different values. [^good-enough-ch02-1] A graph with rounded curves therefore does not establish that a search will find the best solution.

![**Figure 2.2.** Schematic objective functions: a convex example with one minimum and a nonconvex example with several. Smoothness alone does not determine whether local minima are global.](assets/fig-smooth-vs-rugged.png)

Both curves in Figure 2.2 are smooth: the convex one on the left has a single low point, while the nonconvex one on the right has four, each at a different height. A dot marks the lowest point of each curve.

There is also a difference between a property of the problem and a guarantee about an algorithm. Even where every local minimum is global, a poorly chosen procedure can fail to converge, as when an update that is too large repeatedly passes over the solution. The procedure and its settings still require analysis.

*Gradient descent* uses information about the local slope of a differentiable objective to calculate an update. The step size determines how far the update goes. It is an important method of numerical optimisation, and it needs a slope to measure. Our table of four discrete arrangements has none, so the single-setting rule used there is a separate procedure. The name belongs where that technical procedure is involved. Not every decision made by a person who prefers an immediate improvement involves it.

## Why the starting point matters

The starting point can determine which solution an otherwise unchanged procedure finds. Our four-arrangement example shows how this happens. Begin with both settings off and the improvement-only procedure stops at a cost of ten, whereas from both on it stays at six. From A on and B off, at twelve, there are two improving neighbours: both off, at ten, and both on, at six. A rule that chooses the greatest immediate reduction selects six, while one that accepts the first improvement examined might select ten. The order in which neighbours are examined can affect the outcome as well as the starting state.

For a specified deterministic procedure, the set of starting states that lead to a particular limiting solution is called its *basin of attraction*. Appendix D gives the mathematical account. The definition belongs to the procedure together with the problem: changing the step size, the permitted moves or the treatment of ties can change which starting points lead where.

One response in computation is to run the search from several starting points and compare the results. A worse result from one run need not mean that the whole method is useless, though a better result from another shows that the first run had not reached the optimum. Multiple starts cost additional computation, and even repeated agreement is not a proof that every possible starting point would lead to the same answer. The value of restarting depends on what the extra search finds and what it costs.

## The cost of a transition

Return to the arrangement with both settings off. The cheapest route to both on, under single-setting changes, passes through the arrangement costing eleven. The increase from ten to eleven is a feature of this table under this rule. The first of the three alterations, allowing both settings to change together, removes it altogether.

A further distinction concerns the work needed to move between arrangements. Our table gives a cost to each state but assigns no separate cost to changing a setting. Real transitions may involve installation, training, downtime or the risk that a service fails during the change. Those costs need to be added to an actual assessment. A diagram of the states, like the table, shows none of them.

Suppose, within the example, that each change of setting also incurs a one-off cost. Then the difference between ten and six is insufficient to decide whether changing is worthwhile. We would need to know the size of the switching cost and how long the lower ongoing cost would apply.

This distinction helps explain why someone may reasonably retain an arrangement that appears inferior in a comparison of operating costs. The person must fund the change and survive the interval before any savings become available. Uncertainty about those savings adds a further consideration. Chapter 6 examines these requirements through purchasing decisions, existing commitments and the constraints associated with scarce resources.

## A different rule for searching

Of the three alterations that allowed the search in the four-arrangement example to reach the cheapest arrangement, the method of Kirkpatrick, Gelatt and Vecchi uses the last: it permits an increase. Simulated annealing changes the rule for accepting proposed moves. A parameter called temperature controls the willingness to accept increases in the objective, and a cooling schedule reduces that willingness over time. Temperature here is a number in the program, named by analogy with the cooling of materials. How well the method performs depends on the problem, the proposed moves and the schedule. A finite run does not come with an automatic guarantee of finding the global minimum. [^good-enough-ch02-3]

In the 1983 method, the chance of accepting a proposed increase depends on its size as well as on the temperature. At a given positive temperature, a small increase is more likely to be accepted than a large one. As the temperature falls, the same increase becomes less acceptable. This is controlled exploration under an explicit acceptance rule, some distance from accepting every bad result until a good one happens. [^good-enough-ch02-3]

Applied to our table, accepting the move from ten to eleven would make the next move to six available. Accepting an increase would only create an opportunity: the procedure would still have to propose and take the subsequent move. Cooling too quickly could make departure unlikely before that opportunity occurred. Keeping the temperature high would permit further departures even after a good arrangement had been found. The schedule therefore affects both the chance of finding an improvement and the chance of retaining it.

Other methods change the starting point, consider larger rearrangements or use information from previous updates. *Momentum*, in numerical optimisation, names an update rule that incorporates earlier movement. [^good-enough-ch02-4] The term describes arithmetic on successive steps. What keeps an organisation active is a separate matter of the people, resources and commitments involved.

The worked example answers, for one small table, the questions this book asks of real cases. A better arrangement exists, costing six, and by the table's own measure it is better. Every step from the start looks worse because each single change raises the cost before a second change can lower it. The barrier lies in the rule, which permits a single change per step and keeps only reductions. The move becomes possible in three ways: alter the two settings in one step, start from another arrangement, or tolerate a temporary increase. Whether it is worth making depends on what each change of setting costs, which the table leaves out. In a historical situation, known only through its records, each of those answers has to be established from evidence, and that work occupies the chapters that follow.

[^good-enough-ch02-1]: Stephen Boyd and Lieven Vandenberghe, *Convex Optimization* (Cambridge University Press, 2004), sections 4.1.1 and 4.2.2, especially printed pp. 128 and 138, for feasible, local and global optima; chapter 9 for descent methods. Author-hosted text: <https://www.seas.ucla.edu/~vandenbe/cvxbook/bv_cvxbook.pdf>. For discrete local search, see Stuart Russell and Peter Norvig, *Artificial Intelligence: A Modern Approach*, 4th ed. (Pearson, 2021), chapter 4; the authors’ online algorithm collection, <https://aima.cs.berkeley.edu/algorithms.pdf>, Figure 4.2, states the improvement-only neighbour rule. The four-arrangement table in this chapter is an original teaching example, not an empirical dataset.

[^good-enough-ch02-3]: S. Kirkpatrick, C. D. Gelatt Jr. and M. P. Vecchi, “Optimization by Simulated Annealing”, *Science* 220, no. 4598 (1983): 671–680, <https://doi.org/10.1126/science.220.4598.671>, especially pp. 671–673 for the problem and method and pp. 674–679 for applications. Full text: <https://hedibert.org/wp-content/uploads/2013/12/1983KirkpatrickGelattVecchi.pdf>. The annealing comparison defines a computational procedure; it does not establish a general rule for institutional change.

[^good-enough-ch02-4]: B. T. Polyak, “Some Methods of Speeding Up the Convergence of Iteration Methods”, *USSR Computational Mathematics and Mathematical Physics* 4, no. 5 (1964): 1–17, <https://doi.org/10.1016/0041-5553(64)90137-5>. Momentum refers here to the numerical update method, not to a claim about social or organisational persistence.
