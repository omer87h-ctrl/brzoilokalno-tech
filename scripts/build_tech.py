#!/usr/bin/env python3
"""Build a separate GitHub Pages site from the established TECH portal.

No changes are made to the source website, Android app, or its PWA.
The generated output is served from tech.brzoilokalno.com.
"""
from pathlib import Path
import json
import re
import shutil

source = Path("upstream/tech")
output = Path("_site")
domain = "tech.brzoilokalno.com"
if not (source / "index.html").is_file():
    raise SystemExit("TECH source checkout is missing upstream/tech/index.html")

if output.exists():
    shutil.rmtree(output)
shutil.copytree(source, output)

# Public identity uses the owner's new name. Keep old static assets available
# for cached pages; old HTML addresses become compatibility redirects below.
public_app = "environment-zero-to-one"
shutil.copytree(output / "tech-x", output / public_app)

# TECH has its own original small SVG icon; never read main-platform assets.
if not (output / "assets/tech-icon.svg").is_file():
    raise SystemExit("Missing TECH-owned icon")

# Rewrite canonical/social/RSS/sitemap links and root-relative TECH routes
# in the COPIED output only; keep the live source repository unchanged.
text_exts = {".html", ".css", ".js", ".json", ".xml", ".svg", ".txt"}
for path in output.rglob("*"):
    if not path.is_file() or path.suffix.lower() not in text_exts:
        continue
    original = path.read_text(encoding="utf-8")
    updated = original.replace(
        "https://brzoilokalno.com/tech/", f"https://{domain}/"
    )
    updated = updated.replace(
        "https://brzoilokalno.com/tech", f"https://{domain}"
    )
    # All /tech/ routes on the source become / routes at the new host.
    updated = re.sub(r'(?<=[\"\'])/tech/', "/", updated)
    updated = updated.replace("tech-x/", public_app + "/")
    # Explicit navigation back to the original main platform must not loop.
    updated = updated.replace(
        '["Glavna platforma ↗","/"]',
        '["Glavna platforma ↗","https://brzoilokalno.com/"]',
    )
    updated = re.sub(
        r'(href=["\'])/(["\'])',
        r'\1https://brzoilokalno.com/\2',
        updated,
    )
    if updated != original:
        path.write_text(updated, encoding="utf-8")

# Name and verification paths for the independently deployed site.
(output / "CNAME").write_text(domain + "\n", encoding="utf-8")
(output / ".nojekyll").touch()
(output / "robots.txt").write_text(
    "User-agent: *\nAllow: /\nSitemap: https://" + domain + "/sitemap.xml\n",
    encoding="utf-8",
)

# Do not expose developer-only code and build docs on Pages.
for unused in ("README.md", "update-news.py", "ORIGINALITY.md", "DEVELOPMENT-REPORT.md"):
    target = output / unused
    if target.is_file():
        target.unlink()

for folder in ("tests", "__pycache__"):
    shutil.rmtree(output / folder, ignore_errors=True)

# Signal a separate TECH website name to Google on the subdomain root.
# Reuse the existing CollectionPage markup and connect it to a new WebSite node.
# The primary brzoilokalno.com site's organization and application are untouched.
home = output / "index.html"
html = home.read_text(encoding="utf-8")
match = re.search(r'<script type="application/ld\+json">([\s\S]*?)</script>', html)
if not match:
    raise SystemExit("TECH home page is missing its JSON-LD block")
page = json.loads(match.group(1))
if page.get("@type") != "CollectionPage":
    raise SystemExit("Unexpected TECH structured data; aborting SEO update")
page.pop("@context", None)
page["isPartOf"] = {"@id": f"https://{domain}/#website"}
website = {
    "@type": "WebSite",
    "@id": f"https://{domain}/#website",
    "name": "Brzo i Lokalno TECH",
    "alternateName": ["Brzo i Lokalno Tech", "tech.brzoilokalno.com"],
    "url": f"https://{domain}/",
    "inLanguage": "bs",
    "publisher": {"@id": "https://brzoilokalno.com/#organization"}
}
graph = {"@context": "https://schema.org", "@graph": [website, page]}
new_jsonld = '<script type="application/ld+json">' + json.dumps(graph, ensure_ascii=False, separators=(",", ":")) + '</script>'
html = html[:match.start()] + new_jsonld + html[match.end():]
home.write_text(html, encoding="utf-8")

