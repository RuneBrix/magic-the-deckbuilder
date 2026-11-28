# Browser smoke checks

The smoke suite uses pinned `@playwright/test` as a development-only dependency. Running the app and the native Node tests still needs no package installation. One-time setup after checkout:

```sh
npm ci
npx playwright install chromium
```

Run all four desktop/phone × light/dark Chromium projects:

```sh
npm run test:browser
```

For a focused change, run one project or matching flow:

```sh
npm run test:browser -- --project=desktop-light
npm run test:browser -- --grep collection
```

## Isolation and ownership

Playwright starts and stops its own server at **http://127.0.0.1:4173/**. It refuses to attach if that address is already in use. It never takes over port 3000 or connects to the developer's browser/profile. Each test has an isolated browser context seeded with synthetic deck/collection data. Reloads within a test retain that context's edits; the next test starts independently. No personal storage is read, cleared or exported.

API requests receive deterministic fixture responses, and external requests receive local fixture content through browser routing. No live Scryfall/Cardmarket data is used. This catches module import/runtime errors and basic interaction regressions without depending on network availability or rate limits. It does not verify the real upstream API contract, market prices or live data freshness; proxy/native tests and deliberate live checks cover those separately.

## Coverage and failure evidence

- Card-lookup audit checks cover supported manual Collection finishes, long double-faced names, exact printing/language metadata, cancellation, rejected-save retry and reload. New-deck text imports keep their reviewed double-faced printing, finish and zone through quota failure/retry, including enlarged text and reachable dialog actions. See the [dated workflow audit](archive/CARD_LOOKUP_AUDIT_2026-11-18.md).

- Owned-printing matching reviews finish/language changes, cancels without writes, retries quota failure and preserves split quantities, functions and inventory after reload. Deck export covers zone and category selection, missing-copy allocation, one-row examples, TXT/CSV and complete JSON downloads, empty selections and enlarged-text dialog fit. Group actions cover Type and Function menus, filtered artwork and CSV, explicit removal scope, cancellation, failed-save retry, focus and reload preservation.

- Settings page/Back navigation from library, editor, Explore and Collection; retained deck tab/query/inventory, workspace download/open and keyboard focus. Fourteen Light/Dark palette combinations cover desktop/phone forms, guide dialogs, chart/deck surfaces, token contrast, legacy migration, per-appearance reload and enlarged-text reflow.

- Collection upload Add/Replace quantities, repeat warnings, explicit replacement confirmation/cancellation, keyboard application and preserved decks; companion selection, focus, reload and clearing in Checks. Native tests separately exercise failed writes, stale operations and rule predicates.

