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

Review import displays the total copies ready and their destination. Missing or ambiguous identities block the whole import and list only affected names. Syntax and lookup failures retain the list for correction or retry. Edits invalidate a completed review or pending result. Import reviewed cards applies to the current destination contents atomically, preserving edits made during lookup and rejecting overflow. Closing the dialog cancels an unapplied review. A separate confirmation reports the saved copies.

Both new-deck and existing-deck imports save the staged workspace before changing the library or destination. A rejected write leaves the review available and the live workspace unchanged; retry applies the reviewed copies once (#226).

Text preserves quantities, names and explicit zones, including commander designation and Maybeboard. Export uses Arcana’s Main deck/Command zone headings, which its importer reads back with equivalent meaning. Name resolution is case insensitive. A unique full card name takes precedence over incidental face matches. An exact face name can resolve to one rules identity, and repeated printings of that identity do not create ambiguity. Imports use Scryfall’s bulk collection lookup and batch exact searches for names without a full-name match. A trailing `(SET) collector-number` is accepted but discarded and never promises printing preservation. New additions retain the resolved printing, its default finish and shared automatic primary function; exact printing/finish matches increment their existing entries while retaining manual functions. [Printing/default details](CARD_DETAILS.md#preservation-and-lookup). Text does not preserve exported personal functions, bracket assignments, deck metadata or arbitrary Archidekt custom categories. Use complete JSON for those. JSON and CSV Archidekt modes, category headers, inline metadata and other export options are outside this contract.

The sample above is a small representative fixture derived from the supplied export settings, not the user’s personal 183-card deck. The user subsequently confirmed successful Archidekt deck import and export and accepted the options on 1 November 2026. This is user-reported workflow validation, not an agent reproduction of the full personal list. [Issue #6](https://github.com/RuneBrix/magic-the-deckbuilder/issues/6) is complete for this selected scope.

## Export options (#176, #233, #238)

Export deck defaults to plain TXT with all four zones, zone headings, quantities and card names. Zones can be selected independently. Category inclusion/exclusion follows the editor's Type or primary Function grouping. Export uses Type from the library or when the editor has no grouping. Category selection applies to all selected zones, including Command. Group export uses the same format controls, starts with CSV and metadata selected, and stays scoped to the group and zone shown in the menu.

Section headings can use Zone, Type or Function. Zone sections keep the standard export order and category sections sort alphabetically. Row sorting applies within sections and can follow deck/group order, name or descending quantity. CSV puts the section value in its first column when selected. TXT uses plain decklist rows for quantity and name, and tab-separated columns when metadata is selected. Rows combine within each section when they share the stored card name and selected metadata. Set, collector number, finish and language can distinguish rows. The example shows the first exported data row with its applicable headers. An empty selection disables download.

Owned and missing copies use the same allocation helper and saved matching setting as Ownership & costs. The helper allocates across the selected cards in Main deck, Command zone, Sideboard, Maybeboard order, then current printing ID. Filtering out a category or zone can free owned copies for other exported entries. Options and downloads leave saved decks and inventory intact.

Complete JSON backup always includes the complete deck and remains the recovery format for printings, finishes, ordered functions, companion designation and brackets. The decklist importer supports the plain quantity/name TXT format with optional zone headings. **Upload collection** also accepts tab-separated deck TXT with quantities, card names and printing fields. [Collection upload](COLLECTION_WORKFLOW.md#upload)

## Verification

Use the [card lookup and import verification cases](DEVELOPMENT.md#card-lookup-and-import-verification) for changes to name matching, resolved defaults or applying reviewed deck imports.

1 November 2026: all 106 native Node tests pass on Windows/Node v24.14.1, including unresolved/ambiguous resolution, invalidated/in-flight reviews, overflow rollback and quantity/zone round trips. Live Windows in-app-browser checks cover missing-name feedback without mutation, corrected review, Enter application into all four zones, reload persistence, Escape cancellation/focus return, desktop light and 390px dark layout. Phone page/dialog widths were 390/358px with no horizontal page overflow. Browser version was not exposed/recorded; physical touch and macOS/Safari remain untested. The user's subsequent Archidekt import/export confirmation supplies the remaining real-workflow evidence. Their OS/browser and full list were not supplied; no broader format or platform coverage is inferred.

Implementation review: [PR #67](https://github.com/RuneBrix/magic-the-deckbuilder/pull/67).