# Search Console ownership applies to the separate TECH host only.
home = output / "index.html"
html = home.read_text(encoding="utf-8")
verification_tag = '<meta name="google-site-verification" content="ILDuA90WSVz2FTZdmWleQ0lzbGCLmFndZ6wlT5V74Ow" />'
if "<head>" not in html:
    raise SystemExit("TECH home page has no <head> for verification")
if verification_tag not in html:
    html = html.replace("<head>", "<head>" + verification_tag, 1)
    home.write_text(html, encoding="utf-8")
# Regression checks: new interactive experiences and expanded catalogs must be deployed.
required = [
    "tech-x/core.js", "tech-x/environment.css", "tech-x/resources.html", "tech-x/resources.js", "tech-x/resources-data.js",
    "tech-x/index.html", "tech-x/x.js", "tech-x/x.css",
    "tech-x/studio.html", "tech-x/studio.js", "tech-x/studio.css",
    "tech-x/vizuelni-studio.html", "tech-x/vizuelni-studio.js", "tech-x/vizuelni-studio.css",
    "tech-x/studio-suite.css",
    "tech-x/dokumenti.html", "tech-x/dokumenti.js",
    "tech-x/plakati.html", "tech-x/plakati.js",
    "tech-x/prezentacije.html", "tech-x/prezentacije.js",
    "tech-x/dijagrami.html", "tech-x/dijagrami.js",
    "tech-x/alati.html", "tech-x/alati.js", "tech-x/alati.css",
    "tech-x-home.css", "library-external.js", "library-external-data.js",
    "library-external.css", "store-software.js", "store-catalog.js",
    "resursi/vodic-web-od-zahtjeva-do-stranice.txt",
    "resursi/radni-list-tech-dozvole.txt",
    "resursi/predlozak-izvor-i-obecanje.txt",
]
required = [p.replace("tech-x/", public_app + "/") for p in required]
for relative in required:
    if not (output / relative).is_file():
        raise SystemExit(f"TECH deployment missing required resource: {relative}")
home_markup = (output / "index.html").read_text(encoding="utf-8")
assert 'href="./environment-zero-to-one/"' in home_markup, "Environment link missing from portal home"
assert 'ČITAJ TECH ZONU' in home_markup, "Editorial button missing from home"
assert 'ARHIVA VIJESTI' in home_markup, "Archive route missing from home"
assert '<loc>https://tech.brzoilokalno.com/environment-zero-to-one/</loc>' in (output / "sitemap.xml").read_text(encoding="utf-8"), "Environment missing from sitemap"

assert (output / "index.html").is_file()
assert (output / "sitemap.xml").is_file()
assert f"https://{domain}/" in (output / "index.html").read_text(encoding="utf-8")
# Preserve all old bookmarked application addresses and their query/hash.
for legacy in (output / "tech-x").glob("*.html"):
    suffix = "" if legacy.name == "index.html" else legacy.name
    destination = "/" + public_app + "/" + suffix
    absolute = "https://" + domain + destination
    redirect = "location.replace(" + json.dumps(destination) + "+location.search+location.hash);"
    legacy.write_text(
        '<!doctype html><html lang="bs"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta http-equiv="refresh" content="0;url=' + destination + '">'
        '<link rel="canonical" href="' + absolute + '">'
        '<title>Tech Environment Zero to One</title></head><body>'
        '<p><a href="' + destination + '">Otvori Tech Environment Zero to One</a></p>'
        '<script>' + redirect + '</script></body></html>', encoding="utf-8"
    )

# Catch split HTML branding as well as single text labels before shipping.
from html.parser import HTMLParser
class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1
    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip -= 1
    def handle_data(self, text):
        if not self.skip:
            self.parts.append(text)
for page_path in output.rglob("*.html"):
    parser = VisibleText()
    parser.feed(page_path.read_text(encoding="utf-8"))
    assert not re.search(r"\bTECH\s*X\b", " ".join(parser.parts), re.I), page_path

print(f"Built separate TECH website for https://{domain}/")

