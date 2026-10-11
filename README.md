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

The TECH Free Store product card links PWA to https://brzoilokalno.com/app/ and Huawei AppGallery to the existing official download landing page. Google Play follows the main website's currently labelled coming-soon status until its active listing is verified.
