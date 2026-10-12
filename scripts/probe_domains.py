from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json,re,hashlib
class NoRedirect(HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):return None
def get(path,host='brzoilokalno.com'):
 try:
  with build_opener(NoRedirect).open(Request('https://'+host+path+'?tech_verification=14419bb9-final',headers={'DNT':'1'}),timeout=25) as r:code,body,headers=r.status,r.read(),r.headers
 except HTTPError as e:code,body,headers=e.code,e.read(),e.headers
 text=body.decode('utf-8','replace');title=re.search(r'<title[^>]*>(.*?)</title>',text,re.S);canonical=re.search(r'<link[^>]*rel=[\"\']canonical[\"\'][^>]*href=[\"\']([^\"\']+)',text,re.I)
 return {'host':host,'path':path,'status':code,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),'title':title.group(1) if title else '', 'canonical':canonical.group(1) if canonical else '', 'location':headers.get('Location'), 'server':headers.get('Server'),'cache_control':headers.get('Cache-Control'),'age':headers.get('Age'),'tech_migration_script':'data-tech-migration' in text}
# Build the same original 39-address set preserved by the independent TECH output.
site=Path('_site');paths=['/tech/'+str(p.relative_to(site)) for p in site.rglob('*.html') if not str(p.relative_to(site)).startswith('environment-zero-to-one/') and not p.name in ('moji-radovi.html','projekti.html','resources.html')]
# Request.data must be None to use GET.
with ThreadPoolExecutor(max_workers=6) as pool:old=list(pool.map(get,paths))
main=get('/');tech=get('/','tech.brzoilokalno.com')
for record in old:record['matches_main_home']=record['sha256']==main['sha256']
report={'main':main,'tech':tech,'old':old};Path('portal-audit-output').mkdir(exist_ok=True);Path('portal-audit-output/domain-probe.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('DOMAIN_PROBE',json.dumps({'main':main,'tech':tech,'old_count':len(old),'old_samples':old[:5]+[x for x in old if x['path']=='/tech/index.html'],'statuses':{str(status):sum(x['status']==status for x in old) for status in set(x['status'] for x in old)},'matches_main':sum(x['matches_main_home'] for x in old)},ensure_ascii=False))
