# Decklist text interchange (D06)

Supported target chosen from the user’s Archidekt export options on 1 November 2026: **Text**, **1 Example Card**, **Generic section headers**. This is a selected text format, not support for every Archidekt export option.

Paste one line per card, for example:

```text
Commander
1 Karona, False God

Mainboard
2 Forest

Sideboard
1 Sol Ring

Maybeboard
1 Command Tower
```

Headers are case insensitive and allow a trailing colon. Main deck is an alias for Mainboard; Command zone is an alias for Commander. Without headers, cards enter Main deck. Both `1 Name` and `1x Name` work. Blank lines and lines starting with `#` or `//` are ignored; repeated names combine within a zone. Limits remain 300 card lines and 500 copies of one entry per zone.

Review import resolves names, then lists quantities, resolved card names and destination zones before any changes. Missing or ambiguous returned name/face matches block the whole import; edit the list and review again. Lookup errors retain the list. Edits invalidate a completed review or pending result. Import reviewed cards applies to the current destination contents atomically, preserving edits made during lookup and rejecting overflow. Closing the dialog cancels an unapplied review.

Text preserves quantities, names and explicit zones, including commander designation and Maybeboard. Export uses Arcana’s Main deck/Command zone headings, which its importer reads back with equivalent meaning. Name resolution is case insensitive and accepts full double-faced names or an exact face name. Name-based Scryfall collection lookup supplies a printing; a trailing `(SET) collector-number` is accepted but discarded and never promises printing preservation. New additions retain that resolved printing, its default finish and shared automatic primary function; exact printing/finish matches increment their existing entries while retaining manual functions. [Printing/default details](CARD_DETAILS.md#preservation-and-lookup). Text does not preserve exported personal functions, bracket assignments, deck metadata or arbitrary Archidekt custom categories. Use complete JSON for those. JSON and CSV Archidekt modes, category headers, inline metadata and other export options are outside this contract.

The sample above is a small representative fixture derived from the supplied export settings, not the user’s personal 183-card deck. The user subsequently confirmed successful Archidekt deck import and export and accepted the options on 1 November 2026. This is user-reported workflow validation, not an agent reproduction of the full personal list. [Issue #6](https://github.com/RuneBrix/magic-the-deckbuilder/issues/6) is complete for this selected scope.

## Export options (#176)

Export deck leads with a live text preview and Download text decklist. Include zones independently selects Main deck, Command zone, Sideboard and Maybeboard (all on initially). Zone headings and Quantities are separate controls, both initially on. Without headings, repeated names across selected zones combine; without quantities, each name appears once per retained section, or once overall without headings. No zones/no cards disables text download with a visible explanation.

Only copies missing from Collection uses the same allocation helper and saved rules/printing matching setting as Ownership & costs, with the independently selected export zones as its scope. Owned copies allocate across that scope in Main deck, Command zone, Sideboard, Maybeboard order, then current printing ID; excluding a zone can free owned copies for another exported zone. A fully covered selection produces an empty preview and no download. Options and downloads do not edit deck, inventory or saved ownership settings.

Complete JSON backup remains a smaller secondary action and always includes the complete deck, regardless of text options. Only default quantity/heading text promises the existing zone/quantity import round trip. Name-only output is for copying to other tools; Arcana’s importer still requires quantities. JSON remains necessary for printing/finish, functions, companion designation, brackets and complete metadata.

## Verification

1 November 2026: all 106 native Node tests pass on Windows/Node v24.14.1, including unresolved/ambiguous resolution, invalidated/in-flight reviews, overflow rollback and quantity/zone round trips. Live Windows in-app-browser checks cover missing-name feedback without mutation, corrected review, Enter application into all four zones, reload persistence, Escape cancellation/focus return, desktop light and 390px dark layout. Phone page/dialog widths were 390/358px with no horizontal page overflow. Browser version was not exposed/recorded; physical touch and macOS/Safari remain untested. The user's subsequent Archidekt import/export confirmation supplies the remaining real-workflow evidence. Their OS/browser and full list were not supplied; no broader format or platform coverage is inferred.

Implementation review: [PR #67](https://github.com/RuneBrix/magic-the-deckbuilder/pull/67).
