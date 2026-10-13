# Persistent economy execution ledger

Authority: final-goal.md sections 2, 6, 9, 10, 12; how-to-achieve-final-goal.md S1.
Scope: four existing goods and nine contacts, persistent bounded markets, validated atomic trades, vehicle/stash inventory cost basis, safehouse banking and a readable portrait trading UI. Firearms follow this completed economy pass.

Ruling: retain the existing save storage key, migrate its payload to v3 and preserve a v2 backup — maintains Aippy/browser saves without a reset. Invalid new economic state recovers from last-known-good v3 backup before legacy migration.
Ruling: current fleet supports one owned example per model. Stable inventory IDs use vehicle:<model> and stash:midtown; multiple same-model vehicle instances remain a later ownership migration.
Ruling: no offline replenishment/income in this slice. Simulation runs only during active street/interior play and freezes in menus/background.

Tasks:
- [x] Baseline and failing economy/domain/save tests.
- [x] Pure economy: clock, stock, demand, prices/events, transactions, receipts/history, inventory/cost basis.
- [x] Save v3 validation/migration/recovery and engine trade/inventory integration.
- [x] Trade screen, market intelligence, safehouse cargo/bank UI.
- [x] CI/domain regression, production browser buy/drive/sell/reload and long balance probe.
- [x] Whole-change review, fixes, report, runtime commit and exact importer manifests.

Pre-flight: Economy owns GOODS/MARKETS to avoid a runtime cycle. Systems reexports them and adapts existing save/cargo/car APIs. Engine UI callbacks submit snapshot quote/id and actual contact context. The save contains all transaction state; no financial consequence is driven solely by presentation. Inventory facade cargo points at active vehicle quantities; switching/confiscating updates matching costs.

Verification so far: economy 19 groups; crime handling/economy/mission; world; nine other crime suites passed. Fresh TypeScript and production Vite build passed. Production economy browser: 32 assertions including real Midtown-to-Financial drive, profit reconciliation, reload, replay rejection, save-failure rollback, stash and bank. New UI red test caught offscreen BUY; sticky actions made it green. Archived suite remains 500/509 with the same nine previously recorded dormant-game failures.

Final review: two important findings fixed: malformed financial inventory now rejects primary and restores valid backup; remote safehouse cargo transfer blocked in engine/domain/UI. Both regression tests were observed failing before fixes. Countdown carry formatting also fixed with an actual React render regression. Final targeted suite: 13/13 commands green, including21 economy groups and rendered UI countdown. Production economic browser expanded to34 assertions; original controls21 and immersion17 also passed. No deferred review findings.

Published runtime e1ae7eb5f0a954f12f2f7e55b4a2ef1354eb3ed9; Node 22 frozen CI run38351803592 success. Import manifests:9-file incremental and84-file full snapshot, exact paths checked against published tree. Final review findings resolved; no deferred minors.
