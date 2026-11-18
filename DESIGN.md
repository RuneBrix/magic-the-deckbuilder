# Arcana interface

This file owns confirmed interface intent. Establish current behavior from the affected source, tests and browser; use [CODE_MAP.md](docs/CODE_MAP.md) to find them. Selected user/issue criteria define deliberate changes. Historical reviews and generated snapshots are evidence of earlier states, not additional requirements.

## Interface principles

Arcana prioritizes card browsing and editing with predictable actions, scannable information and concise task language. Apply these principles to new features and changes within the selected scope.

- **Stable interaction:** hover and focus update a reserved preview area or non-displacing layer. Neighboring card/control targets and following sections keep their positions during inspection. Explicit disclosure, navigation and edits may change layout; preserve useful focus and scroll position. Keep essential information reachable by keyboard and touch.
- **Predictable text layout:** define what wraps, truncates or moves to details for repeated cards, tables and group headers. Align corresponding fields and actions across peers. Check long names, large counts and incomplete price summaries. Essential labels, validation and instructions reflow; compact summaries retain access to full values. Support enlarged text rather than enforcing fixed heights everywhere.
- **Task-focused copy:** visible text names an action, identifies its target or scope, reports a meaningful result or explains recovery. Prefer clearer controls and labels before adding explanatory sentences. Put optional provenance, storage/API mechanics and calculation policy in relevant details/help. Keep actionable errors and material uncertainty visible.
- **Clear hierarchy:** emphasize the current task and parent section; group controls with their values and feedback. Use available width for scanning without spreading related information apart. Render selection summaries when selections exist; use concise empty states with useful next actions.
- **Contextual disclosure:** keep frequent actions discoverable and reveal secondary tools deliberately near their task. Reuse established menus, dialogs and previews with consistent names, focus and dismissal behavior. Required guidance and destructive-action scope remain visible when needed.
- **Consistent meaning:** equivalent actions share labels and behavior across surfaces. Examples remain distinct from entered values. Saved metadata, named destinations and partial-data truth survive presentation changes.

These principles guide scoped work; they do not claim all existing behavior already satisfies them. Resolve conflicts with selected criteria and update affected contracts/assertions together. Preserve unrelated behavior and follow [UI acceptance](docs/DEVELOPMENT.md#ui-acceptance) before handoff. Agent observations remain tentative until confirmed; repeated observations can motivate a proposal, not silently establish a product rule.

## Visual identity

Retain the collector's index established by #9: warm paper, forest-green ink, crisp rules and restrained controls. Newsreader gives headings and the wordmark an editorial character; Public Sans carries controls and dense data. Heading tracking stays no tighter than -0.025em. Font licenses and mana-symbol provenance live in `public/fonts/`. Reuse the authored card/diamond mark and familiar functional icons with accessible names.

Card imagery stays complete and undistorted in discovery, details and previews. Library covers may use art-focused landscape crops. Keep card art as the subject. Use existing CSS variables and semantic states across Light/Dark appearance; mana colors retain their game meaning. `public/style.css` owns implemented tokens, spacing, dimensions and breakpoints. Generated design snapshots do not override it.

## Interaction and verification

Writable fields keep permanent labels. Examples stay visually distinct from entered values. Native dialogs, disclosures and popovers retain visible focus, predictable dismissal and focus return. Modal dialogs keep the underlying page at its scroll position and scroll their own content. Support reduced motion. Preserve concise loading, empty, error and storage-warning states, and touch/keyboard alternatives to pointer inspection.

Feature contracts own non-obvious preservation and interaction boundaries; read only affected sections through [the source map](docs/CODE_MAP.md). Inspect changed geometry and states in the browser. Historical screenshots and past test counts do not validate a new revision; record current evidence and platform gaps in its PR.

## Appearance preferences (#178)

Settings offers Light or Dark, with Forest, Blue, Monochrome, Amber, Rose, Teal and Sepia palettes for each. Each appearance remembers its own choice in `arcana.palettes.v2`; legacy `arcana.palette.v1` initializes only the dark choice, and valid newer choices take precedence. Existing device-following preferences continue until an explicit Light/Dark selection. Preference failures apply for the session with a warning and do not write deck/collection data. Palettes remap semantic roles across surfaces, charts and states; preserve mana colors and visible focus.
