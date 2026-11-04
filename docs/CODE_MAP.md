# Source and verification map

Use this index to choose a boundary, then locate symbols with `rg -n`. Read the relevant contract sections and tests; loading every row is unnecessary. Paths are relative to the repository root.

| Task | Source | Tests | Contract |
| --- | --- | --- | --- |
| Deck entries, moves, functions, counts | `public/core.js`; deck render/actions in `public/app.js` | `test/zones.test.mjs`, `test/core.test.mjs`; selected workspace tests | [DECK_WORKSPACE.md](DECK_WORKSPACE.md), [DECK_ZONES.md](DECK_ZONES.md) |
| Card details and printing selection | detail/dialog handlers in `public/app.js` | selected `test/workspace.test.mjs`; proxy checks in `test/server.test.mjs` | [CARD_DETAILS.md](CARD_DETAILS.md) |
| Statistics, card types and Commander checks | `public/core.js`, `public/commander-brackets.js` | `test/core.test.mjs`, `test/card-types.test.mjs`, `test/brackets.test.mjs` | [CARD_TYPES.md](CARD_TYPES.md), [DECK_ZONES.md](DECK_ZONES.md), [COMMANDER_BRACKETS.md](COMMANDER_BRACKETS.md) |
| Explore/query/function discovery | `public/search.js`; exploration/tag handlers in `public/app.js`; `scripts/update-tags.mjs` | `test/search.test.mjs`, `test/tags.test.mjs`, `test/comparison.test.mjs`; selected workspace tests | [EXPLORATION.md](EXPLORATION.md), [UNIFIED_SEARCH.md](UNIFIED_SEARCH.md), [TAG_TAXONOMY.md](TAG_TAXONOMY.md), [EFFECT_COMPARISON.md](EFFECT_COMPARISON.md) |
| Collection upload/editing and budgets | collection/budget helpers in `public/core.js`; `collectionImport`, `collectionLotDialog`, `budgetPanel` in `public/app.js` | `test/collection-csv.test.mjs`, `test/workspace-file.test.mjs`; selected workspace tests | [COLLECTION_WORKFLOW.md](COLLECTION_WORKFLOW.md), [COLLECTION_BUDGETS.md](COLLECTION_BUDGETS.md), [PRICE_DATA.md](PRICE_DATA.md) |
| Storage/portable files/deck import | validation/interchange helpers in `public/core.js`; save/import/restore in `public/app.js` | `test/workspace-file.test.mjs`, `test/zones.test.mjs`; selected workspace tests | [PORTABLE_STORAGE.md](PORTABLE_STORAGE.md), [DECKLIST_INTEROP.md](DECKLIST_INTEROP.md) |
| HTTP, Scryfall pacing/cache | `server.mjs`, `scryfall-client.mjs` | `test/server.test.mjs`, `test/scryfall-client.test.mjs` | [COLLECTION_WORKFLOW.md](COLLECTION_WORKFLOW.md#efficiency-and-cooldown) |
| Launcher | `scripts/start.mjs`, `Start Arcana.cmd`, `Start Arcana.command` | `test/launcher.test.mjs` | [STARTUP.md](STARTUP.md) |
| Presentation/navigation | `public/style.css`, `public/index.html`; render/events in `public/app.js` | selected workspace tests plus real browser geometry/focus checks | [DESIGN.md](../DESIGN.md), [.impeccable/surface.md](../.impeccable/surface.md), affected feature contract |
| Compact verification command | `scripts/run-tests.mjs`, `package.json` | `test/agent-test.test.mjs` | [DEVELOPMENT.md](DEVELOPMENT.md#verification-and-data) |

For workspace test names, use `rg -n '^test\(' test/workspace.test.mjs`, then select the relevant range or `--test-name-pattern`. The shared VM harness is at the top of that file. It tests state/markup, not actual browser layout. Generated `public/tag-catalog.js` is data; use catalog helpers/tests or bounded queries instead of dumping it into context.
