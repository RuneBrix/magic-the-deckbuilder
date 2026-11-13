# Platform verification handoff (#5)

## Evidence from 13 November 2026

This implementation batch runs in Windows 11 Home (10.0.26300), x64, Node v24.14.1. The native suite passed 217 tests with no failures; one opt-in live CSV lookup test was skipped. Server/launcher checks use disposable loopback ports. No personal browser storage or developer server was replaced.

Isolated Playwright Chromium 156.0.8078.4 checks cover desktop 1280×900 and emulated phone 390×844, light/dark. The new upload/companion flows passed in all four configurations: additive totals, replacement confirmation/cancellation, inventory/deck preservation, keyboard confirmation, companion selection/focus/clear and same-context reload. Detailed screenshots were inspected for desktop/phone light/dark. Existing browser smoke results and the exact assessed commit/hosted run are recorded in the implementing PR, so CI evidence stays tied to its actual revision.

These browser tests use deterministic API fixtures. They do not establish live Scryfall behavior, physical touch, a macOS desktop launcher or Safari compatibility. Native macOS CI is a separate observation from a manual macOS browser pass. #5 remains open until the following evidence is obtained on an actual Mac.

## Manual Mac session to record

Use an isolated browser profile and synthetic data. Record the checkout commit, date, macOS version, `node --version`, browser/version, origin and narrow viewport. Preserve any existing localhost:3000 server and player profile; use the same chosen origin throughout that disposable session.

| Check | Result to record |
| --- | --- |
| Launch `Start Arcana.command` through Finder and Terminal | Permissions/quarantine prompts, server output and default-browser association; stop only the test-owned server |
| Live card search and add | Query, returned card, chosen destination and saved quantity |
| Deck and collection dialogs | Open/close, narrow fit and Tab/Enter/Escape focus behavior |
| TXT/CSV collection upload | Add totals, repeat warning, confirmed Replace, cancellation, retained decks |
| Text deck export | Downloaded names, quantities and zone headings |
| Complete workspace download/open | Printing/finish/condition, functions, companion designation and collection retained; explicit keep/replace behavior |
| Reload on the same origin | Saved decks, collection and designation retained |
| Safari and any additional claimed browser | Separate browser/version results, failures and untested paths |

Report each as pass/fail/untested and attach usable error details. Inspect the CI run for that same revision and record each Windows/macOS/Linux × Node 22/24 result separately. Do not reuse historical runs as current evidence or close #5 based only on Windows/Chromium checks.
