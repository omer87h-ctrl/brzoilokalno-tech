#!/usr/bin/env python3
"""Build a separate GitHub Pages site from the established TECH portal.

No changes are made to the source website, Android app, or its PWA.
The generated output is served from tech.brzoilokalno.com.
"""
from pathlib import Path
import base64
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

# Copy the OWNER'S ORIGINAL visual icon into the separate TECH output.
# The encoded asset is stored in this DEPLOYMENT repository, not retrieved
# from the primary site at runtime; this keeps the two sites independent.
brand_icon_source = Path("assets/original-brzoilokalno-icon.png.base64")
brand_icon = base64.b64decode(brand_icon_source.read_text(encoding="ascii").strip(), validate=True)
if not brand_icon.startswith(b"\x89PNG\r\n\x1a\n"):
    raise SystemExit("The standalone TECH brand icon is not a PNG")
(output / "assets").mkdir(parents=True, exist_ok=True)
(output / "assets/app-icon.png").write_bytes(brand_icon)

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
    # All TECH documents declare the TECH-HOSTED original Brzo i Lokalno icon.
    # This is a local file on tech.brzoilokalno.com, NOT an image loaded from the main site.
    if path.suffix.lower() == ".html" and re.search(r"<head\b", updated, re.I):
        icon_link = '<link rel="icon" type="image/png" sizes="512x512" href="/assets/app-icon.png">'
        icon_pattern = r'<link\b(?=[^>]*\brel=["\'](?:shortcut\s+)?icon["\'])[^>]*>'
        updated, icon_count = re.subn(icon_pattern, icon_link, updated, flags=re.I)
        if not icon_count:
            updated = re.sub(r"<head\b[^>]*>", lambda m: m.group(0) + icon_link, updated, count=1, flags=re.I)
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
    "publisher": {"@id": f"https://{domain}/#organization"}
}
organization = {
    "@type": "Organization",
    "@id": f"https://{domain}/#organization",
    "name": "Brzo i Lokalno TECH",
    "url": f"https://{domain}/",
    "logo": {"@type": "ImageObject", "url": f"https://{domain}/assets/app-icon.png"},
}
graph = {"@context": "https://schema.org", "@graph": [website, organization, page]}
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
    "application-data.js",
    "tech-x/moji-radovi.html", "tech-x/moji-radovi.js", "tech-x/projekti.html", "tech-x/projekti.js",
    "tech-x/workspace.css", "tech-x/guided-builder.js", "tech-x/guided-builder.css",
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

# The TECH homepage, favicon, and sitemap must stay entirely on the TECH host.
assert (output / "assets/app-icon.png").read_bytes() == brand_icon, "TECH favicon differs from owner's original"
built_home = (output / "index.html").read_text(encoding="utf-8")
assert 'href="/assets/app-icon.png"' in built_home, "TECH homepage is missing its local original favicon"
built_sitemap = (output / "sitemap.xml").read_text(encoding="utf-8")
assert "https://brzoilokalno.com/tech/" not in built_sitemap, "Old main-domain TECH URLs still present in TECH sitemap"
assert 'https://tech.brzoilokalno.com/' in built_sitemap, "TECH sitemap missing independent host"

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

# Shared aggregate counter on public TECH pages only, never compatibility redirects.
for counter_asset in ("visits.js", "visits.css"):
    assert (output / counter_asset).is_file(), f"Missing counter asset: {counter_asset}"
for page_path in output.rglob("*.html"):
    if "tech-x" in page_path.relative_to(output).parts:
        continue
    markup = page_path.read_text(encoding="utf-8")
    assert "</head>" in markup and "</body>" in markup, page_path
    markup = markup.replace("</head>", '<link rel="stylesheet" href="/visits.css"></head>', 1)
    markup = markup.replace("</body>", '<script src="/visits.js" defer></script></body>', 1)
    page_path.write_text(markup, encoding="utf-8")

