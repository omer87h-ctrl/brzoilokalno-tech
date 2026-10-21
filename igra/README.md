# Grad majstora — career strategy by Brzo i Lokalno

The primary mode is now **Majstorska karijera**. The player is Adnan, a carpenter
who handles his first incoming client call, works with owned tools, and develops
an independent workshop, employees, vehicle and business territories. Settlement
construction is optional; the original 35-contract city campaign and sandbox
remain separately selectable and backwards compatible.

## Actual loop

Client request → incoming call/clarification → agreed quote → materials and tool
reservation → player/contractor/employee assignment → real travel/work → optional
field routing puzzle → inspection, quality and payment → business investment.
The player never receives a call from himself. Collaborators report completion;
clients call to request a job or handover; suppliers call after actual delivery.

Career has no 35-coin daily grant or housing tax. Company overhead, employee
salaries, vehicle upkeep and unpaid liabilities are recorded. Contractors bring
their tools and are paid by job. Employees use company tools and receive daily
salary. Real tool instances have ownership, compatible skills, reservations,
condition and work-shift wear. Workshop output, instant/next-day material orders,
transport fuel and tool servicing change validated game state.

Kvalitet drives reputation, actual complaints and lasting client-site upgrades.
Business promotion requires completed jobs and acquired assets, not housing
population. Mini games are optional: a no-wager once-per-day break wheel,
original tool-card allocation game, a solvable seeded route puzzle, and a hands-on carpentry bench. The field
puzzle advances an actual working job by one shift, including tool wear. It
respects electrical-outage safety and never teleports a travelling worker.
The carpentry bench has measured points, fastening, bounded mistakes/material waste,
and a shared actual work-step/tool-wear finalizer. No cash bets, real money, paid spins, cashouts, accounts, microphone, GPS,
backend, trackers or external APIs are introduced.

## Contracts and checks

`brzo.grad-majstora/4` adds `community.schema/1` with a closed company, phone,
stock, story and mini-game representation. Formats 1–3 still import. New
`bl.grad-majstora.v4.*` slots isolate state from older running tabs. Unknown
historical expenses are not reconstructed. Fixtures use synthetic game data.

`test_grad_career.cjs` covers real phone semantics, tool consumption, purchases,
delivery exactly once, upkeep, mini-game execution and anti-repeat guards,
legacy saves, and an entire solo-to-regional-company development path using
legal commands, no city buildings and no rescue funds. `test_grad_career_browser.cjs`
performs first call → quote → own tool → booked travel → field puzzle → handover
→ workshop → tool service → supply → leisure, plus 320/360/390 layout,
accessibility, offline persistence and format-3 migration. All older suites stay.
Full career simulation is automated verification, not a human playtime or fun rating.
Physical-device and full browser-engine coverage are not established.

All new code and SVG interface icons are original project work. Reuse the
previous project-generated building illustrations and owner branding. No third-party
game source, game assets, fonts or new runtime dependencies are included.

---
Previous engineering record follows; its older version descriptions are historical.


Original standalone single-player web strategy. No required accounts, GPS,
backend, commercial API, telemetry, third-party runtime dependency or paid currency.
This game is not currently a BIL/BLclea7 runtime application. Its JavaScript
simulation and Canvas 2D renderer must not be advertised as a CLEA7 execution proof.

## Complete play loop

Build homes, workshops and services; balance labor, energy and field capacity;
inspect the deterministic next-day calculation; send the crew; finish contracts;
fund seven civic projects and unlock seven districts. The 35-contract campaign
has an executable completion scenario using only validated game commands.
Sandbox unlocks all districts with a larger starting budget. Both modes persist.

Every plot is adjacent to a validated road network. Visible crew travel uses
actual calculated routes. Cosmetic travel is not an external real-world visit.
Workdays advance only with confirmation. Preview has no save or live-state effects.

## Storage and privacy

Two bounded, checksummed localStorage snapshots alternate by revision. The newest
valid one is loaded. Storage failure leaves a playable in-memory session with a
visible warning and JSON export. This detects accidental corruption, not cheating.
Import rejects unknown versions/fields, invalid values, duplicates and prototype
keys before asking to replace the current city. Concurrent-tab changes pause writes;
localStorage is not a general transaction database or an anti-cheat boundary.

A scope-limited service worker caches only this game's files. It never deletes
another application’s caches. No network data leaves the game except ordinary
same-origin asset requests and a user-initiated external sharing action. Host logs
are governed by the hosting platform. Clipboard and image/JSON downloads require
the player's explicit actions. Reset deletes game snapshots only.

## Originality and licenses

