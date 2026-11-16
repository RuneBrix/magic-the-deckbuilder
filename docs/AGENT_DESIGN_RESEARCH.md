# Making agent-built interfaces more consistent

Research date: 16 November 2026. Local source baseline: `384c9d8`, with pre-existing uncommitted documentation and UI-audit work. The findings and proposed wording below record the research snapshot before implementation.

Follow-up: the developer requested implementation of the instruction changes. [AGENTS.md](../AGENTS.md), [the interface principles](../DESIGN.md#interface-principles), [UI acceptance](DEVELOPMENT.md#ui-acceptance), the surface brief and PR template now apply that guidance. Application changes for #186/#188/#193 remain separate issue work. Historical verification statements below describe the research pass.

## Recommendation

Change the tracked root `AGENTS.md` slightly, put the reusable interface principles near the top of `DESIGN.md`, and make the existing development workflow require evidence for those principles before handoff. Align feature contracts and tests when newer feedback replaces an older interaction decision.

The project already has design guidance, a UI skill, browser automation and a developer inspection gate. The missing connection is between repeated feedback, general rules and observable completion conditions. Another large instruction file or a recurring whole-app audit would add cost without necessarily fixing that connection.

The strongest inferred preference is: **keep the player's task, reading position and next action predictable; make secondary information available without making it compete with the task.** This is an interpretation of the evidence below, rather than a new approved product specification.

## Evidence and limits

- Screened 142 unique GitHub issue titles from overlapping recent and older searches, covering open and closed work. Read selected issue bodies in detail across the initial redesign and the 31 October, 1 November, 4 November and 15 November feedback batches. The open-issue search returned 36 issues at research time. These are retrieval counts, not defect rates or independent user observations.
- Screened 58 PR titles and examined relevant descriptions, particularly [#86](https://github.com/RuneBrix/magic-the-deckbuilder/pull/86), [#141](https://github.com/RuneBrix/magic-the-deckbuilder/pull/141), [#149](https://github.com/RuneBrix/magic-the-deckbuilder/pull/149) and [#200](https://github.com/RuneBrix/magic-the-deckbuilder/pull/200). Requested discussion timelines for PRs #51/#86/#141/#149/#200 and comments for issues #9/#41/#95/#128/#162/#183/#185/#186; those connector responses contained no comments. The analysis therefore relies on issue/PR bodies, not an assumed record of every review conversation.
- Compared tracked/local agent guidance, current and committed design guidance, the surface brief, development and browser-testing workflows, PR/issue templates, affected feature contracts, UI source and browser assertions. Existing edits were preserved.
- Consulted official OpenAI instruction documentation, W3C accessibility guidance, government design-system content guidance, Playwright documentation and Google's layout-stability documentation. Specific support is linked where used.
- Issue bodies often record agent-transcribed user feedback and say the report was not independently reproduced during capture. They establish recurring requested outcomes, not proof that every report has the same implementation cause. Several items from one feedback session are correlated evidence.
- No new live UI reproduction, application test run, user study or model comparison was performed. The existing local UI audit at `docs/UI_AUDIT.md` is historical evidence, not a fresh validation, and is outside the instruction PR. No GitHub issues, comments or PRs were created or changed during research.

## Patterns in the feedback

| Recurring preference | Earlier evidence | Later evidence | General rule to teach |
| --- | --- | --- | --- |
| Keep browsing targets and context stable | [#42](https://github.com/RuneBrix/magic-the-deckbuilder/issues/42): stable preview aligned with cards; [#92](https://github.com/RuneBrix/magic-the-deckbuilder/issues/92): consistent drag destinations | [#186](https://github.com/RuneBrix/magic-the-deckbuilder/issues/186): hover moves cards/sections and makes the next card hard to hit | Inspection should preserve the positions and reachability of neighboring actions and following sections. |
| Give repeated content predictable geometry | [#128](https://github.com/RuneBrix/magic-the-deckbuilder/issues/128): misaligned function tiles | [#183](https://github.com/RuneBrix/magic-the-deckbuilder/issues/183): wrapping captions; [#185](https://github.com/RuneBrix/magic-the-deckbuilder/issues/185): changing columns/rows; [#193](https://github.com/RuneBrix/magic-the-deckbuilder/issues/193): uneven stack headers | Choose alignment, wrapping and overflow behavior before adding variable text. |
| Keep copy tied to the current task | [#40](https://github.com/RuneBrix/magic-the-deckbuilder/issues/40), [#45](https://github.com/RuneBrix/magic-the-deckbuilder/issues/45), [#60](https://github.com/RuneBrix/magic-the-deckbuilder/issues/60): remove role/printing/bracket explanations | [#98](https://github.com/RuneBrix/magic-the-deckbuilder/issues/98), [#112](https://github.com/RuneBrix/magic-the-deckbuilder/issues/112), [#118](https://github.com/RuneBrix/magic-the-deckbuilder/issues/118), [#170](https://github.com/RuneBrix/magic-the-deckbuilder/issues/170), [#188](https://github.com/RuneBrix/magic-the-deckbuilder/issues/188), [#198](https://github.com/RuneBrix/magic-the-deckbuilder/issues/198), [#199](https://github.com/RuneBrix/magic-the-deckbuilder/issues/199): repeated boilerplate removal | Every visible sentence should help a present decision, explain an outcome or enable recovery. |
| Make hierarchy and labels do the explanatory work | [#20](https://github.com/RuneBrix/magic-the-deckbuilder/issues/20), [#108](https://github.com/RuneBrix/magic-the-deckbuilder/issues/108), [#119](https://github.com/RuneBrix/magic-the-deckbuilder/issues/119): search hierarchy, concise cost labels and stronger parent headings | [#169](https://github.com/RuneBrix/magic-the-deckbuilder/issues/169), [#173](https://github.com/RuneBrix/magic-the-deckbuilder/issues/173), [#182](https://github.com/RuneBrix/magic-the-deckbuilder/issues/182), [#192](https://github.com/RuneBrix/magic-the-deckbuilder/issues/192): section hierarchy, aligned summaries and empty-state clutter | Group related controls, align labels/values and make the main task visually primary. |
| Reveal secondary tools in context | [#9](https://github.com/RuneBrix/magic-the-deckbuilder/issues/9): focus the current workflow; [#38](https://github.com/RuneBrix/magic-the-deckbuilder/issues/38), [#39](https://github.com/RuneBrix/magic-the-deckbuilder/issues/39): quieter management and compact headers | [#129](https://github.com/RuneBrix/magic-the-deckbuilder/issues/129), [#177](https://github.com/RuneBrix/magic-the-deckbuilder/issues/177), [#192](https://github.com/RuneBrix/magic-the-deckbuilder/issues/192): contain filters/settings and hide unused selection chrome | Keep frequent actions visible; reveal optional detail deliberately where it belongs. |
| Preserve consistent meanings and usable alternatives | [#87](https://github.com/RuneBrix/magic-the-deckbuilder/issues/87): distinguish examples from values; [#99](https://github.com/RuneBrix/magic-the-deckbuilder/issues/99), [#101](https://github.com/RuneBrix/magic-the-deckbuilder/issues/101), [#102](https://github.com/RuneBrix/magic-the-deckbuilder/issues/102): shared details and explicit editing flows | [#184](https://github.com/RuneBrix/magic-the-deckbuilder/issues/184), [#189](https://github.com/RuneBrix/magic-the-deckbuilder/issues/189), [#195](https://github.com/RuneBrix/magic-the-deckbuilder/issues/195): expected row editing, scoped clearing and consistent metadata | Equivalent controls should share semantics; keyboard and touch should reach the same essential information. |

The geometry and copy patterns cross multiple surfaces and feedback dates. They support durable principles. Requests for a particular palette count, a removed feature or a specific navigation destination remain product decisions, rather than universal design rules.

### A concrete contradiction agents currently inherit

The local [DESIGN.md](../DESIGN.md), [.impeccable/surface.md](../.impeccable/surface.md) and [deck workspace contract](DECK_WORKSPACE.md#four-views-and-card-actions-41--43--44) explicitly retain following-card stack reveals. The contract says following slots translate on hover while the selected and preceding cards stay fixed. These instructions describe the existing implementation; they do not express the newer all-neighbor stability requested in [#186](https://github.com/RuneBrix/magic-the-deckbuilder/issues/186).

The browser test beginning at [smoke.spec.mjs:247](../browser-tests/smoke.spec.mjs#L247) checks hover metadata, including that the next card's top lies below the revealed caption. It also requires wording such as `Function: Draw`, `per copy` and `regular`, which [#188](https://github.com/RuneBrix/magic-the-deckbuilder/issues/188) now asks to simplify. The caption is toggled from `display:none` to `display:block` in [style.css](../public/style.css), and following-card transforms implement the documented reveal.

This is a reason to revise criteria, contracts and assertions together when implementing #186/#188/#193. Adding a general stability instruction while preserving contradictory detailed requirements would leave agents to choose between them. Passing the old assertions would still not demonstrate the newly requested behavior.

There is also an important qualification: closed [#95](https://github.com/RuneBrix/magic-the-deckbuilder/issues/95) explicitly requested name, price and set code below hovered cards; [PR #141](https://github.com/RuneBrix/magic-the-deckbuilder/pull/141) delivered that feature. Some subsequent work reflects a preference clarified through use. The failure to generalize recurring layout/copy feedback is preventable; the entire revision history should not be counted as avoidable agent error.

### A useful positive example already in the repository

[#183](https://github.com/RuneBrix/magic-the-deckbuilder/issues/183) and [#185](https://github.com/RuneBrix/magic-the-deckbuilder/issues/185) are closed, with [PR #200](https://github.com/RuneBrix/magic-the-deckbuilder/pull/200) present in the local baseline. Its Collection implementation limits visual captions, gives table columns explicit sizing and keeps full data available in editing/accessibility paths. The browser regression at [smoke.spec.mjs:627](../browser-tests/smoke.spec.mjs#L627) uses long metadata and compares caption/row/column geometry through filtering and sorting.

That is the pattern to reuse: an explicit presentation contract, difficult content, observable geometry and access to full information. The exact 20px caption and table widths belong to Collection; they should not become arbitrary dimensions for every interface.

## Why current guidance has not been sufficient

1. **It records many individual outcomes but few transferable constraints.** `DESIGN.md` contains extensive feature descriptions and visual identity. “Use concise copy” and “keep layout consistent” need concrete rules about the positions, states and decisions that matter.
2. **Some detail is actively out of date with newer feedback.** Stack motion is the clearest example. An open issue is requested work, so the current-behavior contract should remain truthful until implementation; the implementation task must explicitly replace the older decision.
3. **Verification is broad but can accept the wrong behavior.** [DEVELOPMENT.md](DEVELOPMENT.md#verification-and-data) already requires browser inspection for CSS geometry. The gap is deciding what to inspect: next-target stability, long summaries, changing counts and actual reading burden. A screenshot saved by a test is evidence to inspect, not automatically a visual comparison assertion.
4. **Implementation facts can leak into ordinary UI.** Current source still renders allocation boilerplate in Collection, stored-price explanations in Cards and quote-policy prose in Ownership. [#71](https://github.com/RuneBrix/magic-the-deckbuilder/issues/71) did require honest allocation/price behavior. The product still needs that correctness, but [#170](https://github.com/RuneBrix/magic-the-deckbuilder/issues/170) and [#198](https://github.com/RuneBrix/magic-the-deckbuilder/issues/198) clarify that much of its explanation does not belong on the normal page.
5. **Generic design skills cannot own this product's preferences.** Impeccable is already routed for UI work and the surface brief says Operate/preserve. Its general guidance is useful, but Arcana's repeated task, geometry and copy decisions need a project-owned source. Installing another skill or changing model settings is not an evidence-backed first intervention.
6. **Some improved guidance is local-only today.** Existing uncommitted changes shorten `DESIGN.md`/the surface brief and improve the PR template. Remote or clean-checkout agents will not necessarily receive those changes. Reconcile and publish the intended shared guidance through the normal review cycle; keep local overrides excluded.

These are evidence-based explanations of likely contributors. The issue history does not expose every agent's context or reasoning, so it cannot establish one psychological cause or guarantee that a prompt change eliminates rework.

## Where the rules should live

| File | Recommended role and change |
| --- | --- |
| Tracked root `AGENTS.md` | Keep a short mandatory UI trigger and completion rule. Preserve existing data, checkout, skills, batching and merge safeguards. |
| `DESIGN.md` | Put a compact principles section near the top, before long feature descriptions. Own the general interaction, content and geometry rules here. |
| `docs/DEVELOPMENT.md` | Add a short UI acceptance procedure within existing implementation/verification steps. Own the process here. |
| `.github/pull_request_template.md` | Request a concise result and evidence link for relevant UI checks; link the workflow rather than copying a second checklist. |
| `.impeccable/surface.md` | Point to the principles, retain product identity and surface-specific intent, and update superseded motion language with the associated implementation. |
| Affected feature contracts and browser tests | Own exact surface behavior, dimensions and regressions. Update them in the feature PR that changes behavior. |
| Local override / `.codex/local/` | Keep local entry and environment instructions. Shared design policy belongs in tracked files so every checkout receives it. |

The official [AGENTS.md guide](https://learn.chatgpt.com/docs/agent-configuration/agents-md) documents root-to-current-directory discovery and precedence for `AGENTS.override.md` over `AGENTS.md` within a directory. This project's local override already explicitly tells the agent to read the tracked file; preserve that bridge. A `public/AGENTS.md` alone is a poor place for essential rules when tasks start from the repository root. Do not rely on opening a source file to establish that its directory's instructions were automatically loaded.

### Proposed root instruction replacement

Replace the existing final skill/UI bullet with the following two bullets, preserving the other rules:

```md
- Load task-relevant skills via `docs/AGENT_SKILLS.md`. For UI work, including
  labels, generated markup, loading/error states and hover behavior, read
  `DESIGN.md#interface-principles` and `.impeccable/surface.md` before choosing
  the implementation. Preserve the established interface and apply its
  stability, content and disclosure rules.
- Before UI handoff, satisfy `docs/DEVELOPMENT.md#ui-acceptance` and record
  affected-state evidence or the specific checks not performed. Reconcile
  superseded issue criteria, contracts and tests within the selected scope.
  Do not delegate or create other chats without current-session authorization.
```

The linked headings are proposed additions below; create them in the same instruction change. This text makes required reading and completion explicit without embedding all design guidance in the always-loaded entry point.

### Proposed `DESIGN.md` section

```md
## Interface principles

Arcana prioritizes card browsing and editing with predictable actions,
scannable information and concise task language. Apply these principles to
new features and changes within the selected scope.

- Stable interaction: hover and focus update a reserved preview area or
  non-displacing layer. Neighboring card/control targets and following
  sections keep their positions during inspection. Explicit disclosure,
  navigation and edits may change layout; preserve useful focus and scroll
  position. Keep essential information reachable by keyboard and touch.
- Predictable text layout: define what wraps, truncates or moves to details
  for repeated cards, tables and group headers. Align corresponding fields
  and actions across peers. Test long names, large counts and incomplete
  price summaries. Essential labels, validation and instructions reflow;
  compact summaries retain access to full values. Support enlarged text.
- Task-focused copy: visible text names an action, identifies its target or
  scope, reports a meaningful result or explains recovery. Prefer clearer
  controls and labels before adding explanatory sentences. Put optional
  provenance, storage/API mechanics and calculation policy in relevant
  details/help. Keep actionable errors and material uncertainty visible.
- Clear hierarchy: emphasize the current task and parent section; group
  controls with their values and feedback. Use available width for scanning
  without spreading related information apart. Render selection summaries
  when selections exist; use concise empty states with useful next actions.
- Contextual disclosure: keep frequent actions discoverable and reveal
  secondary tools deliberately near their task. Reuse established menus,
  dialogs and previews with consistent names, focus and dismissal behavior.
  Required guidance and destructive-action scope remain visible when needed.
- Consistent meaning: equivalent actions share labels and behavior across
  surfaces. Examples remain distinct from entered values. Saved metadata,
  named destinations and partial-data truth survive presentation changes.

Selected current issue criteria define intentional behavior changes.
Identify conflicts with existing contracts before implementing, then update
the affected descriptions and assertions together. Preserve unrelated
behavior and keep unresolved product decisions explicit.
```

This section is a draft derived from repeated feedback. It deliberately avoids universal fixed heights, a global word limit, mandatory tooltips, or hiding every caveat. Those prescriptions would create new usability defects.

### Proposed UI acceptance procedure

Add a `UI acceptance` subsection to `docs/DEVELOPMENT.md` and point to it from the existing verification table:

```md
For UI changes, apply DESIGN.md's interface principles within the affected
workflow. Before implementation, identify the task, an existing pattern to
reuse, variable-content/interaction risks and conflicts with newer criteria.
This is agent work, not a routine developer approval checkpoint.

Before handoff, inspect the affected desktop and narrow states, including
keyboard and appearance checks required by the verification table. Exercise
long content, empty/partial data and relevant loading/error states. During
hover/focus, check neighboring targets, following sections and reachability.
Review added visible copy for its purpose in the current task. Fix observed
violations and add focused browser regressions for recurring geometry or
interaction risks. Record evidence, scope and unperformed checks in the PR.

When feedback establishes a reusable principle or replaces a prior decision,
update its authoritative guidance and affected assertions in the same scope;
keep one-off feature requests in their issue/contract. Existing developer
inspection and explicit merge approval remain the final gate.
```

For the PR template, a single extra sentence under Validation is sufficient:

```md
For UI changes, summarize the affected-state results and link evidence from
`docs/DEVELOPMENT.md#ui-acceptance`, including any unperformed checks.
```

## Concrete checks that would catch the reported patterns

| Risk | Focused acceptance evidence |
| --- | --- |
| Hover/focus displaces cards or sections | Capture neighboring target rectangles and the following zone heading before/during/after inspecting first/middle/last cards. Compare within a small rounding tolerance, such as 1 CSS pixel. Hit-test the next exposed target and verify keyboard/touch access. Include Command zone above Main deck. |
| Text creates uneven repeated items | Populate short/long names, long group labels, large quantities/amounts and missing-price summaries. Compare corresponding caption/header/action positions at the same viewport, then test the chosen overflow behavior. |
| Filter/sort changes table geometry | Reuse the Collection test's before/after row-height/column-width checks and verify complete values remain readable in an accessible detail path. Pagination gets coverage when implemented, not an unsupported claim today. |
| Empty chrome crowds the task | Inspect zero/one/many selections and last-selection removal. Empty headings/dividers collapse where appropriate; useful recovery/next-action states remain. |
| Explanatory text expands every feature | Review each added sentence: what present decision or recovery does it support? Keep labels, units, destination and partial-data warnings; move optional policy/provenance to an appropriate existing detail path or remove repetition. |
| Stable dimensions cause clipping | Check narrow widths, enlarged text, focus outlines and complete-information access. A fixed caption contract is not permission to crop validation, primary instructions or controls. |

Use existing isolated browser fixtures and the [browser-testing workflow](BROWSER_TESTING.md). For hover bugs, a static screenshot of the resting state is insufficient. For transitions, inspect intermediate frames where applicable as well as final rectangles; a transform can preserve document flow while still moving a hit target.

The existing suite takes screenshots but contains no `toHaveScreenshot` assertions at this baseline. Start with targeted geometry and interaction assertions, plus inspected screenshots. Add a small set of deliberately approved visual comparisons only if they catch meaningful recurring defects. Playwright documents both [visual comparison support and environment-dependent rendering](https://playwright.dev/docs/test-snapshots); an automatically generated baseline is not evidence that a design was approved.

Do not substitute a Lighthouse/CLS score for these checks. Google's [CLS documentation](https://web.dev/articles/cls) describes unexpected shifts and excludes qualifying shifts shortly after discrete input. The product requirement concerns the actual next target across its interaction sequence, including behavior a general performance score does not adequately establish.

## External guidance and its boundaries

- W3C's [hover/focus guidance](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) supports predictable, dismissible, hoverable and persistent additional content where applicable. It does not itself impose a universal zero-movement rule; Arcana's stronger target-stability requirement comes from its own feedback.
- W3C's [reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) requires preserving information/functionality as content reflows, with specific exceptions for necessary two-dimensional layouts. Stable table columns do not justify clipping essential text or forcing the entire page to scroll sideways. Full-value access and zoom behavior still need inspection.
- The DWP Design System recommends [hint text for a clear user need, after improving the question first](https://design-system.dwp.gov.uk/guidance/hint-text). This supports a copy-purpose review; it does not make all help text undesirable.
- GOV.UK's [details guidance](https://design-system.service.gov.uk/components/details/) supports optional disclosure while cautioning against hiding information most users need. Move technical reference detail selectively; retain current errors, missing-data meaning and destructive consequences at the point of action.
- OpenAI's [instruction guidance](https://learn.chatgpt.com/docs/agent-configuration/agents-md) supports repository-level conventions and concise review rules. Instructions still need compatible acceptance criteria and executable evidence; the documentation does not promise deterministic design compliance.

## Suggested rollout and success measure

1. **Instruction-only PR:** reconcile the existing local documentation cleanup, add the short root trigger, principles, acceptance procedure and template pointer. Preserve all existing project safeguards. Explain that the new principles describe the target for scoped work; existing stack behavior is still pending #186. Check links, rule preservation and diff hygiene; application suites are unnecessary for instruction-only changes.
2. **One focused implementation batch:** #186/#188/#193 are compatible candidates around deck inspection, metadata and stack headers. Verify current discussions, dependencies and size before selection. Replace the old reveal/text assertions and affected motion/preview contracts with evidence for the newer criteria. Preserve cards, prices, keyboard/touch access and saved data; no blanket redesign.
3. **Apply the same procedure to subsequent feature work:** reuse the positive Collection pattern and inspect only affected surfaces. Avoid a new full-app audit for every feature or a new human approval step before routine reversible work.
4. **Evaluate after three comparable implementation batches:** record developer-requested layout/copy corrections after first handoff, review rounds, and developer review time where practical. Separate changed requirements from missed existing criteria. Compare concrete counts; make no promised percentage reduction. If the same defect returns, determine whether the rule was unavailable, contradictory, unverified or failed to generalize before adding more prose.

The goal is to move routine interface cleanup into the implementing agent's completion criteria, leaving developer review for preference, scope and approval. Prompt wording alone cannot guarantee that result; short shared rules, consistent contracts and targeted browser evidence make it testable.

## Research verification and remaining setup observations

This report is the only new file from this investigation. Existing local edits, branch state, personal data and the developer's server/profile were preserved. No application test pass or live browser validation is claimed. Documentation checks cover referenced local paths, proposed-vs-existing headings and whitespace. No pre-existing file was edited.

The installed Impeccable context loader also reported a legacy product-record schema and a stale `.impeccable/design.json` sidecar. Its `init` and `document` workflows respectively own those maintenance tasks. They were not run: neither maintenance task is needed to establish the issue-history findings, and schema repair should not silently rewrite this project's confirmed product guidance. This invocation selected no surface brief automatically; the explicit repository instruction to read `.impeccable/surface.md` supplied it during this investigation. Preserve that explicit read instead of assuming the loader always includes it.
