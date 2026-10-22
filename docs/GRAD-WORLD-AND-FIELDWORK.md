# Recorded world, driving and real work — version 5

This is an incremental extension of the existing original standalone web game.
It does not modify the main platform, Android/PWA or private CLEA7 ecosystem.

## World and guidance

The original isometric projection and owned 33 building illustrations are retained.
New first-party Canvas road surfaces, pavements, crossings, vehicles, scaffolds and
company anchors represent actual world and company state. Completion/payment effects
come from observed job transitions. Reload/import does not replay them. Reduced
motion shows a static result. Hidden maps defer their bounded effects until visible.
A single bounded terrain cache avoids regenerating unchanged ground every frame.

The first-career-task guide reads the actual Haris shelf job and links each next
action directly. It never assigns, charges or finishes work merely by displaying
the guide. Result notices distinguish finished work awaiting handover from payment.

## Recorded days

Format 5 adds community schema 2 with actual bounded daily map snapshots (60 days).
Same-day actions update the current frame; old frames remain detached. Importing
formats 1–4 starts history at the imported day, without fabricated earlier history.
Historical inspection uses a separate read-only map, never a live-state rollback.
Snapshots contain no chat text or recursive history. A maximum-building/full-chat
capacity test remains below the bounded parser and file limits. Storage keys use
a new generation so an older open game cannot overwrite new progress. Previous
story recovery is carried across generation migration.

## Vehicle and repairs

A driving session belongs to Adnan's actual travelling job. Each controlled move
advances one legal road-grid position. Steering, braking, route guidance, parking
and actual arrival are stateful; a timer never invents route completion. The
perspective cockpit interpolates those real moves. It is a grid-driving strategy
mechanic, not a continuous physics engine. Rental is charged once; owned dispatch
fuel is credited so entering the cockpit does not charge fuel twice. Normal day
progression remains available and closes an outdated manual session.

Water and electrical work sessions require a real working job. Isolation, diagnosis,
repair and test are ordered and persist across reload. Final testing calls the
existing work-step/tool-wear implementation. It never bypasses outage guards,
creates a payment or completes an unrelated job. Existing carpentry stays available.
All artwork and input handlers are first-party; no copied game assets, proprietary
fonts, telemetry, backend, accounts, GPS or paid service is introduced.

## Verification

Run all original suites plus test_grad_history.cjs, test_grad_fieldwork.cjs,
test_grad_mobile.cjs, test_grad_world_browser.cjs and test_grad_fieldwork_browser.cjs.
The browser suites use real Chrome actions and CDP touch sequences. Android-profile
emulation is reported separately from physical Android or an Android emulator.
See GRAD-MOBILE-TESTING.md for the real-device checklist; no physical-device result
is claimed. Published evidence is the exact-head Actions run and release logs.
