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

- Deck navigation, scrolling/sticky navigation, Statistics and Ownership & budget rendering, and horizontal overflow.
- Ownership & budget zone selection with keyboard focus and reload preservation, all-zone rows, and comparisons with missing EUR quotes.
- Desktop drag destination sizing, gap hit testing, edge scrolling and cancellation. Keyboard and emulated touch card menus retain deletion confirmation.
- Card-control contrast across all palettes, keyboard and touch flyouts, and commander minus confirmation from the editor, tracker and card details.
- Search results, card-printing dialog fit, keyboard Escape dismissal and same-context reload preservation.
- Explore width at 1920px with/without tracking, two phone card columns, empty initial output, function-chip query synchronization and keyboard disclosure collapse.
- Fresh top-navigation Explore entry, deck-editor entry with tracking, keyboard tracker toggle and guidance position.
- Collection table, automatically loaded printing choices, dialog fit and cancelling a staged quantity edit without changing saved holdings.

Failures retain screenshots and Playwright traces under ignored `test-results/browser/`; use `npx playwright show-trace <trace.zip>` for a specific trace. The CI browser job installs Chromium on Ubuntu and uploads failure artifacts for seven days. Native Node CI remains independent of browser/development dependency installation.

The suite covers Chromium at 1280×900 and 390×844 in light/dark appearance. Phone projects emulate mobile/touch capabilities; they do not prove physical touch behavior or Safari/macOS compatibility. Geometry/state assertions are not a full visual or accessibility review. Inspect changed artwork, colors, detailed interaction states and unsupported platforms when relevant. Update this small suite for repeated flows with known value rather than duplicating every native test in a browser.
