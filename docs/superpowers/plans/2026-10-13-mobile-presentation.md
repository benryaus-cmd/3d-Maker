# Mobile Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. All workers read final-goal.md first.

**Goal:** Make Blacktop's mobile driving, close 3D city and compact portrait HUD feel deliberately designed and playable.
**Architecture:** Preserve existing engine/save/gameplay. Independent asset, world and UI work use the contracts in the spec; parent integrates player animation and physics, then verifies the actual production game.
**Tech Stack:** Existing React/Three.js/Vite; locally bundled GLBs/fonts; no additional runtime dependencies.
**Spec:** docs/superpowers/specs/2026-10-13-mobile-presentation-design.md

## Global Constraints
Portrait first, real 3D, no fake display rotation, single React entry, existing Aippy build importer. Preserve final-goal.md and save version/state. No paid asset purchase. Every worker reads final-goal.md. Keep tests behavioural and actual browser evidence separate from device claims.

## Review Focus
- Simultaneous pointers plus keyboard: release only the departing source.
- Camera zoom/rotation: keep player visible, ensure forward road is legible.
- Streaming: matching visual/collision layout, no repeated allocations leaking across chunks.
- Models/textures: local offline bundle, no malformed arrays or missing dependencies.
- Safehouse and pause: camera switches and inputs reset without trapping progress.

### Task 1: Asset palette
Files: assets.ts, CityModels.ts, bundled/city, bundled/roads, bundled/fonts, docs/blacktop-assets.md.
- [x] Inventory existing packs and fetch selected Kenney/KayKit originals, license and font OFL.
- [x] Inspect GLB geometry/dimensions and texture self-containment; write semantic CITY_MODELS roles.
- [x] Verify every referenced key resolves locally and passes the existing asset check.

### Task 2: City/camera/presentation
Files: World.ts and world-focused tests.
- [x] Verify baseline sparse blocks, disconnected skid rectangles, static lighting and weak slow framing in browser.
- [x] Implement detailed road tiles, dense varied blocks/park pockets, lamp/window lighting, day/night, camera contracts, connected skid strips and live car visual motion.
- [x] Browser-check road/car alignment, camera speeds/interior changes, lighting cycle and bounded streamed resources.

### Task 3: Portrait input and HUD
Files: Controls.ts, MobileControls.tsx, crime.css, React section of CrimeGame.tsx.
- [x] Test analog pointer motion/cancel and keyboard coexistence before implementation.
- [x] Implement steering/move stick and pedals, compact font/panels, navigation distance/direction, mode-specific HUD and clear nearby actions.
- [x] Real browser touches at portrait/landscape/desktop; verify boundaries, focus loss, menu closure and no stale input.

### Task 4: Engine integration and feel
Files: engine section of CrimeGame.tsx, vehiclePhysics.ts, scripts/check-crime.mjs, scripts/playtest-blacktop.mjs.
- [x] Add physics expectations for progressive steering, drift/recovery, reverse and frame-rate consistency.
- [x] Integrate analog values, animated local on-foot player, World clock/navigation/camera methods; retain money/missions/save.
- [x] Run invariant and TypeScript checks, production build, then actual production drive/walk/collision/navigation/save tests and resource sampling.
- [x] Review integrated changes, publish screenshots/report and pinned incremental plus full manifests only after verification.
