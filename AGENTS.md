# Repository instructions

## Keep documentation synchronized

The user requires the README and specifications to stay up to date with every
change and new development. This is an ongoing requirement for all work in this
repository.

- Before completing a task, review its impact on `README.md` and all relevant
  documents in `docs/`. Update affected documentation in the same change.
- Record accepted design decisions and new requirements during planning tasks,
  even when no application code changes.
- Keep product behavior and the content model separate from technical choices,
  authoring syntax, operational instructions, and implementation milestones.
- Keep examples, commands, configuration descriptions, and cross-references
  consistent with each other and with the actual implementation.
- Clearly distinguish proposed, implemented, tested, and deployed capabilities.
  Update status and remaining work as implementation progresses; do not describe
  planned functionality as already available.
- When a decision changes, revise superseded guidance across the affected docs
  rather than leaving contradictory instructions in place.
- Validate changed examples and local documentation links as appropriate. If a
  task has no documentation impact, no cosmetic edit is required.

Documentation synchronization is part of task completion, not optional follow-up
work. Apply it without waiting for another reminder from the user.

## Keep operator details private

Store account-specific dashboard/notebook URLs, resource inventories, test
identities and traffic snapshots in `~/.config/notes-along-the-way/operations.md`,
outside this public repository. Keep credentials in secret stores. Public docs
should contain generic setup/recovery instructions and necessary configuration
schemas; see `docs/private-operations.md`. Do not copy the private note into build
artifacts. Update the note when operator details change, preserving existing content.
