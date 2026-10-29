# Card details and printing choices

Implemented for [#25](https://github.com/RuneBrix/magic-the-deckbuilder/issues/25) and [#26](https://github.com/RuneBrix/magic-the-deckbuilder/issues/26).

## Facts and deck context

Details separates full card artwork, mana/type/Oracle text, card facts, stored legality and release metadata from a named deck section. Multiple image faces remain complete. A full-editor row opens that row’s stored printing, even if search results contain another printing. Exploration targets only its explicitly tracked deck; with no tracker, general facts and candidate collection remain available and Add to… requires a destination. A card absent from the target’s Main deck can be added there; a sideboard/command entry is edited by inspecting its row.

The deck section names the deck, zone, copy count and stored printing. Personal roles are the existing ordered `tags` array: first role controls primary-function grouping, every role remains filterable and counted in statistics. They are browser-local personal labels, distinct from public Scryfall function tags. Examples are placeholders, never saved default roles.

Valid comma-separated role edits save on input without replacing the raw input or moving the cursor. Empty input deliberately removes roles. Tags longer than 80 characters and input longer than 500 characters are rejected without truncation or deck mutation. Invalid text remains visible across printing previews and failed zone moves; Close/Escape/backdrop dismissal waits for correction or an explicit Discard unsaved role text and close action. An active invalid draft also requests the browser’s normal navigation/reload warning where supported. No browser can guarantee retention after a forced close. Storage failures identify session-only changes and recommend JSON export.

Zone selection saves immediately. Moves preserve every copy and ordered roles; merging retains destination roles followed by incoming roles, without duplicates. The destination printing wins on a merge, because storage has one printing per rules identity per zone. Quantity overflow aborts the move atomically. Detail actions retain their original named deck even if another deck becomes active, and reject removed decks/entries.

## Previewing and storing a printing

Browse printings performs an on-demand lookup; reopening details does not automatically fetch the complete printing list. Results use a labeled native set/printing selector with set name, collector number, language and release date. Pages load explicitly with Load more printings. Loading, failure/retry, missing identity and unavailable artwork are visible; failures retain the existing preview and deck. Responses from dismissed/replaced dialogs are ignored.

Selecting a printing changes only the preview, including artwork, release facts and the Scryfall link. **Use viewed printing in [deck] · [zone]** explicitly changes all copies of that named entry. Quantity, zone, personal roles and rules identity are preserved; the latest stored legality is retained. Other zones are independent. Add 1 increments an existing entry without replacing its printing; a new entry uses the viewed printing. Save candidate collects this viewed printing into the session-only shortlist without replacing a role draft. View candidates opens the overview after valid edits; optional two-card comparison lives there ([#24](CANDIDATES.md)).

Printings use a fixed local `/api/printings` endpoint with a validated Oracle UUID and bounded page number. It queries paper printings in release order through the existing Scryfall timeout, global rate queue and five-minute cache; it never follows client-supplied upstream URLs. Each returned printing is checked against the original identity and backup-compatible card shape. Same-identity reversible-card faces are normalized into a canonical root identity/rules record while retaining both artwork faces; mismatched identities remain rejected. Snapshot metadata can be missing or stale. This adds no ownership, condition, foil selection or price policy.

Scryfall’s [official card types](https://github.com/scryfall/api-types/blob/main/src/objects/Card/CardFields.ts) document printing/release fields and the reversible-card exception for root Oracle identity. The ordinary Scryfall documentation pages returned 403 during this task; query behavior was additionally verified through the live API and controlled proxy tests.

## Preservation and interoperability

The selected printing is the existing entry’s stored `card` object, so complete per-deck/workspace JSON backup, restore and duplication retain it without a schema migration. One entry cannot represent several different printings in the same zone. Text import/export promises names, quantities and supported zone headings; it does not preserve selected printings or personal roles. A printing suffix accepted in a text import does not select that printing. Expanded external formats remain #6.

Automated checks cover validation/merges, preview versus apply, identity rejection, reversible cards, JSON preservation, role drafts, bound deck context, stale dialogs, failures, pagination and proxy caching. Platform/browser checks and their limits are recorded in the implementation PR.

Windows live checks also verified two complete artwork faces for Delver of Secrets with no tracked deck and an explicit destination chooser, 350 Forest printings across two pages, and no browser console errors in the inspected session.