- Quick add three-character gating, bounded suggestions, immediate keyboard/touch nonfoil addition, stale-response rejection, Escape dismissal, atomic save-failure/retry and explicit foil-only fallback to the detailed form. Offline function assignment, deliberate suggestions/Unassigned for older entries, import/Explore default consistency, printing captions and reload preservation.
- Ten reported Karona-card identities through fresh text import, function grouping/statistics and reload. Existing-deck missing-function review covers keyboard scrolling, zero/one/many suggestions, cancellation, quota failure/retry, unchanged manual/explicit Unassigned choices and retained inventory.
- Deck navigation remembers the last opened deck independently of the tracker, with explicit library/brand routes, switching/deletion fallback and library startup on reload. Compact header geometry retains touch targets and measured sticky offsets. Statistics covers centered wide/intermediate/phone layouts, primary headings, long functions, 500-copy quantities, empty decks and enlarged text; existing calculations and tools remain checked. Ownership & costs rendering and horizontal overflow remain covered.
- Compact editor zone counts through quantity edits, moves and reload, including Commander/constructed totals and empty decks. Aligned vertical group headers and inline horizontal costs across long functions, large totals, partial prices and enlarged text.
- Optional Sideboard/Maybeboard hidden → populated → hidden transitions in all four deck layouts and the tracker; populated zero-filter-match sections, retained destinations and unchanged unrelated entries.
- Long library/editor/Explore pages, scrollable Settings, wrapped-header measurement, keyboard/touch menus, focused controls above fixed overlays, desktop preview/tracker offsets and final phone tracker-control hit testing. The acceptance tests attach exact browser/version, viewport, origin and appearance.
- Independent cheapest scans across five pages, isolated failure/retry without rescanning completed cards, reviewed selected-zone printing application, cancellation, quota failure/retry and reload with retained functions, foil/Maybeboard entries and unchanged collection.
- Ownership & costs zone selection with keyboard focus and reload preservation, all-zone rows, and estimates with missing quotes; saved euro/dollar selection across costs, cheapest scans, all four Cards layouts and reload, with basic-land exclusions, long names, 500 copies and enlarged text; sortable cost columns, legacy budget preservation and separate quantity/cost summaries.
- Desktop drag destination sizing, gap hit testing, edge scrolling and cancellation. Keyboard and emulated touch card menus retain deletion confirmation.
- Deck Select mode covers keyboard and emulated touch, whole-entry counts, clipboard zone headings, sort/layout retention, filter/collapse pruning, and bottom-toolbar focus with enlarged text. Batch checks cover existing/new functions, exact-variant moves, scoped removal, Collection save failure and retry, and reload preservation.
- Fixed-card geometry across first/middle/last cards, slow/rapid pointer and focus traversal, Command zone above Main deck, menus and both visual orientations. None/partial/full/excluded/unavailable ownership states, quantity contrast across fourteen palettes, selected foil/nonfoil/etched treatments, reduced motion and retained workspace data. Card-control contrast, keyboard/touch flyouts and commander minus confirmation remain covered.
- Search results, card-printing dialog fit, keyboard Escape dismissal and same-context reload preservation.
- Explore width at 1920px with/without tracking, two phone card columns, empty initial output, function-chip query synchronization and keyboard disclosure collapse.
- Explore query submission under the bounded sticky query, equal wide setup panels, a side picker for all nine on-demand filter types, focus after removal, and empty or locked conditions. Function lookup covers ten stable starter slots, zero/one/many selections, separate Add and Related actions, page navigation after the final candidate is added, and inline unlisted function entry.
- Balanced empty Explore headings; zero/one/many selected functions and final-chip removal; secondary snapshot help. Populated filters cover keyboard focus outlines on first/middle/last scrolling rows, spaced removal actions, narrow Oracle rows, intermediate/wide layouts and 200% zoom with preserved query text.
- Fresh top-navigation Explore entry, deck-editor entry with tracking, keyboard tracker toggle and guidance position.
- Collection artwork quantity/options controls, one-line language/finish/condition captions without repeated names, keyboard/touch Edit/Remove menus, direct exact-lot editing from artwork/captions/text rows, and condition/finish replacement plus matching-lot combination without leaving the original behind. Fixed table geometry through sorting/filtering/grouping, sticky actions and reload preservation. Automatically loaded printing choices, dialog fit and cancelling a staged edit without changing saved holdings.
- Collection entry/revisit measurements at 300 and 1,100 synthetic lots; a 48-lot rendering bound in both views, with only visible-page artwork. First/last pages, whole-inventory filtering/sorting/grouping, copy totals, keyboard page navigation, exact-lot edits and removal from the final page, empty results and reload preservation.

Failures retain screenshots and Playwright traces under ignored `test-results/browser/`; use `npx playwright show-trace <trace.zip>` for a specific trace. The CI browser job installs Chromium on Ubuntu and uploads failure artifacts for seven days. Native Node CI remains independent of browser/development dependency installation.

The suite covers Chromium at 1280×900 and 390×844 in light/dark appearance. Phone projects emulate mobile/touch capabilities; they do not prove physical touch behavior or Safari/macOS compatibility. Geometry/state assertions are not a full visual or accessibility review. Inspect changed artwork, colors, detailed interaction states and unsupported platforms when relevant. Update this small suite for repeated flows with known value rather than duplicating every native test in a browser.
