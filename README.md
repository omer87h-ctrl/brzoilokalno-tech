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
