# Arcana — Magic deckbuilder

A dependency-free local web app for building Magic: The Gathering decks alongside Scryfall card discovery. Works on macOS, Windows, and Linux with **Node.js 22 or later**.

## Run

```sh
npm start
```

Open http://127.0.0.1:3000 in your browser. No npm install, API key, account, or database is needed. Stop with Ctrl+C. To use another port, set the `PORT` environment variable. The server listens only on your computer. Use the same address each time: `localhost` and `127.0.0.1` have separate browser storage.

```sh
npm test
```

## Included

- Create, rename, delete, and switch decks; seven format presets.
- Search Scryfall using its full syntax plus guided name, Oracle text, type, mana value, mana cost, color identity, and format filters.
- Curated function tags, related narrower tags, custom tag entry, all/any matching, and a visible composed query. Filter edits update the query; Search applies text, color, and mana changes. Tag, type, sort, and legal-only changes search immediately.
- Full card images and details, adding/removing copies, four visual/text deck views, compact card menus, explicit main/sideboard/command/Maybeboard zones, and personal role tags.
- Quantity-weighted mana curve, average nonland mana value, types, colors, and custom role counts.
- Zone-aware Modern construction checks for main/sideboard size, combined copy limits, exceptions and stored legality. Checks distinguishes failed rules, missing data and manual review. Commander remains partial; refresh card data before use. See [coverage and sources](docs/DECK_ZONES.md).
- Plain-text decklist import/export and JSON workspace backup/restore. Imports are atomic: unresolved cards leave the deck unchanged.
- Responsive desktop and mobile layout, keyboard controls, native dialogs, reduced-motion support.

## Development tracking

Use GitHub Issues and pull requests for ongoing work. See the [feature inventory](docs/FEATURES.md), [roadmap](docs/ROADMAP.md), [changelog](CHANGELOG.md), and [development workflow](docs/DEVELOPMENT.md). [GitHub issues](https://github.com/RuneBrix/magic-the-deckbuilder/issues) contain the eight initial roadmap items and their acceptance criteria. Issue/PR templates are included. Linear is no longer the active tracker for this project.

## Storage and limitations

Decks save in this browser's localStorage on this origin. **Export JSON backups regularly**; changing browsers, ports, devices, or clearing browser data does not preserve decks. JSON restores add decks; text exports preserve quantities, names and zones, while personal roles require JSON. Legacy commander flags and backups remain compatible. A storage failure is shown in the app. No cloud sync or authentication is included.

Card search, the optional example deck, imports, card images, and refreshes need internet access. The example deck is deliberately incomplete and loaded from real API records. No deck is created until requested.

Suggestions are a curated set, not a live or exhaustive Tagger taxonomy; some specialized tags can change or be absent. Custom tags are validated by Scryfall search. Personal role tags are user assigned and separate from Scryfall function tags. The MVP does not rank synergy or guarantee that a narrower search retains all useful cards.

Legality is **partial**, not tournament certification. Modern main/sideboard construction is the selected verified rule family; partner/background pairings, companion predicates, special commander exceptions, points systems and unusual construction rules still require review. Checks use stored Scryfall records. Refresh before use. Format status can change. Follow-ups: [Commander #13](https://github.com/RuneBrix/magic-the-deckbuilder/issues/13), [companions #14](https://github.com/RuneBrix/magic-the-deckbuilder/issues/14).

## Implementation

`server.mjs` serves `public/` and allows only fixed Scryfall search/collection endpoints. Requests are serialized with 120 ms spacing, cache successful responses for five minutes, time out after 20 seconds, and send application and Accept headers. No credentials are used. Client search ignores stale responses. Imports use collection lookups in batches of at most 75 names. Browser data is treated as untrusted and rendered with HTML escaping.

Data and complete card images: [Scryfall](https://scryfall.com/docs/api). Function tag syntax: [Scryfall search reference](https://scryfall.com/docs/syntax). Magic: The Gathering and card artwork © Wizards of the Coast and their respective artists. This is an independent, unofficial project.

Future feedback: live tag updates, automatic synergy ranking, cloud sync, deeper format rules, price tracking, collection tracking, native packaging.
