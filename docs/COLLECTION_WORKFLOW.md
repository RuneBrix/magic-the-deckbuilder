# Collection workflow

Implemented in [PR #86](https://github.com/RuneBrix/magic-the-deckbuilder/pull/86).

Collection fills the available page width and offers text and visual layouts with name, quantity and set/printing sorting. Edit and Remove stay inside each lot listing.

Add owned card searches paper card names after two characters using contains matching. Selecting a result opens a staged editor with artwork, paginated printing choices, finish, condition and absolute quantity. The current stored quantity is shown for the selected printing/finish/condition. Plus, minus and direct number entry change the draft. Update collection applies reviewed quantities; Cancel, Escape and X discard them. Zero removes that lot.

Import card list accepts the same quantity/name lines and zone headings as deck import. Review resolves every name before applying. Imported copies add to regular-finish lots with condition not recorded; headings do not create collection zones. Unresolved names and invalid quantities block the whole import. This text flow does not import external inventory CSV formats or infer set/condition/finish fields.

Complete workspace v2 files retain the collection and deck budget settings. Each deck independently allocates owned copies; Main, Command and Sideboard count toward planning, while Maybeboard remains excluded.
