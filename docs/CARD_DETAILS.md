# Card details and printing choices

Implemented for [#25](https://github.com/RuneBrix/magic-the-deckbuilder/issues/25) and [#26](https://github.com/RuneBrix/magic-the-deckbuilder/issues/26).

## Facts and deck context

Details separates full card artwork, mana/type/Oracle text, card facts, stored legality and release metadata from a named deck section. Multiple image faces remain complete. A full-editor row opens its stored printing and initially selects that deck/zone, even if search results contain another printing. Exploration initially selects its tracked deck and Main deck; with no tracker, the deck selector starts empty. The player can select any deck and zone in the dialog. Selecting a target changes only the controls: the viewed printing stays in place and no cards move or change.

The deck section exposes labeled Destination deck and Deck zone selectors, compact minus / current quantity / plus controls, and the selected entry’s stored printing. Quantity is counted only in the selected zone, never summed across zones. Plus adds one copy; minus removes one copy and removes an entry when its quantity reaches zero. An existing entry retains its printing and Functions; a new entry uses the viewed printing. Plus requires a selected deck and respects the 500-copy/1,000-entry limits. Functions remain the ordered `tags` array: the first controls primary-function grouping, and every function remains filterable and counted in statistics. These private labels are separate from Scryfall tags.

Valid comma-separated Functions edits save on input without replacing the raw input or moving the cursor. Empty input deliberately removes Functions. Tags longer than 80 characters and input longer than 500 characters are rejected without truncation or deck mutation. Invalid text remains visible across printing previews. Switching deck or zone, changing quantity, applying a printing, and Close/Escape/backdrop dismissal wait for correction or an explicit Discard unsaved function text and close action. An active invalid draft also requests the browser’s normal navigation/reload warning where supported. No browser can guarantee retention after a forced close. Storage failures identify session-only changes and recommend JSON export.

Zone selection chooses a target; it does not move cards. Existing card-menu move actions retain validated copy/Function merges and destination-printing preservation. Detail actions stay bound to the explicitly selected deck and zone even if the tracked deck changes, and reject removed decks/entries. Selection retains the zone when changing decks. Quantity edits keep keyboard focus on the copy control; removing the last copy focuses plus. Closing returns focus to the original inspected card where available.

## Previewing and storing a printing

Browse printings performs an on-demand lookup; reopening details does not automatically fetch the complete printing list. Results use a labeled native set/printing selector with set name, collector number, language and release date. Pages load explicitly with Load more printings. Loading, failure/retry, missing identity and unavailable artwork are visible; failures retain the existing preview and deck. Responses from dismissed/replaced dialogs are ignored.

Selecting a printing changes only the preview, including artwork, release facts and the Scryfall link. **Use viewed printing** explicitly changes all copies of the selected deck/zone entry; a nearby label names that target and quantity. A matching stored printing shows disabled **Printing already selected** with a normal cursor. Quantity, zone, Functions and rules identity are preserved; the latest stored legality is retained. Other decks and zones are independent. Candidate controls and optional pair comparison were removed in [#47](CANDIDATES.md); role-draft validation and dismissal protection remain.

Printings use a fixed local `/api/printings` endpoint with a validated Oracle UUID and bounded page number. It queries paper printings in release order through the existing Scryfall timeout, global rate queue and five-minute cache; it never follows client-supplied upstream URLs. Each returned printing is checked against the original identity and backup-compatible card shape. Same-identity reversible-card faces are normalized into a canonical root identity/rules record while retaining both artwork faces; mismatched identities remain rejected. Snapshot metadata can be missing or stale. This adds no ownership, condition, foil selection or price policy.

Scryfall’s [official card types](https://github.com/scryfall/api-types/blob/main/src/objects/Card/CardFields.ts) document printing/release fields and the reversible-card exception for root Oracle identity. The ordinary Scryfall documentation pages returned 403 during this task; query behavior was additionally verified through the live API and controlled proxy tests.

## Preservation and interoperability

The selected printing is the existing entry’s stored `card` object, so complete per-deck/workspace JSON backup, restore and duplication retain it without a schema migration. One entry cannot represent several different printings in the same zone. Text import/export promises names, quantities and supported zone headings; it does not preserve selected printings or personal roles. A printing suffix accepted in a text import does not select that printing. Expanded external formats remain #6.

Automated checks cover validation/merges, preview versus apply, identity rejection, reversible cards, JSON preservation, role drafts, bound deck context, stale dialogs, failures, pagination and proxy caching. Platform/browser checks and their limits are recorded in the implementation PR.

Windows live checks also verified two complete artwork faces for Delver of Secrets with no tracked deck and an explicit destination chooser, 350 Forest printings across two pages, and no browser console errors in the inspected session.
