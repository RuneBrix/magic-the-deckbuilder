# Arcana — Magic deckbuilder

A dependency-free local web app for building Magic: The Gathering decks alongside Scryfall card discovery. Requires **Node.js 22 or later**. Windows has been checked directly; macOS/Linux automated coverage and manual browser verification are tracked separately below.

## Run

For double-click startup, use **Start Arcana.cmd** on Windows after installing Node 22+. A **Start Arcana.command** script is provided for macOS verification. Keep the terminal open; Ctrl+C stops the server. [Startup, prerequisites and verification limits](docs/STARTUP.md).

```sh
npm start
```

For development and PR inspection, open http://localhost:3000/ in your existing browser/profile. The double-click launcher currently opens http://127.0.0.1:3000; continue using your existing origin for existing decks. No npm install, API key, account, or database is needed. Stop with Ctrl+C. To use another port, set the `PORT` environment variable. The server listens only on your computer. Use the same address each time: `localhost` and `127.0.0.1` have separate browser storage.

```sh
npm test
```

For compact agent output, use `npm run test:agent`. It runs the same suite, keeps full logs in ignored `test-results/agent-tests.log` and reports failures with a nonzero exit status. [Focused commands and verification scope](docs/DEVELOPMENT.md#verification-and-data).

Optional browser smoke checks use a development-only Playwright dependency: `npm ci`, `npx playwright install chromium`, then `npm run test:browser`. They run with synthetic data in an isolated browser/server on port 4173. [Setup, coverage and limits](docs/BROWSER_TESTING.md).

## Current checkout

`package.json` identifies development package version **0.1.0**. That number does not establish a published release or developer approval. Use branch/commit and PR to identify reviewed changes. [FEATURES.md](docs/FEATURES.md) describes available behavior and limits; implementation, automated checks, browser verification and developer acceptance are separate evidence.

## Included

- Create, rename, delete, and switch decks; seven format presets.
- Search Scryfall using its full syntax plus guided name, Oracle text, type, mana value, mana cost, color identity, and format filters.
- A dated function-tag catalog with curated starting points, alias lookup and relationship browsing. Guided filters and typed syntax share one editable query; unsupported expressions remain intact. Text/number edits stage the query; control changes or Search run results.
- Full card images and details, adding/removing copies, four visual/text deck views, compact card menus, explicit main/sideboard/command/Maybeboard zones, and personal role tags.
- Quantity-weighted mana curve, average nonland mana value, types, colors, and custom role counts.
- Zone-aware Modern construction checks for main/sideboard size, combined copy limits, exceptions and stored legality. Checks distinguishes failed rules, missing data and manual review. Commander remains partial; refresh card data before use. See [coverage and sources](docs/DECK_ZONES.md).
- Plain-text decklist import/export and JSON workspace backup/restore. Imports are atomic: unresolved cards leave the deck unchanged.
- Responsive desktop and mobile layout, keyboard controls, native dialogs, reduced-motion support.

## Development tracking

Use GitHub Issues and pull requests for ongoing work. See the [feature inventory](docs/FEATURES.md), [roadmap](docs/ROADMAP.md), [changelog](CHANGELOG.md), and [development workflow](docs/DEVELOPMENT.md). [GitHub issues](https://github.com/RuneBrix/magic-the-deckbuilder/issues) hold current acceptance criteria and work status. The workflow follows plain-text feedback, selected issues, a PR and primary-checkout inspection; merging requires explicit developer approval. Issue/PR templates are included.

## Storage and limitations

Decks save in this browser's localStorage on this origin. **Export JSON backups regularly**; changing browsers, ports, devices, or clearing browser data does not preserve decks. JSON restores add decks; text exports preserve quantities, names and zones, while personal roles require JSON. Legacy commander flags and backups remain compatible. A storage failure is shown in the app. No cloud sync or authentication is included.

Card search, the optional example deck, imports, card images, and refreshes need internet access. The example deck is deliberately incomplete and loaded from real API records. No deck is created until requested.

Function discovery uses a dated bundled Tagger snapshot with curated starting points, not a live taxonomy; some specialized tags can change or be absent. Custom tags are validated by Scryfall search. New deck entries can receive a broad initial function from the offline snapshot, and those private labels remain editable. The app does not rank synergy or guarantee that a narrower search retains all useful cards.

Legality is **partial**, not tournament certification. Modern construction and bounded Commander/companion checks are implemented; unusual exceptions and unsupported predicates remain manual. Checks use stored Scryfall records. Refresh before use and inspect the [current supported scope](docs/CONSTRUCTION_RULES.md). Format status and external rules can change.

## Implementation

`server.mjs` serves `public/` and fixed Scryfall endpoints through the shared paced/cached client in `scryfall-client.mjs`. No credentials are used. Client search ignores stale responses and browser data is rendered with HTML escaping. Use [CODE_MAP.md](docs/CODE_MAP.md) to inspect affected source/tests; [DEVELOPMENT.md](docs/DEVELOPMENT.md#context-and-tool-output) explains how current behavior, intended changes and historical evidence differ. Commands and request limits belong to their implementation/configuration rather than this overview.

Data and complete card images: [Scryfall](https://scryfall.com/docs/api). Function tag syntax: [Scryfall search reference](https://scryfall.com/docs/syntax). Magic: The Gathering and card artwork © Wizards of the Coast and their respective artists. This is an independent, unofficial project.

See [the roadmap](docs/ROADMAP.md) for future direction and deferred decisions. Local collection ownership and EUR deck planning are implemented; see [Collection workflow](docs/COLLECTION_WORKFLOW.md). Cloud sync and native packaging are deferred.

## Platform verification (D05 / #5)

[Tests](https://github.com/RuneBrix/magic-the-deckbuilder/actions/workflows/test.yml) runs the native Node suite on Windows, macOS and Linux with Node 22 and 24 for every pull request and main-branch push. Logs record the exact Node version, platform and architecture. No install step or live Scryfall access is required by the native suite. A separate Chromium smoke job installs the pinned development dependency/browser and uses mocked responses; see [browser checks](docs/BROWSER_TESTING.md). A configured matrix is not evidence of a passing run; inspect the run for the commit being reviewed.

Historical local automated check: Windows, Node v24.14.1, 1 November 2026. Browser checks recorded in docs/archive/DESIGN_HISTORY.md were on Windows; their browser versions were not recorded, so they do not establish a specific supported browser version. macOS/Safari manual checks remain outstanding and #5 remains open.

To record a manual platform check, include OS version, Node version, browser/version and date, then check live search, adding cards, text import/export, JSON download/restore, reload persistence on the same origin, Tab/Enter/Escape and a narrow layout. Use a disposable browser profile, never clear a player's storage. Record failures and untested items separately from automated results.

Initial hosted result: [run 41344997404](https://github.com/RuneBrix/magic-the-deckbuilder/actions/runs/41344997404) succeeded for PR #65 at commit a067f91. This is automated evidence, not macOS/Safari manual verification. [PR #65](https://github.com/RuneBrix/magic-the-deckbuilder/pull/65).

Current Windows evidence and the remaining manual Mac session are recorded in [the platform verification handoff](docs/PLATFORM_VERIFICATION.md). #5 remains open pending actual macOS/Safari checks.