# Content-version local scripts/styles so updated HTML cannot reuse older cached code.
import hashlib
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
asset_ref = re.compile(r"(<(?:script|link)\b[^>]*?\b(?:src|href)=[\"'])([^\"']+)([\"'])", re.I)
for page_path in output.rglob("*.html"):
    def version_asset(match):
        reference = urlsplit(match.group(2))
        if reference.scheme or reference.netloc or not reference.path.endswith((".js", ".css")):
            return match.group(0)
        asset = (output / reference.path.lstrip("/")) if reference.path.startswith("/") else (page_path.parent / reference.path)
        if not asset.is_file() or not asset.resolve().is_relative_to(output.resolve()):
            return match.group(0)
        params = [(key, value) for key, value in parse_qsl(reference.query, keep_blank_values=True) if key != "v"]
        params.append(("v", hashlib.sha256(asset.read_bytes()).hexdigest()[:12]))
        address = urlunsplit((reference.scheme, reference.netloc, reference.path, urlencode(params), reference.fragment))
        return match.group(1) + address + match.group(3)
    page_path.write_text(asset_ref.sub(version_asset, page_path.read_text(encoding="utf-8")), encoding="utf-8")

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
    assert not re.search(r"\bTECH[\s/·:_–—-]*X\b", " ".join(parser.parts), re.I), page_path

print(f"Built separate TECH website for https://{domain}/")


# Owner-requested standalone demo: copy after portal rewriting/counter injection.
# Existing portal pages and sitemap are unchanged; demo carries noindex metadata.
demo_source = Path("clea7-demo")
if (demo_source / "index.html").is_file():
    shutil.copytree(demo_source, output / "clea7-demo", dirs_exist_ok=True)
    assert "BL CLEA7" in (output / "clea7-demo/index.html").read_text(encoding="utf-8")
    assert "visits.js" not in (output / "clea7-demo/index.html").read_text(encoding="utf-8")

# Owner-approved standalone game. Copy after portal rewriting/counter injection:
# game storage/network boundaries do not inherit the portal visitor counter.
game_source = Path("igra")
if (game_source / "index.html").is_file():
    shutil.copytree(game_source, output / "igra", dirs_exist_ok=True)
    (output / "igra/brand-icon.png").write_bytes(brand_icon)
    for art_name in ("buildings", "buildings-2", "buildings-3", "game-icon"):
        encoded = Path("assets") / ("grad-" + art_name + ".webp.base64")
        art = base64.b64decode(encoded.read_text().strip(), validate=True)
        assert art[:4] == b"RIFF" and art[8:12] == b"WEBP", "Invalid original game art"
        (output / "igra/art").mkdir(exist_ok=True)
        (output / "igra/art" / (art_name + ".webp")).write_bytes(art)
    (output / "igra/README.md").unlink(missing_ok=True)
    (output / "igra/ACCEPTANCE.md").unlink(missing_ok=True)
    home_path = output / "index.html"
    markup = home_path.read_text(encoding="utf-8")
    promo = '<section class="grad-game-card" aria-labelledby="grad-game-heading"><div><small>BRZO I LOKALNO · THE GAME</small><h2 id="grad-game-heading">Grad majstora</h2><p>Počni kao samostalni majstor: primi poziv, dogovori posao, koristi alat i razvij vlastitu firmu. Originalna besplatna strategija, bez računa i instalacije.</p></div><a href="/igra/">Zaigraj Grad majstora ↗</a></section>'
    assert "</main>" in markup, "TECH homepage missing main"
    markup = markup.replace("</head>", '<link rel="stylesheet" href="/igra/portal-card.css"></head>', 1)
    markup = markup.replace("</main>", promo + "</main>", 1)
    home_path.write_text(markup, encoding="utf-8")
    sitemap = output / "sitemap.xml"
    xml = sitemap.read_text(encoding="utf-8")
    xml = xml.replace("</urlset>", '<url><loc>https://tech.brzoilokalno.com/igra/</loc></url></urlset>')
    sitemap.write_text(xml, encoding="utf-8")
    assert "visits.js" not in (output / "igra/index.html").read_text(encoding="utf-8")
    print("Built standalone Grad majstora and its TECH homepage link")