First-party original rules, implementation, interface, geometric city rendering,
vector skyline and optional synthesized notification tone. System fonts only.
No copied game code, branded characters, stock photos, remote fonts or model assets.
`scripts/make_grad_art.py` reproducibly generates the first-party skyline.
No change to repository ownership/license terms is made by this addition.
Playwright 1.56.1 (Apache-2.0), axe-core 4.10.3 (MPL-2.0) and official GitHub
Actions are build/test-only dependencies; their code is not shipped in the game.
No claim of global novelty, legal clearance, trademark registration or invulnerability.

## Verification

`node scripts/test_grad_core.cjs` covers command validation, actual routes,
resource effects, deterministic isolated preview, save attacks, and all 35 contracts.
`node scripts/test_grad_browser.cjs` uses real Chrome served at port 4173; includes
actual controls, downloads/import, restart, mobile layout, reduced motion, storage
failure, concurrent tabs, offline play and accessibility checks. It also generates
the original 1200×630 `share.png` from `share-card.html` in the built site.

The desktop/mobile browser emulation is not physical Android/iPhone testing.
No native APK/Windows packaging, multiplayer or server-backed rankings are claimed.
The existing TECH release source remains pinned; build integration copies this
folder after portal rewriting and counter injection, preserving its privacy boundary.

## Living city update 2.0, October 2026

The existing campaign, economy, specializations and all earlier controls remain.
Six individually scheduled fictional craftspeople, local NPC properties and a
job lifecycle now share the same validated state and deterministic next-day engine.
Requests have real skill, material, wage, budget, availability, route and deadline
constraints. Dialogue facts, in-game calls, proposals, reservation, travel, work,
inspection, one warranty revisit and final payment are executable state changes.
Calls are scripted interactions with fictional characters: no telephone, microphone,
real chat service, external AI or outbound user-content transmission exists.

Original city art: a game adaptation of the owner's original icon and an eleven-
building atlas were generated for this project with OpenAI's image tool. Sources
are retained locally at creation; optimized WebP derivatives are stored as base64
in deployment assets and decoded only into the game output. These are newly
created illustrations, not stock photographs or assets copied from another game.
No global novelty, trademark clearance or absolute copyright guarantee is asserted.
The owner's source icon and existing legal notices remain unchanged. FFmpeg was
used as a development-only image encoding utility, not distributed with the game.

Canvas sprites follow actual object types and upgrade levels. Fictional residents
have their own non-player properties. Named worker routes/status markers follow
booked jobs. Other cars/pedestrians are clearly ambient traffic: they do not create
fake jobs, money or reviews. Ambient rendering is capped at eight actors and about
24 animation callbacks per second; it pauses when the map is hidden or outside the
viewport and respects reduced motion. There is a user control to stop ambience.
This is not a battery benchmark or physical-device performance certification.

Save format `brzo.grad-majstora/2` retains the original town fields and adds a closed
versioned dispatch record. Version-1 checksums are verified before migration. New
storage keys are separate from version 1 so an older tab cannot overwrite new data.
A migration marker prevents resurrecting legacy data after reset. JSON backup
imports remain available for both formats; resetting deletes game saves only.
Per-character conversations and job history have explicit size limits. The checksum
is accidental-corruption detection, not anti-cheat or signature authentication.

Additional verification: `node scripts/test_grad_dispatch.cjs` and
`node scripts/test_grad_living_browser.cjs`. The latter uses real Chrome controls
for migration, calls, declined/accepted offers, a busy craftsman, actual reservation,
travel/work/payment, literal chat text, profiles, traffic pause/reduced motion,
mobile accessibility and offline restart. Source snapshots and CI logs distinguish
executed automated tests from device testing that has not been performed.

## Version 3: quality and visible development

Three distinct, originally generated architecture atlases are rendered by the same
first-party renderer in the map and level previews (11 types × 3 tiers). Images
are self-hosted, transparent, compressed WebP. PNG source generations remain
outside the public repository; this repository records the distribution assets.
No stock/game assets, fonts or new runtime libraries were added.

Confirmed construction has a bounded 1.8-second visual scaffold/reveal. It adds no
real-time waiting requirement or additional resource charge. Reduced motion shows
the finished state immediately. Road actors participate in world depth ordering.

`brzo.grad-majstora/3` contains dispatch schema 2 with `finishedDay`. Work quality
is computed at actual completion; waiting to collect does not add a second lateness
penalty. The recorded finish determines late statistics. For old saves, migration
uses the genuine retained finish message where present; otherwise 0 means unknown,
not an invented timestamp. Existing formats 1 and 2 are still imported. New
`bl.grad-majstora.v3.*` slots isolate newer state from older running tabs.

`node scripts/test_grad_quality.cjs` checks settlement, actual late work, historical
migration, timestamp validation, level effects and a deterministic 120-day legal
job/build simulation. `test_grad_quality_browser.cjs` verifies all 33 sprites,
construction, tier UI, fresh-city undo/preferences, filters, exact equipment costs,
legacy storage isolation, high-building picking, 320/360/390 layouts and offline
restart. These complement all existing tests; see actual CI results.
