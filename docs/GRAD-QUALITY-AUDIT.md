# Grad majstora — quality review, 21 October 2026

Scope: standalone TECH game only. Base: `5d49f36a38c43ee0e79976cae9b9f9c40fd4724c`.
The source pin, main platform, Android/PWA and CLEA7 repositories are untouched.

## Baseline evidence before modification

The exact published source passed run `39638954248`: 10 core, 11 dispatch,
16 original browser and 12 living-city browser groups. Existing portal audit:
41 pages, zero runtime-error pages; 15 public game files matched the build.
The 10 + 11 pure rule groups were rerun locally before this change and passed.
These results did not prove the absence of untested logic and UX defects.

## Findings addressed in this revision

- High: the collect command calculated lateness from collection day. Reproduced
  locally: identical completed work paid 100 immediately but 85 after browsing
  other days. Record actual work completion, settle from finished quality,
  and prevent changing the deadline after the work has finished.
- High: starting a new city retained the previous construction undo snapshot.
  Reset transient session state, job preferences and visual effects on project
  replacement. Verify through real browser controls.
- Medium: filtered conversations could retain the detail from a different
  filter. Align selection and detail with the actual filtered collection.
- Medium: equipment purchase showed cash but omitted required materials.
  Show both resource costs and disable unaffordable purchases.
- Medium: atlas upgrades mainly scaled the same image and showed a level badge.
  Add distinct original second/third-tier architecture, construction presentation,
  actual level benefits and visible previews without changing the established style.
- Medium: ambient traffic and work routes were painted above all buildings.
  Depth-sort moving actors with the world instead of drawing through facades.

- Medium: the new exact-resource browser test exposed floating-point ceil errors
  in upgrade prices (home level 3 charged 265 instead of the intended 264).
  Use integer/rational arithmetic and cover all 11 types, three levels and discounts.

## Verification and boundaries

New regression tests must reproduce the above triggers, not only inspect syntax.
Keep all previous suites. Inspect real browser screenshots, mobile layout,
reduced motion, offline saves and legacy migration before publication.
Record actual final CI/publication run IDs below when complete.

No global uniqueness, absolute security or comprehensive legal clearance is
claimed. Art is original project generation, using the owner's existing artwork
as reference. No new third-party runtime libraries, stock assets or telemetry.
Physical device performance and all browser engines require separate testing.
