# Collection workflow

Implemented in [PR #86](https://github.com/RuneBrix/magic-the-deckbuilder/pull/86).

Collection fills the page with compact View, Group by, Sort by and Filter cards controls. Visual cards retain fixed portrait sizes; horizontal/vertical text views use compact rows. Group by type, color or set, or leave ungrouped. Sort by date added, updated at, name, quantity, color, regular EUR price or set/printing. Initial settings use visual cards, no grouping and newest-added first; the last-used controls and filter are remembered in this browser. Older lots without dates use their stored order as a fallback. New lots record added/updated dates, and edits preserve added dates.

Add owned card searches after one character. The dropdown is anchored to the input and contains only matching card results. Typed characters are literal and match the beginning of card names. Arrow keys and Enter select results. Selecting opens a staged editor with artwork, paginated printing choices, finish, condition and absolute quantity. The current stored quantity is shown for the selected printing/finish/condition. Plus, minus and direct entry change the draft. Update collection applies it; Cancel, Escape and X discard it. Zero removes that lot.

Import card list accepts the same quantity/name lines and zone headings as deck import. Review resolves every name before applying. Imported copies add to regular-finish lots with condition not recorded; headings do not create collection zones. Unresolved names and invalid quantities block the whole import. This text flow does not import external inventory CSV formats or infer set/condition/finish fields.

Complete workspace v2 files retain the collection and deck budget settings. Each deck independently allocates owned copies; Main, Command and Sideboard count toward planning, while Maybeboard remains excluded.
