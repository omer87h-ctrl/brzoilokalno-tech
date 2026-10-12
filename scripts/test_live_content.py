"""Read-only public verification; no private content and no counter requests."""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from concurrent.futures import ThreadPoolExecutor
import hashlib, json, os, time
site=Path('_site');release=os.environ.get('TECH_RELEASE','verification')
files=['data.js','experience.js','citaj.js','biblioteka.html','podcast.html','oglasi.html','submission.js','radar-bih.js','radar-bih.html','radar-bih.css','radar-bih-data.js','editorial-content.css']
files += [str(p.relative_to(site)) for p in (site/'resursi').glob('*') if p.name.startswith(('vodic-stranica-bez-koda','vodic-sigurne-kopije','vodic-cv-privatnost','vodic-poslovna-ponuda','vodic-test-telefon-tastatura','vodic-radar-provjera','vodic-podcast-priprema','vodic-saradnja-autorstvo','podcast-','evidencija-projektnih-kopija','provjera-radar-prilike','plan-podcast-razgovora','dogovor-saradnja-lista','poziv-'))]
def request(url):
    try:
        with urlopen(Request(url,headers={'DNT':'1','User-Agent':'BrzoLokalnoTECH-ReleaseVerification'}),timeout=25) as r:return r.status,r.read()
    except HTTPError as e:return e.code,e.read()
def verify_file(file):
    expected=(site/file).read_bytes()
    for attempt in range(5):
        code,body=request('https://tech.brzoilokalno.com/'+file+'?release='+release)
        if code==200 and hashlib.sha256(body).digest()==hashlib.sha256(expected).digest():return {'path':file,'status':code,'matches_built_file':True}
        time.sleep(3)
    raise AssertionError('Live file does not match approved build: '+file+' HTTP '+str(code))
with ThreadPoolExecutor(max_workers=6) as pool:verified=list(pool.map(verify_file,files))
old=['/tech/'+str(p.relative_to(site)) for p in site.rglob('*.html') if not str(p.relative_to(site)).startswith(('environment-zero-to-one/','tech-x/moji-radovi','tech-x/projekti','tech-x/resources'))]
# Old public suite pages used tech-x, not the new public environment route.
# Match the original 39-page legacy set without newly introduced pages.
old=[p for p in old if not p.endswith(('moji-radovi.html','projekti.html','resources.html'))]+['/tech/','/tech/sitemap.xml']
def verify_removed(path):
    code,_=request('https://brzoilokalno.com'+path+'?release='+release)
    return {'path':path,'status':code,'removed':code in (404,410)}
with ThreadPoolExecutor(max_workers=6) as pool:removed=list(pool.map(verify_removed,old))
code,main=request('https://brzoilokalno.com/?release='+release);assert code==200 and main
report={'tech_files':verified,'old_main_domain_pages':removed,'main_home_status':code,'google_indexing':'Not inspected; recrawling is separate from publication.'}
Path('portal-audit-output').mkdir(exist_ok=True);Path('portal-audit-output/live-content-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
failed=[x for x in removed if not x['removed']]
print('LIVE_CONTENT_CHECKS',len(verified),'exact public file matches;',sum(x['removed'] for x in removed),'of',len(removed),'old URLs return 404/410; primary home HTTP 200')
assert not failed, 'Old TECH URLs still respond as available: '+json.dumps(failed)
