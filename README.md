# Brzo i Lokalno TECH — local release configuration

Source: `omer87h-ctrl/brzoilokalno-website/tech/`. Destination: `tech.brzoilokalno.com`.
Only the TECH source tree is copied. The primary site, Android and PWA are not read or modified.

The creator suite is named **Tech Environment Zero to One**. Public pages use `/environment-zero-to-one/`; existing `tech-x/` HTML addresses redirect with query/hash preserved. Internal legacy source names and storage keys remain compatible.

Publishing requires owner approval. There is no scheduled deployment or floating-main source checkout. Only an explicitly edited `release.json` on main triggers publication.
After owner approval, record the approved full source SHA in `release.json` or manually dispatch `.github/workflows/deploy-tech.yml`.
The workflow rejects unpinned revisions and runs real Chromium smoke checks before deploying. Playwright 1.56.1 (Apache-2.0) and Node setup are CI-only dependencies; neither is shipped to visitors. Configure GitHub environment required reviewers if account capabilities allow it.
The workflow still invokes official GitHub Actions dependencies; no paid API or user-content service is added.

Local build: `python3 scripts/build_tech.py` from this directory, with TECH at `upstream/tech`.
Generated `_site/` is a review artifact and must not be confused with a published site.
External GitHub raw-feed URLs retain their source `/tech/` directory; only quoted root-relative TECH routes are rewritten.
Do not alter the main platform for this release. Browser/device verification remains a release requirement.

## Whole-portal quality release, 12 October 2026

Approved source release corrects mobile overflow in Academy/editor/slides, indexes real applications and existing catalogs in local search, removes all visible variants of the old brand, labels editor/software/data-tool navigation distinctly and expands nine original practical guides. Existing phone data, podcast/advertisement publication state, user storage keys and all portal sections are preserved.

Deployment is gated on creator export/search/storage smoke checks plus a whole-portal browser regression at desktop/390/360px before Pages publication. The latter retains JSON and screenshots as a seven-day GitHub artifact. axe-core 4.10.3 (MPL-2.0) is CI-only. Passing automated checks does not establish real Android hardware, exhaustive accessibility or legal clearance.

Local script and stylesheet URLs are versioned by their content hash during the build, preventing updated HTML from reusing a previous release’s cached editor/navigation assets.
