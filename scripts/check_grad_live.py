"""Verify anonymous HTTPS game publication against the exact approved build."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen
import hashlib,json,time,os

base=Path('_site/igra')
files=['index.html','core.js','city.js','game.js','game.css','skyline.svg','sw.js','icon.svg','share.png','dispatch.js','dispatch-ui.js','sprite-art.js','community.css','art/game-icon.webp','art/buildings.webp','art/buildings-2.webp','art/buildings-3.webp','community.js','community-ui.js','career.css','progress-ui.js','world.css','fieldwork.js','fieldwork-ui.js','fieldwork.css']
def check(name):
    expected=(base/name).read_bytes()
    for attempt in range(6):
        try:
            request=Request('https://tech.brzoilokalno.com/igra/'+name+'?check='+os.environ.get('GITHUB_SHA','grad-v5'),headers={'DNT':'1','User-Agent':'GradMajstoraReleaseCheck'})
            with urlopen(request,timeout=20) as r:
                actual=r.read();status=r.status
            if status==200 and hashlib.sha256(actual).digest()==hashlib.sha256(expected).digest():
                return {'path':'/igra/'+name,'status':status,'sha256':hashlib.sha256(actual).hexdigest(),'matches_build':True}
        except Exception as error:
            last=str(error)
        time.sleep(3)
    raise AssertionError('Published game differs from build: '+name)
with ThreadPoolExecutor(max_workers=5) as pool: results=list(pool.map(check,files))
with urlopen('https://tech.brzoilokalno.com/',timeout=25) as r: home=r.read().decode('utf-8')
assert 'href="/igra/"' in home and 'Grad majstora' in home
Path('grad-evidence').mkdir(exist_ok=True)
Path('grad-evidence/live-results.json').write_text(json.dumps({'checkedAt':time.time(),'public_game':'https://tech.brzoilokalno.com/igra/','files':results,'homepage_link':True},ensure_ascii=False,indent=2))
print('GRAD_LIVE_CHECKS:',len(results),'HTTPS exact file matches; TECH homepage link verified')
