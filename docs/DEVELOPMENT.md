# Development workflow

Work lives in [GitHub Issues and PRs](https://github.com/RuneBrix/magic-the-deckbuilder). The primary checkout is `F:/Magic The Deckbuilder`; developer inspection uses the existing browser/profile at **http://localhost:3000/**.

## Feedback to merged change

1. Read the identified feedback; separate reported problems, desired behavior and open decisions. Keep personal files out of commits.
2. When asked, search existing issues/PRs before creating focused issues. Include priority, observable criteria, relevant sources/dependencies and only change-specific verification. Link this workflow instead of repeating its general checklist. Issue creation alone does not authorize implementation.
3. Read selected issue criteria/discussions and affected source/tests. Resolve routine reversible choices; keep material undecided product scope explicit.
4. Implement on a focused `codex/` branch in the primary checkout, preserving unrelated edits. Link the PR with `Closes` for complete scope or `Refs` for partial scope. Update the affected contract, feature inventory when capability status changes, and changelog for completed user-facing behavior. Update roadmap only when direction changes.
5. Verify using the table below. Hand off with PR/issue links, actual results, gaps, local-only review differences and short localhost inspection steps. Refresh after frontend changes; restart the developer's CMD server here and refresh after server changes. Preserve server ownership and existing data.
6. Revise the same PR after feedback; rerun affected checks and identify the revised inspection steps.
7. Merge only after explicit developer approval of the current revision and required checks passing. Close only satisfied issues; keep remaining gaps tracked. Preserve approved changes in the primary checkout. PR readiness or a merge does not itself update the running checkout.

## Issue batching

When asked to find issues to solve, select at least two compatible issues, preferably three, for one reviewable PR. Compare criteria, dependencies, active PRs, affected files and shared verification; state the selection briefly. Honor explicitly named/narrower scope. Use fewer only for explicit scope, too few suitable issues or concrete size/risk/dependency/open-decision constraints; explain the exception. Keep unrelated large features separate. Each issue retains its own acceptance criteria.

## Context and tool output

Read AGENTS, PRODUCT and this workflow once per session; reuse them until changed. Use [CODE_MAP.md](CODE_MAP.md) to locate affected source/tests/contracts. Read the relevant sections, not every linked document. FEATURES is for capability inventory questions; ROADMAP is for direction or broad issue selection. Source/tests establish current behavior; GitHub holds criteria/review state. Historical changelogs and archives are context only.

Use `rg` to locate symbols/headings before reading large ranges. Generated tag data, full app/test files, complete backlogs and full PR diffs are not default context: retrieve the specific portion needed. List GitHub issue/PR numbers and titles first, then fetch candidate bodies; retrieve metadata without diffs when possible. Filter large tool responses to needed fields before returning them to the model. If output truncates, narrow the query instead of repeating the dump.

Keep status updates and PR descriptions concise. Run independent reads together; keep edits and dependent work sequential. Poll CI/running tasks at bounded intervals and report meaningful changes. Reuse verification within a batch. New evidence, changed code or a failure justifies repeating a check; unchanged passing checks do not need another run for each issue or handoff message.

## Verification and data

`package.json` owns commands. `npm run test:agent` runs the full native suite, prints a summary on success and full output on failure, and writes the latest complete output to ignored `test-results/agent-tests.log`. Exit status is preserved. `npm test` remains unchanged for humans/CI. Pass focused selectors after `--`, for example:

```sh
npm run test:agent -- --test-name-pattern="optional viewing zones" test/workspace.test.mjs
```

| Change | Development checks | Before PR handoff |
| --- | --- | --- |
| Documentation/instructions only | Links, paths, preserved rules and diff hygiene | Same checks; no app suite or browser sweep |
| Labels, CSS or local UI behavior | Relevant rendering/interaction tests if behavior changes; inspect affected workflow | One full suite plus affected desktop/narrow-screen, keyboard and appearance checks |
| Query, statistics, deck or collection logic | Focused valid/invalid/edge-case regressions | One full suite plus affected user flow |
| Storage, backup/import, shared navigation/theme or server | Focused failure/data-preservation checks | One full suite; broader checks across affected surfaces/appearances and request/storage boundaries |
| Revision after a checked PR | Recheck changed behavior | Repeat affected checks; rerun full suite when shared logic, new failures or integration risk warrants it |

Add tests for meaningful changed behavior/risk; wording-only edits need no new implementation-mirroring assertions. Pure CSS geometry requires browser inspection; markup tests alone cannot establish it. Share browser checks across related issues. Record actual automated/manual results and untested platforms separately. The final full suite remains required for code PRs. Use `git diff --check` on the intended changes.

Loopback EACCES is an environment restriction, not a passing test or evidence of an app regression. Resolve permitted loopback access once before repeating server/launcher checks; report a remaining block accurately. Keep live-network tests opt-in. Use synthetic fixtures/disposable browser data. Preserve the player's origin/storage/server; localhost, 127.0.0.1 and different ports have separate storage. Never clear personal data to test.

## Documentation ownership

Feature contracts own behavior and preservation rules; FEATURES summarizes implemented/partial/planned status without contradictory historical rows. Replace stale statements when behavior changes instead of adding corrections above them. ROADMAP groups future direction without caching issue status. GitHub records progress and verification; CHANGELOG records implemented changes and reversals. Package version 0.1.0 is not proof of a published/reviewed release.

For interrupted work, use the local TASK_TEMPLATE handoff and selected issue/PR for durable status. Retain unique uncommitted work; remove temporary worktrees only after authorized changes reach the primary checkout. Native packaging/cloud sync and account/model/plugin settings are separate decisions.

## Options left for developer decision

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Extract cohesive app modules and split workspace tests | Smaller files to inspect; clearer ownership/test selection | Changes imports and the shared VM harness. Prefer one boundary during related feature work over a whole-app refactor. |
| Automate repeatable browser smoke flows | Fewer manual clicks for geometry, dialogs and navigation checks | Adds tooling, fixtures and maintenance. Choose representative flows and acceptable dependency/setup cost first. |
| Adjust model, reasoning and unused tool connections | May reduce session usage | Changes account/client workflow and quality tradeoffs. No settings change is part of this repository work. |
| Use a fresh chat for each coherent implementation batch | Reduces unrelated conversation history | Requires a concise issue/PR handoff; keep revisions in the same implementation chat. The developer chooses when to start a chat. |
| Compare usage across three similar batches | Reveals whether changes reduce actual allowance consumption | Record elapsed time and token/account usage only where available, plus retries and check counts. No telemetry or token-saving percentage is promised by this PR. |

Keep the existing local full-suite gate and cross-platform CI: reducing output/context is the initial optimization, while retaining behavior and data checks. Parallel agents, larger unrelated batches and new dependencies are not automatic cost savings.
