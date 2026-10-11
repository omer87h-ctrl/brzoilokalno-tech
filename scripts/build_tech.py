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

# Assets outside /tech/ used by the existing portal.
icon = Path("upstream/assets/app-icon.png")
if icon.is_file():
    (output / "assets").mkdir(exist_ok=True)
    shutil.copy2(icon, output / "assets/app-icon.png")
else:
    raise SystemExit("Missing upstream/assets/app-icon.png")

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
    updated = updated.replace("/tech/", "/")
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
for unused in ("README.md", "update-news.py"):
    target = output / unused
    if target.is_file():
        target.unlink()

# Signal a separate TECH website name to Google on the subdomain root.
# Reuse the existing CollectionPage markup and connect it to a new WebSite node.
# The primary brzoilokalno.com site's organization and application are untouched.
home = output / "index.html"
html = home.read_text(encoding="utf-8")
match = re.search(r'<script type="application/ld\\+json">([\\s\\S]*?)</script>', html)
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
assert (output / "index.html").is_file()
assert (output / "sitemap.xml").is_file()
assert f"https://{domain}/" in (output / "index.html").read_text(encoding="utf-8")
print(f"Built separate TECH website for https://{domain}/")
