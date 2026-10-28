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

## Deck workflow improvements

The first feedback group is [#16: shared top navigation](https://github.com/RuneBrix/magic-the-deckbuilder/issues/16), [#17: dedicated deck workspace](https://github.com/RuneBrix/magic-the-deckbuilder/issues/17), and [#18: library management and creation](https://github.com/RuneBrix/magic-the-deckbuilder/issues/18). The implementation and its data/interaction boundaries are described in [Deck workspace](DECK_WORKSPACE.md); GitHub tracks review and merge status.

The optional/resizable exploration tracker remains [#19](https://github.com/RuneBrix/magic-the-deckbuilder/issues/19). Card-details autosave/redesign is [#25](https://github.com/RuneBrix/magic-the-deckbuilder/issues/25); clearer check states and automatic freshness are [#27](https://github.com/RuneBrix/magic-the-deckbuilder/issues/27) and [#28](https://github.com/RuneBrix/magic-the-deckbuilder/issues/28). These are not completed by the dedicated editor.

## How this relates to the MVP

The next feedback group is [#21: guided filter semantics](https://github.com/RuneBrix/magic-the-deckbuilder/issues/21), [#22: unified editable query](https://github.com/RuneBrix/magic-the-deckbuilder/issues/22), and [#23: function-tag interactions](https://github.com/RuneBrix/magic-the-deckbuilder/issues/23). [Unified search](UNIFIED_SEARCH.md) records supported expressions, preservation boundaries and verified examples. Broader exploration hierarchy (#20) and candidate-list discovery (#24) remain separate scopes.

The [feature inventory](FEATURES.md) records implemented and partial functionality. The [changelog](../CHANGELOG.md) records completed user-facing changes. A future idea belongs in an issue, not in the changelog as though it shipped.

## Previous tracker

Future planning is moving away from Linear at the user's request. D01–D04 and parts of D07–D08 preserve the follow-up topics previously grouped in `RUN-5`. The topics have been transferred into GitHub issues #1–#8. No Linear records have been deleted or modified.
