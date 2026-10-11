# Brzo i Lokalno TECH

Independent GitHub Pages deployment for **https://tech.brzoilokalno.com/**.

The TECH portal source remains in [brzoilokalno-website/tech](https://github.com/omer87h-ctrl/brzoilokalno-website/tree/main/tech); the [deploy workflow](.github/workflows/deploy-tech.yml) builds its own copy from the source and publishes it to the dedicated TECH subdomain. The main `brzoilokalno.com` site, app and Firebase are unchanged.

## October 2026 migration

- Pages formerly available under `https://brzoilokalno.com/tech/` now point to corresponding pages under `https://tech.brzoilokalno.com/`.
- Old-host-only JavaScript redirects and cross-domain canonical tags are included in the source HTML. They are **not** server-side HTTP 301 responses.
- The main-domain sitemap contains only main-platform URLs. A legacy TECH sitemap remains temporarily available for Google to re-crawl old addresses; the independently generated TECH sitemap lists new URLs.
- Do not remove old pages or their legacy sitemap until the migration has been verified in Search Console.
- Auto-refresh runs every six hours and may be run manually from GitHub Actions.

## Editorial identity

The TECH portal homepage headline is **TEHNOLOGIJA. ZNANJE. PRILIKE.** and its navigation now labels the existing writing/editor area **Kreiraj**; the old editing URL and all draft features remain intact. It is still hosted at https://tech.brzoilokalno.com/. This update does not change the app, the main site's domain, or Search Console properties.

## Application links

The TECH Free Store product card links PWA to https://brzoilokalno.com/app/ and Huawei AppGallery to the existing official download landing page. Google Play is linked to https://play.google.com/store/apps/details?id=com.brzoilokalno and the outdated coming-soon labels have been removed.

## October 11: clearer content sections

**TECH Svijet** = subject explanations and discovery. **TECH Zona** = original editorial articles and saved reading (same on-device bookmark key). **TECH Akademija** = 15 interactive lessons, quizzes, notes and progress under the existing /discovery.html path. No changes to the main Android/PWA app or separate domain SEO settings.

## October 11: distinct TECH experiences

TECH Svijet now presents an interactive eight-category atlas with four explained topics per category. TECH Zona has a separate editorial magazine layout with featured original articles and an index of published texts. Upstream source: `brzoilokalno-website/tech`. Android app, PWA, Firebase and main-site pages are not changed by this source-only TECH update.

## Navigation fix

Homepage TECH Zona and TECH Svijet links now explicitly route to different pages with a query version to avoid stale navigation; main menu and interactive homepage links use the same destinations. This README update triggers the subdomain deployment workflow.

## Hero button correction

The top orange homepage button now reads ČITAJ TECH ZONU and links to the editorial TECH Zona. The lower TECH Svijet entry remains unchanged. Deploy the latest upstream tech source.

## October 11: portal-wide navigation consistency

Homepage news CTAs and news ticker now lead to the single TECH Arhiva; the repeated news/archive CTA under TECH Svijet was removed. TECH Zona is labeled editorial articles, TECH Svijet retains its topic atlas and forwards archival browsing to TECH Arhiva. Sources editorial and submission CTA text were clarified, and obsolete duplicate TECH Svijet feed scripting was removed. This commit triggers independent TECH Pages deployment from the updated source.

## TECH X editorial and first-screen quality pass

Replaced the awkward 'Ne samo čitaj' slogan with a grammatically natural headline, clarified the four real experiments, removed the generic orbit art in favor of a schematic preview and versioned the standalone assets. The deployment workflow is triggered by this commit.

## TECH X: real in-browser software

TECH X now includes a working Web Studio (`/tech-x/studio.html`) that edits HTML/CSS/JavaScript, previews code in a restricted frame, saves local projects, imports/exports JSON, and downloads portable HTML. Real browser tools (`/tech-x/alati.html`) resize and convert images, parse CSV to JSON, validate JSON, and edit/export restricted SVG. The build workflow checks for all six new app assets. New page links have been included in the TECH sitemap; no Android/PWA files were changed.

## Image-free no-code release

TECH X gains an image-free visual website builder at `/tech-x/vizuelni-studio.html`, with original CSS background patterns, themes, text sections, reorderable cards and downloadable HTML. The graphics utility generates original vector SVG art rather than accepting photo uploads. No photos are uploaded or copied. Build checks require the visual builder assets.
