# Double-click startup (D08)

On 1 November 2026 the user selected **easier startup by double-clicking** for [#8](https://github.com/RuneBrix/magic-the-deckbuilder/issues/8). Keep the existing browser/Node architecture and provide small launch scripts. Native desktop packaging is deferred until there is a need beyond startup; no wrapper, installer framework, account or paid service is selected.

## Options and decision

| Option | Startup and installation | Updates and distribution | Decision |
| --- | --- | --- | --- |
| Current terminal command | Node 22+ and checkout; run npm start, then open browser. | Update the checkout manually. | Retain for development and fallback. |
| Double-click launcher | Same Node/checkout prerequisite; Windows .cmd or macOS .command starts the server and asks the OS to open the default browser once ready. | Plain source scripts; update alongside the checkout. | Selected for the stated need. |
| Standalone native package | Could bundle a runtime and remove Node setup; would need platform-specific builds, installation and lifecycle decisions. | Requires a distribution/signing/update policy and storage-origin migration before a wrapper can be chosen. | Deferred; separate implementation issue if the need changes. |

## Use

Install Node.js 22 or later and make it available on PATH. Keep the complete checkout together, including public/ and scripts/. On Windows, double-click **Start Arcana.cmd**. On macOS, **Start Arcana.command** is provided for verification; a Git checkout retains its executable bit. If an extracted copy is not executable, set its executable permission once (`chmod +x "Start Arcana.command"`). Do not change system execution or security policies to make the script run.

The terminal remains open and owns the server. Keep it open while using Arcana; press Ctrl+C to stop it. The launcher checks the Node version, starts the existing loopback-only server, waits for listening and requests the default browser at `http://127.0.0.1:3000`. If opening fails, use the printed URL manually. CLI fallback: `node scripts/start.mjs --no-open` starts without opening a browser; `--check` checks the Node prerequisite without starting a server. npm start stays available.

Use the same browser/profile and origin as before. If an earlier workspace used localhost rather than 127.0.0.1, open that previous address to export a JSON file, then explicitly open the file in the new origin. Launching does not migrate or erase browser storage. A deliberately configured PORT is honored, but changing it selects a different browser workspace. The launcher never silently falls back to another port. If the selected port is occupied, it exits; stop your own earlier Arcana server or open its address manually. No unknown process is killed or adopted.

The launcher does not install Node, run npm install, make network requests for setup, add a background service, create a native app, or enable automatic updates. Starting and editing stored decks can work without internet after prerequisites are present; search, uncached artwork, printing lookups and live-data refresh still need internet. Portable JSON is the migration/recovery path for any future package.

## Packaging implications retained for future review

For downloaded macOS apps/installer packages, Apple describes Developer ID checks and notarization under Gatekeeper; a future packaged distribution must plan for those checks and platform-specific builds rather than promise unsigned friction-free installation. Source launchers are not a signed/notarized app and may still be subject to local download/permission rules. [Apple's distribution/security guidance](https://support.apple.com/en-us/102445).

Windows provides Authenticode signing and SignTool for signing, verifying and timestamping supported artifacts. A future installer must choose a packaging/signing/update route and test the actual distribution experience; this PR does not create a trusted installer or promise absence of reputation warnings. [Microsoft SignTool](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool). Platform claims checked 1 November 2026.

Native wrapping would also require a stable storage origin, a complete backup migration path, runtime security updates and a manual/automatic update decision. None is needed merely to open the existing server/browser flow. Browser opening uses the OS default association ([Windows start reference](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/start)); no personal URL is accepted by the launcher.

## Verification

Windows Node v24.14.1: launcher --check and the Windows wrapper pass from a path with spaces and a different working directory; missing Node prints recovery guidance and fails. A headless launcher smoke check serves the real app over loopback; an occupied-port test leaves the existing listener intact and never changes origin. Full native suite results are recorded in the PR. Default-browser association and an actual Explorer double-click are not manually verified in this session. macOS Finder/Terminal/Safari and physical touch remain untested; CI's Node tests are not substitutes for those manual checks. This decision closes D08's choice/scoping work, not the separate macOS verification in #5.

Implementation review: [PR #74](https://github.com/RuneBrix/magic-the-deckbuilder/pull/74), stacked on #73.
