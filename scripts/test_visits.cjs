'use strict';
const {createRequire} = require('node:module');
const {chromium, request} = createRequire('/tmp/tez-qa/package.json')('playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({executablePath:process.env.TEZ_CHROME || '/usr/bin/google-chrome',args:['--no-sandbox']});
 const source = await fs.readFile('_site/visits.js','utf8');
 const css = await fs.readFile('_site/visits.css','utf8');
 const origin = 'https://tech.brzoilokalno.com';
 let checks = 0;
 async function scenario({optout=false,dnt=false,gpc=false,quota=false,fail=false}={}) {
  const context = await browser.newContext({viewport:{width:360,height:780}});
  const requested=[];
  await context.addInitScript(({optout,dnt,gpc,quota})=>{
   if (optout) localStorage.setItem('bl-tech-counter-disabled','1');
   if (dnt) Object.defineProperty(navigator,'doNotTrack',{value:'1'});
   if (gpc) Object.defineProperty(navigator,'globalPrivacyControl',{value:true});
   if (quota) Object.defineProperty(Storage.prototype,'setItem',{value:()=>{throw new Error('QuotaExceededError');}});
  },{optout,dnt,gpc,quota});
  await context.route(origin+'/**', async route => {
   const u = new URL(route.request().url());
   if(u.pathname==='/visits.js') return route.fulfill({contentType:'text/javascript',body:source});
   if(u.pathname==='/visits.css') return route.fulfill({contentType:'text/css',body:css});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="bs"><head><link rel="stylesheet" href="/visits.css"></head><body><main>Portal</main><footer></footer><script src="/visits.js" defer></script></body></html>'});
  });
  await context.route('https://hits.sh/**', async route => {
   requested.push({url:route.request().url(),headers:await route.request().allHeaders()});
   if (fail) return route.abort('failed');
   return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="180" height="28"><title>Otvaranja: 7</title><rect width="180" height="28" fill="#18232e"/><text x="10" y="20" fill="white">Otvaranja: 7</text></svg>'});
  });
  const page = await context.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/environment-zero-to-one/dokumenti.html?private=SECRET');
  await page.waitForLoadState('networkidle');
  assert.equal(errors.length,0); assert.equal(await page.locator('#tech-visits').count(),1);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  if(optout||dnt||gpc) {assert.equal(requested.length,0);assert((await page.locator('#tech-visits').innerText()).includes('isključeno') || (await page.locator('#tech-visits').innerText()).includes('Isključeno'));}
  else {
   assert.equal(requested.length,1);
   assert(!requested[0].url.includes('SECRET')); assert(!requested[0].headers.referer);
   assert(!requested[0].headers.cookie);
   if(fail) assert((await page.locator('#tech-visits').innerText()).includes('trenutno nije dostupan'));
   else assert(await page.locator('#tech-visits img').evaluate(img=>img.complete&&img.naturalWidth>0));
   await page.locator('#tech-visits button').click();
   assert.equal(await page.locator('#tech-visits img').count(),0);
   if(quota) assert((await page.locator('#tech-visits').innerText()).includes('samo za ovu stranicu'));
   else {
    await page.reload();await page.waitForLoadState('networkidle');assert.equal(requested.length,1);
    await page.locator('#tech-visits button').click();await page.waitForLoadState('networkidle');assert.equal(requested.length,2);
   }
  }
  await context.close(); checks++;
 }
 for(const options of [{},{optout:true},{dnt:true},{gpc:true},{quota:true},{fail:true}]) await scenario(options);
 const local = await browser.newPage();let localRequests=0;
 await local.route('https://hits.sh/**',route=>{localRequests++;return route.abort();});
 await local.goto('http://127.0.0.1:4173/');await local.waitForLoadState('networkidle');
 assert.equal(localRequests,0); assert.equal(await local.locator('#tech-visits').count(),1);checks++;
 await browser.close();
 // Live provider evidence uses a dedicated QA namespace, never the public count.
 const client=await request.newContext({timeout:25000});
 const key='tech.brzoilokalno.com/qa-counter-2026-10-12';
 const before=await client.get('https://hits.sh/api/urns/'+key);
 assert([200,404].includes(before.status()));
 const initial=before.status()===200 ? (await before.json()).total : 0;
 for(let i=0;i<2;i++){
  const response=await client.get('https://hits.sh/'+key+'.svg?label=QA');
  assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/image\/svg\+xml/);
  assert.match(await response.text(),/<svg\b/);
  assert(!response.headers()['set-cookie']);
 }
 const after=await client.get('https://hits.sh/api/urns/'+key);
 assert.equal(after.status(),200);assert((await after.json()).total>=initial+2);
 await client.dispose();checks++;
 console.log(`PASS visitor counter: ${checks} browser/provider scenarios; live QA namespace increased by at least 2. Public counter unchanged by tests.`);
})().catch(e=>{console.error(e);process.exit(1);});
