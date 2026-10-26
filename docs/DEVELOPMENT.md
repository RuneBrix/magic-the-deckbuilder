# Development workflow

Use **GitHub** for this project's code history, issues and pull requests. Do not use Linear for new planning or updates unless the user changes this preference.

## What goes where

- **Issues:** bugs, feature work, investigations, acceptance criteria and progress. Open means work remains; closed means completed or explicitly declined, with the reason recorded.
- **Pull requests:** the actual implementation, linked issues, validation and review. Use `Closes #number` only when the PR satisfies the issue; otherwise use `Refs #number`.
- **[FEATURES.md](FEATURES.md):** current capabilities and explicit limitations. Update alongside behavior changes.
- **[ROADMAP.md](ROADMAP.md):** grouped priorities and links to issues; issue state is authoritative.
- **[CHANGELOG.md](../CHANGELOG.md):** completed user-facing changes, with issue/PR links when available. Never list a planned feature as delivered.

## A small, repeatable cycle

1. Find an existing issue before creating another. State the problem and a short definition of done.
2. Work on a focused branch such as `issue-12-tag-discovery` or `fix-import-errors`.
3. Implement a reviewable change. Run relevant checks; `npm test` runs the current suite. Record manual checks and untested platforms honestly.
4. Open a PR using the repository template. Update feature status, roadmap links and changelog where behavior changed.
5. Merge after review. Confirm the issue is closed only when its acceptance criteria are met. Keep remaining gaps in linked follow-up issues.

For small changes, the issue and PR are enough; a separate project board or parallel status tracker is unnecessary. If a board becomes useful, use GitHub's native project with Backlog, In progress and Done, backed by the same issues.

## Repository

[Source and changes](https://github.com/RuneBrix/magic-the-deckbuilder) · [Issues](https://github.com/RuneBrix/magic-the-deckbuilder/issues) · [Pull requests](https://github.com/RuneBrix/magic-the-deckbuilder/pulls)

The initial roadmap is filed as issues #1–#8. Planning previously recorded in Linear has been preserved in these issues; Linear is historical context only.

Never put browser deck backups, account credentials or personal collection exports in source control.
