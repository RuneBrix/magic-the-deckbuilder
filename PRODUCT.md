# Arcana
<!-- impeccable:product-schema 1 -->
## Platform
web
## Stack
Native browser modules, CSS and a Node.js 22+ standard-library server. No install dependencies, authentication or cloud synchronization. Windows local development; README.md records automated cross-platform coverage and manual verification limits.
## Users and purpose
Magic players building decks and exploring cards who currently move between Scryfall, Tagger and Archidekt. Bring discovery, deck editing, statistics and bounded format feedback into one local workspace.
## Capabilities and constraints
My decks is startup/reload home and opens a dedicated editor. Explore cards retains search during session navigation and can track a separate deck or none. Guided filters and function discovery share one editable Scryfall query; unsupported expressions remain intact. Taxonomy and Commander Game Changer data are dated snapshots with documented update limits.

Main deck, Sideboard, Command zone and Maybeboard persist in browser storage. Maybeboard holds ideas outside playing totals, statistics, construction checks and bracket calculations. Personal functions are ordered private labels, separate from Scryfall classifications. Complete JSON preserves printings, zones, functions and bracket assignments; text interchange preserves the selected names/quantities/zones contract. Imports and edits preserve existing data on validation failure.

Modern construction checks are the selected supported family. Commander, companions and unusual rules remain partial. Commander brackets are player-assigned, with discussion guidance rather than automatic power ratings. Reversible broadening is available; candidate shortlists/pair comparison were removed by user decision (#47). Automatic similarity, upgrades and synergy rankings are absent.

See [FEATURES.md](docs/FEATURES.md) for capabilities and [DESIGN.md](DESIGN.md) for interface intent. [DEVELOPMENT.md](docs/DEVELOPMENT.md) defines feedback, GitHub PRs, local inspection and developer-approved merging. Checked-out source/tests define behavior; package version 0.1.0 is a development identifier, not a published release or proof of review.
## Open decisions
Portable local files are the selected transfer/recovery direction; cloud accounts/sync are deferred. Easier startup uses source launchers; native packaging is deferred. Local collection ownership and EUR ownership/budget estimates are implemented (PR #86); see docs/COLLECTION_WORKFLOW.md for the current contract. Repeat-upload safety, pricing coverage and refinements remain issue work. Live taxonomy sync, automatic function classification and fuller Commander/companion coverage remain future work. [ROADMAP.md](docs/ROADMAP.md) links topics to GitHub criteria. Keep unspecified decisions open for feedback.
