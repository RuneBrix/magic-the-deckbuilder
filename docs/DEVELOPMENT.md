# Development workflow

Work lives in [GitHub Issues and PRs](https://github.com/RuneBrix/magic-the-deckbuilder). Deliver in `F:/Magic The Deckbuilder`; developer inspection uses the existing browser/profile at **http://localhost:3000/**.

## Feedback to merged change

1. Read the selected feedback/criteria and discussions; distinguish reported problems, requested outcomes and open decisions. Inspect affected source/tests. Preserve unrelated edits and personal data.
2. When asked to create issues, search for duplicates first. Record priority, observable criteria, dependencies and change-specific verification; link this workflow. Issue creation alone does not authorize implementation.
3. Implement authorized scope on a focused `codex/` branch in this checkout. Resolve routine reversible choices; leave material undecided product scope explicit. Link a PR with `Closes` for completed criteria or `Refs` for partial scope.
4. Verify using the table below. Update affected contracts where intent/preservation boundaries change, feature inventory when capability status changes and changelog for completed user-facing behavior. Roadmap changes only when direction changes.
5. Hand off with actual checks/gaps, PR/issue links and local-only review differences. Give short localhost inspection steps: refresh after frontend changes; restart the developer's CMD server here and refresh after server changes. Preserve server ownership, origin and storage.
6. Revise the same PR after feedback and recheck changed behavior. Merge only after explicit developer approval of the current revision and required checks passing. Close only satisfied issues; keep remaining gaps tracked. Preserve approved changes in this checkout. PR readiness is not approval, and a remote merge does not update the running checkout.

## Issue batching

When asked to find issues to solve, select at least two compatible issues, preferably three, for one reviewable PR. Compare criteria, dependencies, active PRs, affected files and shared verification. Honor named/narrower scope. Use fewer only for explicit scope, too few suitable issues or concrete size/risk/dependency/open-decision constraints; state the exception. Each issue retains its own criteria.

## Context and tool output

Read AGENTS, PRODUCT and this workflow once per session; reuse until changed. Use [CODE_MAP.md](CODE_MAP.md) and `rg` to locate affected source/tests. Inspect those before relying on behavioral summaries. Read only contract sections needed for intent, preservation or external-source boundaries; a linked document is not a request to load its links recursively. FEATURES is for capability questions and ROADMAP for direction/selection.

| Evidence | What it establishes |
| --- | --- |
| Current user instructions and selected issue criteria | Intended outcome and authorized scope. |
| Source and observed application behavior | Current implementation, including existing defects. |
| Tests | Specific regression expectations; older assertions can encode superseded behavior. |
| Active contracts | Confirmed decisions, reasons and non-obvious preservation/compatibility constraints. Check behavioral claims against implementation. |
| Archives, audits and research | Dated evidence or tentative interpretation; load only for an explicit historical/source question. |

If these disagree, state the conflict and resolve it within selected scope. An observed pattern or agent inference is not a confirmed product decision. Propose a new principle with supporting feedback rather than silently promoting it to required behavior.

Avoid full app/test dumps, generated catalogs, entire backlogs and historical reports as default context. List issue/PR titles before fetching selected bodies; filter large responses and narrow truncated output. Run independent reads together and keep mutations/dependencies sequential. Keep progress/PR text concise, reuse verification within a batch and report meaningful CI changes rather than unchanged snapshots.

## Verification and data

`package.json` owns commands. Prefer `npm run test:agent`: compact results, failures/nonzero status and full logs under ignored `test-results/agent-tests.log`. It runs the native suite without live Scryfall access or package installation. Narrow development checks by file/name:

```sh
npm run test:agent -- --test-name-pattern="optional viewing zones" test/workspace-deck.test.mjs
```

| Change | During development | Before PR handoff |
| --- | --- | --- |
| Documentation/instructions | Links/anchors, source-backed claims, preserved rules and diff scope | Same checks; no app suite or browser sweep. |
| Labels, CSS or local UI behavior | Relevant behavior checks and affected workflow inspection | One full suite and [UI acceptance](#ui-acceptance). |
| Query, statistics, deck or collection logic | Focused valid/invalid/edge regressions | One full suite and affected user flow. |
| Storage/import, shared navigation/theme or server | Focused failure and data-preservation checks | One full suite; checks across affected surfaces/appearances and request/storage boundaries. |
| Revision of a verified PR | Check changed behavior | Repeat affected checks; rerun full suite for shared logic, new failures or integration risk. |

Add meaningful behavior/risk regressions; wording-only edits need no new tests. CSS geometry requires browser evidence, not markup assertions alone. Run relevant [browser smoke flows](BROWSER_TESTING.md) when their modules/shared layout change and inspect visual details outside their assertions. Record automated/manual results and untested platforms separately. One final full native suite remains required for code PRs. Check the intended diff with `git diff --check`.

Use synthetic fixtures and isolated browser storage/server. Never clear personal storage to test. Different origins/ports have separate storage. Keep live-network tests opt-in. Loopback EACCES is an environment restriction, not a passing check; resolve permitted access before retrying, and report any remaining block.

### Card lookup and import verification

Choose cases that exercise the changed workflow end to end. Check its contract for which fields identify a rules card, a printing, or an owned lot. Search discovery can return broad matches. Once a workflow selects or imports a card, verify the exact name or known identity before applying changes.

| Boundary | Cases to exercise |
| --- | --- |
| Name and identity | A quoted name containing a comma, the full double-faced name, an exact face name, no exact match, and the same name returned for different rules identities. Where supported, check reversible printings and preserve both faces. |
| Edition and printing | An edition name and code, punctuation or spacing variations, several printings in the same set, and a collector number with a suffix. Check explicit language, wrong set or number, and a result beyond the first page. Check stored, fresh, and legacy records where they can take different paths. |
| Finish | An omitted finish with nonfoil available, a foil-only or etched-only printing, and an explicit finish the printing lacks. Verify the default or recovery policy for the specific workflow, including the saved finish and its displayed quote. |
| Remote work | Separate a genuine no-match from an unavailable endpoint, network failure, or rate limit. For bulk operations, count requests at representative scale and exercise partial results, pagination, cooldown, retry and cancellation. |
| Apply and persistence | For staged imports and printing changes, confirm no writes before approval, no partial change on a failed write, and a single application on retry. Check saved quantity, identity, printing, finish and relevant metadata after reload or compatible JSON round-trip. Combine a representative bulk import with an existing workspace for quota checks. |

Use small synthetic fixtures for semantic edge cases and a representative synthetic batch for scale. Mock upstream responses in the native suite. Use live lookups only when testing upstream behavior explicitly, and keep personal exports out of Git. [Cross-app audit #226](https://github.com/RuneBrix/magic-the-deckbuilder/issues/226) tracks existing workflows that still need this review.

## UI acceptance

Apply [the interface principles](../DESIGN.md#interface-principles) within the affected workflow. Identify the player's task, an existing pattern to reuse, variable-content/interaction risks and conflicts with selected criteria before implementation. This is agent work, not a routine developer approval checkpoint.

Inspect affected desktop/narrow, keyboard, appearance and touch-relevant paths. Exercise long labels/names, large counts, empty/partial data and relevant loading/error states. Compare neighboring targets and following sections before/during/after hover or focus; confirm the next action remains reachable. Stack changes include first/middle/last cards and Command zone above Main deck. Repeated-content changes include corresponding fields/actions through relevant filtering/sorting transitions, enlarged text, visible focus and access to full truncated values. Conditional summaries include zero/one/many selections.

Review added copy for the current decision, outcome or recovery it supports. Improve labels/controls first; optional reference detail belongs in help. Retain destination/scope, destructive consequences, actionable errors and material missing-data warnings.

Fix observed violations and add focused browser regressions for recurring geometry/interaction risks. Check transition states as well as resting screenshots: transforms can move hit targets without changing flow. Saved screenshots or passing old assertions do not establish revised acceptance. Record affected-state evidence and specific unperformed checks in the PR; existing suite and merge-approval gates remain.

## Documentation ownership

Keep one authoritative home for each confirmed rule. DESIGN owns interface intent; feature contracts own preservation/compatibility boundaries, not exhaustive copies of source. Replace stale statements when behavior changes. FEATURES summarizes capabilities, ROADMAP groups direction, CHANGELOG records delivered changes and GitHub owns progress/review evidence. A package version or old test count is not proof of a release or current acceptance.

Keep dated research/decisions in `docs/archive/`, clearly labeled as historical. Preserve unique rationale and source links; archive original proposals after extracting confirmed constraints. Local audit screenshots/logs belong in ignored `test-results/`, not routine context. Keep inferred observations tentative until confirmed by the developer. For the next three comparable UI batches, use existing PR discussion to distinguish missed criteria from changed requirements and note review rounds/time when available.

Use the local TASK_TEMPLATE and selected issue/PR for interrupted work. Local overrides and `.codex/local/` stay excluded. Preserve unique uncommitted work; do not remove temporary worktrees before authorized changes reach this checkout. Skills do not authorize delegation, installation, configuration changes, extra chats or merging. Native packaging, cloud sync and account/model/plugin settings are separate decisions.
