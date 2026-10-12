'use strict';
const { createRequire } = require('node:module');
const { chromium } = createRequire('/tmp/tez-qa/package.json')('playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:4173';
(async () => {
 const browser = await chromium.launch({executablePath: process.env.TEZ_CHROME || '/usr/bin/google-chrome', args:['--no-sandbox']});
 const context = await browser.newContext({acceptDownloads:true});
 const page = await context.newPage(), errors=[]; let checks=0;
 page.on('pageerror', e => errors.push(e.message));
 async function open(path) { const r=await page.goto(base+path); assert.equal(r.status(),200); await page.waitForLoadState('networkidle'); }
 async function download(selector, extension) {const promise=page.waitForEvent('download',{timeout:25000});await page.locator(selector).click();const d=await promise;assert.equal(await d.failure(),null);const bytes=await fs.readFile(await d.path());assert(bytes.length>100);if(extension==='png')assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');if(extension==='html')assert.match(bytes.toString(),/<html\b/i);if(extension==='svg')assert.match(bytes.toString(),/<svg\b/i);console.log('PASS download '+selector+' '+bytes.length+' bytes');checks++;return bytes.toString();}
 await open('/');assert((await page.locator('body').innerText()).includes('Tech Environment Zero to One'));checks++;
 await open('/tech-x/vizuelni-studio.html');assert((await page.locator('#visual-preview').getAttribute('srcdoc')).includes('<!doctype html>'));await page.locator('#visual-title').fill('Originalni browser test');await page.locator('#visual-title').dispatchEvent('input');const website=await download('#visual-download','html');assert(website.includes('Originalni browser test'));assert(!website.includes('undefined'));checks++;
 await page.locator('button').filter({hasText:'SAČUVAJ PROJEKAT'}).click();await page.locator('#visual-title').fill('Privremeni tekst');await page.locator('#visual-title').dispatchEvent('input');await page.locator('button').filter({hasText:'OTVORI PROJEKAT'}).click();assert.equal(await page.locator('#visual-title').inputValue(),'Originalni browser test');checks++;
 await open('/tech-x/dokumenti.html');await download('#doc-html','html');const pdf=await page.pdf({format:'A4',printBackground:true});assert.equal(pdf.subarray(0,4).toString(),'%PDF');checks++;
 await open('/tech-x/plakati.html');await download('#poster-svg','svg');await download('#poster-png','png');
 await open('/tech-x/prezentacije.html');await page.locator('#slide-notes').fill('PRIVATE_BROWSER_NOTE');await page.locator('#slide-notes').dispatchEvent('input');const slides=await download('#slides-download','html');assert(!slides.includes('PRIVATE_BROWSER_NOTE'));checks++;
 await open('/tech-x/dijagrami.html');await download('#diagram-download','svg');await download('#diagram-png','png');
 await open('/tech-x/studio.html');const preview=page.frameLocator('#live-preview');await preview.locator('#action').click();assert((await preview.locator('#result').innerText()).includes('Radi!'));checks++;await download('#download-page','html');
 await open('/tech-x/alati.html');await page.locator('#csv-source').fill('name,note\nA,"first,second"');await page.locator('#csv-convert').click();assert.equal(JSON.parse(await page.locator('#json-result').inputValue())[0].note,'first,second');checks++;
 await page.locator('#svg-code').fill('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="20" height="20"/></svg>');await page.locator('#svg-render').click();assert((await page.locator('#svg-status').innerText()).includes('Nedozvoljen'));checks++;
 await open('/tech-x/resources.html');assert((await page.locator('#resource-count').innerText()).includes('150'));await page.locator('#resource-search').fill('CV');assert((await page.locator('#resource-list').innerText()).includes('CV'));checks++;
 await page.setViewportSize({width:390,height:844});await open('/tech-x/vizuelni-studio.html');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));checks++;
 assert.deepEqual(errors,[]);console.log('PASS '+checks+' real Chromium checks; no uncaught page errors. Android hardware remains untested.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
