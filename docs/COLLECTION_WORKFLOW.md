# Collection workflow

Implemented in [PR #86](https://github.com/RuneBrix/magic-the-deckbuilder/pull/86).

## Upload

Choose a TXT/CSV file or paste text. Syntax validation runs locally; no lookup occurs until Upload is pressed. Valid data enables Upload, which resolves and adds the cards without displaying a complete resolved-card review. Lookup failures keep the collection unchanged and preserve temporary successful lookups for retry. Closing/reloading discards upload progress.

Quantity/name text accepts card rows such as `2 Sol Ring`. Deck zone headings and invalid lines are listed under “Could not process the following cards”; confirm skipping them to upload valid rows. Lists are limited to 5000 card rows and 15 MB.

CSV accepts Quantity/Qty, Name/Card Name, Finish/Foil, Condition, Language/Lang and Edition/Set Name or Code. Quantity and Name are required. Unrecognized columns such as purchase price/tags are named as not counted and require explicit confirmation before upload. CSV without recognized headings opens column mapping with first-row-as-headings control before syntax validation. Duplicate/conflicting relevant mappings, malformed quotes, invalid values and unequal row widths block upload. Quoted commas, escaped quotes and duplicate card rows work.

Normal maps to internal regular and Scryfall nonfoil; common finish booleans, condition abbreviations and language names/codes normalize. Omitted finish/condition become regular/unrecorded. Text/CSV examples are separate, labeled and subdued; placeholders use muted italic styling. The editable textarea starts empty.

Matching printing/finish/condition rows add quantities; language is preserved by printing ID. Explicit set/language must identify a supported printing. Unspecified printings use compatible stored/default facts; foil-only defaults trigger alternate lookup. Full double-faced names can use a validated front-face fallback. The former three-card Aang example passed live lookup; the current upload test can be explicitly rerun with `ARCANA_LIVE_CSV=1` and the `live localhost upload` filter in a disposable VM.

## Efficiency and cooldown

Reuse compatible cards from the collection, decks and a bounded session cache, indexed by full and face names. Only unresolved names enter 75-name batches; set/language rows skip redundant default lookup. Duplicate alternate searches and successful batches remain cached in the open dialog. Progress is reported during resolution.

The server shares a paced queue across endpoints, waits at least 600 ms after each upstream request, coalesces identical pending lookups and caches responses for five minutes. A 429 blocks queued/new requests for at least 60 seconds or longer Retry-After. Resume upload requires an explicit action after cooldown. Other processes on the same IP are outside this queue. See [research and bulk-index tradeoffs](COLLECTION_IMPORT_RESEARCH.md). The full first-time collection has not been benchmarked.

## Collection display

View has only Visual cards and Text. Text is a single table with compact rows, columns for quantity, name, color, printing, finish, condition, language, regular EUR price, added date and updated date. Every data header sorts its column and toggles direction, synchronized with Sort by. Actions stay together in a sticky right-hand table column; wide tables scroll horizontally on phones. Visual cards retain fixed portrait widths and consistent unbordered Edit/Remove controls.

Group by offers none/type/color/set. Filter matches required terms in name/type/set. View, grouping, sorting and filter persist locally; initial settings use visual cards, no grouping and newest-added first. Old horizontal/vertical text settings migrate to Text. Legacy missing dates display a dash and use stored-order fallback. New lots record dates; edits preserve added dates.

Add owned card searches after one literal prefix character in an anchored dropdown. Arrow keys and Enter select results. Its staged editor shows artwork, paginated printing choices, finish, condition and absolute quantity. Plus/minus/direct entry change drafts. Update collection applies them; Cancel/Escape/X discard them. Zero removes the selected lot.

Workspace v2 retains collection and deck planning. Each deck independently allocates ownership across Main/Command/Sideboard, excluding Maybeboard. No cloud account or global deck reservation is introduced.
