# Blacktop live-testing verification — 14 October 2026

Runtime UI exposes 226 real values with per-field reset, complete reset, separate persisted overrides, JSON copy/download/import and live stats. Production browser 23 checks passed with no page errors, three mobile viewports, real camera/renderer/input/persistence operations and a labelled clipboard writer fixture. [Raw evidence](live-settings-2026-10-14/live-test-browser.json) and [portrait capture](live-settings-2026-10-14/portrait.png).

Local TypeScript and Vite production build pass. Native regressions verify persisted zero/automatic-clock values, isolated reset, finite edits, starting-ammunition definitions and actual collider queries. Existing physics, weapons, police, economy, empire, scenery and presentation checks retain their committed defaults. Generated Node test loaders were updated to resolve the new shared module; their assertions were preserved.

Independent review fixes: indoor simulation speed, full crash mute, immediate population reduction, zero/integer ranges, live starting ammunition; unused weapon fields excluded. Game saves/credits/host/dependencies are preserved. Test override data uses a separate key. This utility is not a physical Android benchmark.

Published runtime `edbb77e1a833ca650688c913ba8f52dced93906e`. Node 22 frozen CI [38471882658](https://github.com/benryaus-cmd/3d-Maker/actions/runs/38471882658) SUCCESS; [log evidence](live-settings-2026-10-14/node22-ci.json). Incremental 16 files and full 99 files pinned to this runtime; exact paths/counts checked against the Git tree.
