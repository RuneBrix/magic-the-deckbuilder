# Roadmap

[GitHub Issues](https://github.com/RuneBrix/magic-the-deckbuilder/issues) are the source of truth for work status. This document groups the intended work and keeps the reasoning findable. Priorities below are proposals for feedback, not commitments.

| Reference | Work | Proposed priority | Scope | GitHub issue |
| --- | --- | --- | --- | --- |
| D01 | Discover and navigate a broader function-tag taxonomy | Implemented | Dated official snapshot, alias search and verified relationship navigation; [limits/update strategy](TAG_TAXONOMY.md) | [#1](https://github.com/RuneBrix/magic-the-deckbuilder/issues/1) |
| D02 | Compare related effects and explain search broadening | Implemented | Manual two-card comparison and reversible single-condition relaxation; [workflow/limits](EFFECT_COMPARISON.md). Automatic scoring remains a separate decision | [#2](https://github.com/RuneBrix/magic-the-deckbuilder/issues/2) |
| D03 | Extend format checks and support deck zones | Implemented selected family | [Modern construction and explicit zones](DECK_ZONES.md); Commander rules split to [#13](https://github.com/RuneBrix/magic-the-deckbuilder/issues/13), companions to [#14](https://github.com/RuneBrix/magic-the-deckbuilder/issues/14) | [#3](https://github.com/RuneBrix/magic-the-deckbuilder/issues/3) |
| D04 | Decide durable storage and cross-device workflow | Next | Needs user decision | [#4](https://github.com/RuneBrix/magic-the-deckbuilder/issues/4) |
| D05 | Verify macOS and automate cross-platform tests | Next | Scoped | [#5](https://github.com/RuneBrix/magic-the-deckbuilder/issues/5) |
| D06 | Improve decklist interoperability | Later | Scoped | [#6](https://github.com/RuneBrix/magic-the-deckbuilder/issues/6) |
| D07 | Collection ownership and deck budget planning | Later | Needs user feedback | [#7](https://github.com/RuneBrix/magic-the-deckbuilder/issues/7) |
| D08 | Decide whether native desktop packaging is useful | Later | Needs user feedback | [#8](https://github.com/RuneBrix/magic-the-deckbuilder/issues/8) |
| D09 | Redesign typography, icons and focused workflows; add dark mode | Current | Typography, themes and progressive disclosure; see feature inventory | [#9](https://github.com/RuneBrix/magic-the-deckbuilder/issues/9) |

Acceptance criteria and implementation progress live in the linked issues. [The issue index](ISSUE_BACKLOG.md) provides a compact overview.

## How this relates to the MVP

The [feature inventory](FEATURES.md) records implemented and partial functionality. The [changelog](../CHANGELOG.md) records completed user-facing changes. A future idea belongs in an issue, not in the changelog as though it shipped.

## Previous tracker

Future planning is moving away from Linear at the user's request. D01–D04 and parts of D07–D08 preserve the follow-up topics previously grouped in `RUN-5`. The topics have been transferred into GitHub issues #1–#8. No Linear records have been deleted or modified.
