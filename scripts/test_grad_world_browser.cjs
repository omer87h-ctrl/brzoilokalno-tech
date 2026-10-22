'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), {createRequire} = require('node:module');
const qa = createRequire('/tmp/tez-qa/package.json'), {chromium} = qa('playwright'), axe = qa('axe-core'), G = require('../igra/core.js');
const origin = process.env.GRAD_ORIGIN || 'http://127.0.0.1:4173', results = [];

(async () => {
  await fs.mkdir('grad-evidence', {recursive:true});
  const browser = await chromium.launch({executablePath:process.env.TEZ_CHROME || '/usr/bin/google-chrome', args:['--no-sandbox']});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1000}}), page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const snapshot = () => page.evaluate(() => GradMajstoraApp.snapshot());
    const visuals = () => page.evaluate(() => GradMajstoraApp.visuals());
    const job = async () => (await snapshot()).dispatch.jobs.find(j => j.id === 2);
    const turn = async () => {await page.locator('#next-day').click();await page.getByRole('button',{name:'Pošalji ekipu →',exact:true}).click();};
    async function test(name, fn) {await fn();results.push({name,passed:true});console.log('PASS',name);}
    await test('The first task directly answers the real caller and follows the actual job state', async () => {
      await page.goto(origin + '/igra/'); await page.locator('#start').click();
      await page.getByRole('button',{name:'Počni karijeru',exact:true}).click();
      await page.getByRole('button',{name:'Preuzmi telefon',exact:true}).click();
      assert(await page.locator('#first-task').isVisible());
      assert.equal(await page.locator('#first-task [aria-current="step"]').innerText(),'1. Poziv');
      await page.locator('#first-task-next').click();
      assert((await job()).diagnosed);
      await page.getByRole('button',{name:'Otvori ovaj zahtjev',exact:true}).click();
      assert.equal(await page.locator('#first-task [aria-current="step"]').innerText(),'2. Dogovor');
      await page.locator('#offer-price').fill('100'); await page.getByRole('button',{name:'Pošalji ponudu',exact:true}).click();
      assert.equal(await page.locator('#first-task [aria-current="step"]').innerText(),'3. Priprema');
      await page.getByRole('button',{name:'Pošalji na adresu',exact:true}).click();
      assert.equal(await page.locator('#first-task [aria-current="step"]').innerText(),'4. Put');
      await turn(); assert.equal((await job()).status,'working');
      assert.equal(await page.locator('#first-task [aria-current="step"]').innerText(),'5. Rad');
      await page.locator('#first-task-next').click(); assert(await page.getByRole('heading',{name:'Stolarska klupa',exact:true}).isVisible());
    });
    await test('Real finished and paid jobs show distinct factual outcomes exactly once', async () => {
      await page.getByRole('button',{name:/Radi na klupi/}).click();
      const base = (await snapshot()).community.craft.base;
      for (const point of [base,base+2,base,base+2,base+3,base+5]) await page.locator('[data-craft="'+point+'"]').click();
      assert.equal((await job()).status,'review');
      assert.equal(await page.locator('#job-outcome').getAttribute('data-kind'),'finished');
      assert((await page.locator('#job-outcome').innerText()).includes('ČEKA PREDAJU'));
      assert.equal((await snapshot()).dispatch.stats.completed,0);
      const shown = (await visuals()).outcomesShown;
      await page.locator('#job-outcome').getByRole('button',{name:'Otvori predaju posla',exact:true}).click();
      const before = await snapshot(); await page.getByRole('button',{name:'Predaj rad i naplati',exact:true}).click();
      assert.equal((await snapshot()).cash-before.cash,100);
      assert.equal(await page.locator('#job-outcome').getAttribute('data-kind'),'paid');
      assert((await page.locator('#job-outcome').innerText()).includes('naplaćeno 100'));
      assert.equal((await visuals()).outcomesShown,shown+1);
      assert(await page.locator('#first-task').isHidden());
      await page.locator('[data-tab="journal"]').click(); await page.locator('[data-tab="hub"]').click();
      assert.equal((await visuals()).outcomesShown,shown+1);
      await page.locator('#job-outcome').getByRole('button',{name:'Pogledaj rezultat na mapi',exact:true}).click();
      assert.equal(await page.locator('[data-tab="map"]').getAttribute('aria-pressed'),'true');
      assert((await visuals()).completionCount>=1);
      await page.waitForFunction(()=>GradMajstoraApp.visuals().atlasTiers.length===3);
      await page.locator('#city').screenshot({path:'grad-evidence/world-client-result.png'});
      console.log('GRAD_DAYLIGHT_MAP '+(await page.locator('#city').screenshot({type:'jpeg',quality:65})).toString('base64'));
      await page.getByRole('button',{name:'Zatvori rezultat',exact:true}).click();
    });
    await test('Buying a career workshop changes the actual map while leaving settlement buildings untouched', async () => {
      await page.locator('#phone-open').click(); await page.locator('[data-career="company"]').click();
      const before = await snapshot(); await page.getByRole('button',{name:'Opremi nivo 1 · 250 nov. + 8 mat.',exact:true}).click();
      assert.equal((await snapshot()).cash,before.cash-250); assert.equal((await snapshot()).buildings.length,0);
      assert.equal((await visuals()).companyWorkshop,1);
      await page.locator('[data-tab="map"]').click(); await page.locator('#recenter').click();
      await page.locator('#city').screenshot({path:'grad-evidence/world-own-workshop.png'});
      await turn(); await turn();
    });
    await test('Recorded days show original map values without changing live resources, jobs or revision', async () => {
      const before = await snapshot(); assert(before.community.history.days.length>=3);
      await page.locator('[data-tab="history"]').click(); await page.locator('#history-day').focus(); await page.keyboard.press('Home');
      const first = before.community.history.days[0];
      assert((await page.locator('#history-label').innerText()).startsWith('Dan '+first.day));
      assert.equal((await visuals()).historyWorld.companyWorkshop,first.company.workshop);
      await page.locator('#history-city').click();
      assert.deepEqual(await snapshot(),before);
      await page.locator('#history-day').focus(); await page.keyboard.press('End');
      assert.equal((await visuals()).historyWorld.companyWorkshop,1);
      assert((await page.locator('#history-statistics').innerText()).includes('1/3'));
      await page.screenshot({path:'grad-evidence/world-recorded-days.png',fullPage:true});
      assert.deepEqual(await snapshot(),before);
      await page.locator('#history-live').click(); assert.equal(await page.locator('[data-tab="map"]').getAttribute('aria-pressed'),'true');
      assert.deepEqual(await snapshot(),before);
    });
    await test('History and factual result UI fit phones, preserve keyboard access and honor reduced motion', async () => {
      await page.locator('[data-tab="history"]').click();
      for (const width of [390,360,320]) {
        await page.setViewportSize({width,height:900});
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'History overflow '+width);
        await page.locator('#history-day').focus(); await page.keyboard.press('Home');
        await page.locator('#history-after').click();
        assert.equal((await visuals()).historyDay,(await snapshot()).community.history.days[1].day);
      }
      await page.emulateMedia({reducedMotion:'reduce'}); await page.evaluate(axe.source);
      const report = await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
      await fs.writeFile('grad-evidence/world-accessibility.json',JSON.stringify(report.violations,null,2));
      assert.deepEqual(report.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id),[]);
    });
    await test('New history and actual company assets survive offline restart without replaying old celebrations', async () => {
      const before=await snapshot(); await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
      await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await page.locator('#continue').click();
      assert.deepEqual(await snapshot(),before);assert.equal((await visuals()).outcomesShown,0);assert.equal((await visuals()).completionCount,0);
      await page.locator('[data-tab="history"]').click();assert.equal((await visuals()).historyAvailable,before.community.history.days.length);
      await context.setOffline(false);
    });
    await test('Published format-4 careers and previous-story recovery migrate without inventing older history', async () => {
      const c=await browser.newContext(),p=await c.newPage();await p.goto(origin+'/igra/');
      const raw=await fs.readFile(path.join(__dirname,'../tests/fixtures/grad-v4-career-save.json'),'utf8'),old=JSON.parse(raw).state;
      await p.evaluate(raw=>{localStorage.setItem('bl.grad-majstora.v4.a',raw);localStorage.setItem('bl.grad-majstora.v4.previous',raw);},raw);
      await p.reload();await p.locator('#continue').click();const next=await p.evaluate(()=>GradMajstoraApp.snapshot());
      for(const key of Object.keys(old))if(!['version','revision','community'].includes(key))assert.deepEqual(next[key],old[key],key);
      for(const key of Object.keys(old.community))if(key!=='schema')assert.deepEqual(next.community[key],old.community[key],key);
      assert.equal(next.version,G.VERSION);assert.equal(next.revision,old.revision+1);
      assert.equal(next.community.history.origin,'imported');assert.equal(next.community.history.days.length,1);assert.equal(next.community.history.startedDay,old.day);
      assert(await p.evaluate(()=>!!localStorage.getItem('bl.grad-majstora.v5.previous')));
      await p.locator('[data-tab="history"]').click();assert((await p.locator('#history-origin').innerText()).includes('zapis počinje'));
      await c.close();
    });
    await test('Parallel jobs cannot leave a false awaiting-payment card after a later job is paid first', async () => {
      const c=await browser.newContext(),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/igra/');await p.locator('#start').click();await p.getByRole('button',{name:'Gradska kampanja',exact:true}).click();await p.getByRole('button',{name:'Krenimo graditi',exact:true}).click();
      for(const [id,price,worker] of [[2,100,'adnan'],[3,130,'lejla']]){const available=(await p.evaluate(()=>GradMajstoraApp.snapshot())).dispatch.jobs.find(j=>j.id===id).contactDay;while((await p.evaluate(()=>GradMajstoraApp.snapshot())).day<available){await p.locator('#next-day').click();await p.getByRole('button',{name:'Pošalji ekipu →',exact:true}).click();}await p.locator('[data-tab="jobs"]').click();await p.locator('[data-job="'+id+'"]').click();await p.getByRole('button',{name:'Pitaj za detalje',exact:true}).click();await p.locator('#offer-price').fill(String(price));await p.getByRole('button',{name:'Pošalji ponudu',exact:true}).click();await p.locator('#job-worker').selectOption(worker);await p.getByRole('button',{name:'Pošalji na adresu',exact:true}).click();}
      for(let i=0;i<2;i++){await p.locator('#next-day').click();await p.getByRole('button',{name:'Pošalji ekipu →',exact:true}).click();}
      assert.equal(await p.locator('#job-outcome').getAttribute('data-job'),'2');await p.locator('[data-tab="jobs"]').click();await p.locator('[data-job="3"]').click();await p.getByRole('button',{name:'Predaj rad i naplati',exact:true}).click();await p.getByRole('button',{name:'Sakrij obavijest',exact:true}).click();
      assert.equal(await p.locator('#job-outcome').getAttribute('data-job'),'3');assert.equal(await p.locator('#job-outcome').getAttribute('data-kind'),'paid');assert(!(await p.locator('#job-outcome').innerText()).includes('ČEKA PREDAJU'));await c.close();
    });
    assert.deepEqual(errors,[]);console.log('GRAD_WORLD_BROWSER_CHECKS',results.length);
  } finally {
    await fs.writeFile('grad-evidence/world-results.json',JSON.stringify({at:new Date().toISOString(),checks:results,physicalAndroidDevice:false},null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
