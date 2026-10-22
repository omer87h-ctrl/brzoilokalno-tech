'use strict';

// Real authored jobs, input controls, persisted routes and work results in Chrome.
// The mobile context emulates an Android profile; it is not Android hardware.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { createRequire } = require('node:module');
const qa = createRequire('/tmp/tez-qa/package.json');
const { chromium, devices } = qa('playwright');
const origin = process.env.GRAD_ORIGIN || 'http://127.0.0.1:4173';
const results = [];

(async () => {
  await fs.mkdir('grad-evidence', { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.TEZ_CHROME || '/usr/bin/google-chrome',
    args: ['--no-sandbox'],
  });
  const contexts = [];
  const errors = [], external = [], httpErrors = [];
  try {
    async function context(options = {}) {
      const c = await browser.newContext(options); contexts.push(c);
      c.on('page', p => p.on('pageerror', e => errors.push(e.message)));
      c.on('request', r => {
        if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== origin) external.push(r.url());
      });
      c.on('response', r => {
        if (r.url().startsWith(origin + '/') && r.status() >= 400) httpErrors.push({ url: r.url(), status: r.status() });
      });
      return c;
    }
    async function test(name, fn) { await fn(); results.push({ name, passed: true }); console.log('PASS', name); }
    const state = p => p.evaluate(() => GradMajstoraApp.snapshot());
    const field = async p => (await state(p)).community.fieldwork;
    async function begin(p, career = true) {
      await p.goto(origin + '/igra/');
      await p.locator('#start').click();
      await p.getByRole('button', { name: career ? 'Počni karijeru' : 'Gradska kampanja', exact: true }).click();
      await p.getByRole('button', { name: career ? 'Preuzmi telefon' : 'Krenimo graditi', exact: true }).click();
    }
    async function turn(p) {
      await p.locator('#next-day').click();
      await p.getByRole('button', { name: 'Pošalji ekipu →', exact: true }).click();
    }
    async function openJob(p, id) {
      await p.locator('[data-tab="jobs"]').click();
      await p.locator('[data-job="' + id + '"]').click();
    }
    async function quote(p, id, price, worker) {
      await openJob(p, id);
      const j = (await state(p)).dispatch.jobs.find(j => j.id === id);
      if (!j.diagnosed) await p.getByRole('button', { name: 'Pitaj za detalje', exact: true }).click();
      await p.locator('#offer-price').fill(String(price));
      await p.getByRole('button', { name: 'Pošalji ponudu', exact: true }).click();
      await p.locator('#job-worker').selectOption(worker);
      await p.getByRole('button', { name: 'Pošalji na adresu', exact: true }).click();
      assert.equal((await state(p)).dispatch.jobs.find(j => j.id === id).status, 'travelling');
    }
    async function control(p, action) {
      await p.locator('[data-drive-action="' + action + '"]').click();
    }
    async function forward(p) {
      const before = (await field(p)).drive;
      // Respect the component's deliberate bounded input rate, not a fake timer.
      await p.waitForTimeout(600);
      await control(p, 'forward');
      await p.waitForFunction(([x, y]) => {
        const d = GradMajstoraApp.snapshot().community.fieldwork.drive;
        return d.x !== x || d.y !== y;
      }, [before.x, before.y]);
    }
    async function reachDestination(p) {
      for (let guard = 0; guard < 100; guard++) {
        const d = (await field(p)).drive;
        if (d.x === d.destination[0] && d.y === d.destination[1]) return;
        const route = await p.evaluate(() => {
          const s = GradMajstoraApp.snapshot(), d = s.community.fieldwork.drive;
          return GradFieldwork.drivePlan(s, s.dispatch.jobs.find(j => j.id === d.job), GradMajstora.context);
        });
        assert(route && route.length > 1, 'Actual current road route must reach the actual client');
        const [x, y] = route[1], dx = x - d.x, dy = y - d.y;
        const heading = dx === 1 ? 1 : dx === -1 ? 3 : dy === 1 ? 2 : 0;
        const diff = (heading - d.heading + 4) % 4;
        if (diff) {
          await control(p, 'brake');
          await control(p, diff === 1 ? 'right' : diff === 3 ? 'left' : 'reverse');
          assert.equal((await field(p)).drive.heading, heading);
        }
        await forward(p);
      }
      throw Error('The actual road drive did not reach its destination within 100 legal controls');
    }

    const c = await context({ viewport: { width: 1440, height: 1000 } }), p = await c.newPage();
    await test('A Studio-independent game job opens a real player cockpit and charges one stated rental', async () => {
      await begin(p);
      await quote(p, 2, 100, 'adnan');
      const before = await state(p);
      await p.locator('[data-tab="drive"]').click();
      await p.locator('[data-start-drive="2"]').click();
      const after = await state(p), d = after.community.fieldwork.drive;
      assert.equal(d.job, 2); assert.equal(d.worker, 'adnan'); assert.equal(d.status, 'driving');
      assert.equal(d.rented, true); assert.equal(d.rental, 12);
      assert.equal(after.cash, before.cash - 12);
      assert.equal(after.dispatch.stats.completed, 0);
      assert.equal(after.dispatch.jobs.find(j => j.id === 2).status, 'travelling');
      assert(await p.locator('#drive-scene').isVisible());
      assert((await p.locator('#drive-summary').innerText()).includes('Haris'));
      await p.locator('#drive-scene').screenshot({ path: 'grad-evidence/real-drive-cockpit.png' });
      console.log('GRAD_DRIVE_COCKPIT ' + (await p.locator('#drive-scene').screenshot({ type: 'jpeg', quality: 55 })).toString('base64'));
    });

    await test('Steering and braking move a real road position while navigation explains the actual route', async () => {
      const start = (await field(p)).drive;
      // The initial shelf route heads south from the central junction. Take a
      // legal eastward detour to prove that this is not an automatic route movie.
      assert.equal(start.heading, 2);
      await control(p, 'left');
      assert.equal((await field(p)).drive.heading, 1);
      await forward(p);
      const d = (await field(p)).drive;
      assert.equal(d.x, start.x + 1); assert.equal(d.y, start.y);
      assert.equal(d.steps, start.steps + 1); assert.equal(d.speed, 20);
      assert((await p.locator('#drive-instruction').innerText()).trim().length > 5);
      await control(p, 'brake'); assert.equal((await field(p)).drive.speed, 0);
    });

    await test('A partly driven job resumes offline at the saved road position without another rental', async () => {
      const before = await state(p);
      await p.evaluate(async () => { await navigator.serviceWorker.ready; });
      await p.waitForFunction(() => !!navigator.serviceWorker.controller);
      await c.setOffline(true);
      await p.reload();
      await p.locator('#continue').click();
      assert.deepEqual(await state(p), before);
      await p.locator('[data-tab="drive"]').click();
      assert(await p.locator('#drive-scene').isVisible());
      assert.equal((await field(p)).drive.x, before.community.fieldwork.drive.x);
      assert.equal((await state(p)).cash, before.cash);
      await c.setOffline(false);
    });

    await test('Actual arrival and parking unlock booked work; hands-on carpentry then pays the accepted quote once', async () => {
      await reachDestination(p);
      const arriving = await state(p), d = arriving.community.fieldwork.drive;
      assert.deepEqual([d.x, d.y], d.destination);
      assert.equal(arriving.dispatch.jobs.find(j => j.id === 2).status, 'travelling');
      await control(p, 'brake'); await control(p, 'park');
      const parked = await state(p);
      assert.equal(parked.community.fieldwork.drive.status, 'arrived');
      assert.equal(parked.dispatch.jobs.find(j => j.id === 2).status, 'working');
      assert.equal(parked.cash, arriving.cash); assert.equal(parked.dispatch.stats.completed, 0);
      await p.locator('#phone-open').click(); await p.locator('[data-career="field"]').click();
      await p.getByRole('button', { name: /Radi na klupi/ }).click();
      const b = (await state(p)).community.craft.base;
      for (const point of [b, b + 2, b, b + 2, b + 3, b + 5]) await p.locator('[data-craft="' + point + '"]').click();
      const finished = await state(p);
      assert.equal(finished.dispatch.jobs.find(j => j.id === 2).status, 'review');
      assert.equal(finished.community.company.tools[0].condition, 65);
      assert.equal(finished.cash, parked.cash);
      await openJob(p, 2);
      await p.getByRole('button', { name: 'Predaj rad i naplati', exact: true }).click();
      const paid = await state(p);
      assert.equal(paid.cash, finished.cash + 100); assert.equal(paid.dispatch.stats.completed, 1);
      assert.equal(await p.getByRole('button', { name: 'Predaj rad i naplati', exact: true }).count(), 0);
    });

    const rc = await context({ viewport: { width: 1440, height: 1000 } }), rp = await rc.newPage();
    await test('A diagnosed and dispatched electrical job opens an actual staged repair room and completes real work', async () => {
      await begin(rp, false); await turn(rp); // The electrical client can reply on day 2.
      await quote(rp, 3, 130, 'lejla'); await turn(rp);
      const before = await state(rp), j = before.dispatch.jobs.find(j => j.id === 3);
      assert.equal(j.status, 'working'); assert.equal(j.workLeft, 1);
      await rp.locator('[data-tab="drive"]').click();
      await rp.locator('[data-start-repair="3"]').click();
      assert.equal((await field(rp)).repair.step, 0);
      const imageBefore = await rp.locator('#repair-scene').evaluate(canvas => canvas.toDataURL());
      for (const [i, action] of ['isolate', 'diagnose', 'repair', 'test'].entries()) {
        await rp.locator('[data-repair-action="' + action + '"]').click();
        assert.equal((await field(rp)).repair.step, i + 1);
        if (i === 1) {
          await rp.locator('#repair-scene').screenshot({ path: 'grad-evidence/actual-electrical-repair-room.png' });
          console.log('GRAD_REPAIR_ROOM ' + (await rp.locator('#repair-scene').screenshot({ type: 'jpeg', quality: 55 })).toString('base64'));
        }
      }
      const after = await state(rp);
      assert.equal(after.community.fieldwork.repair.status, 'won');
      assert.equal(after.dispatch.jobs.find(j => j.id === 3).status, 'review');
      assert.equal(after.cash, before.cash, 'Repair does not fabricate payment before handover');
      assert.equal(after.dispatch.stats.completed, before.dispatch.stats.completed);
      assert.notEqual(await rp.locator('#repair-scene').evaluate(canvas => canvas.toDataURL()), imageBefore);
      assert(await rp.locator('[data-repair-action="test"]').isDisabled());
      await openJob(rp, 3);
      await rp.getByRole('button', { name: 'Predaj rad i naplati', exact: true }).click();
      assert.equal((await state(rp)).dispatch.stats.completed, 1);
    });

    await test('Repair progress and the resulting paid job survive an offline restart without a second reward', async () => {
      const before = await state(rp);
      await rp.evaluate(async () => { await navigator.serviceWorker.ready; });
      await rp.waitForFunction(() => !!navigator.serviceWorker.controller);
      await rc.setOffline(true); await rp.reload(); await rp.locator('#continue').click();
      assert.deepEqual(await state(rp), before);
      await rp.locator('[data-tab="drive"]').click();
      assert.equal((await field(rp)).repair.status, 'won');
      assert(await rp.locator('[data-repair-action="test"]').isDisabled());
      await rc.setOffline(false);
    });

    await test('Android-profile touch driving fits narrow screens and stops held input when leaving the cockpit', async () => {
      const { defaultBrowserType, ...profile } = devices['Pixel 7'];
      const mc = await context({ ...profile, viewport: { width: 360, height: 800 } }), mp = await mc.newPage();
      await begin(mp); await quote(mp, 2, 100, 'adnan');
      await mp.locator('[data-tab="drive"]').tap(); await mp.locator('[data-start-drive="2"]').tap();
      await mp.emulateMedia({ reducedMotion: 'reduce' });
      const before = (await field(mp)).drive;
      await mp.locator('[data-drive-action="forward"]').tap();
      await mp.waitForFunction(steps => GradMajstoraApp.snapshot().community.fieldwork.drive.steps > steps, before.steps);
      const targets = await mp.locator('[data-drive-action]').evaluateAll(buttons => buttons.filter(b => !b.disabled).map(b => ({ w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height })));
      assert(targets.length >= 3); assert(targets.every(b => b.w >= 44 && b.h >= 44));
      assert(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await mp.screenshot({ path: 'grad-evidence/fieldwork-android-profile-360.png', fullPage: true });
      await mp.locator('#settings').click();
      const dialogState = await state(mp);
      await mp.keyboard.down('ArrowUp'); await mp.waitForTimeout(700); await mp.keyboard.up('ArrowUp');
      assert.deepEqual(await state(mp), dialogState, 'A modal dialog consumes navigation keys; the vehicle cannot move behind it');
      assert.equal(await mp.evaluate(() => GradMajstoraApp.visuals().fieldwork.held), false);
      await mp.locator('#modal-close').click();
      const session = await mc.newCDPSession(mp), button = mp.locator('[data-drive-action="forward"]');
      await button.scrollIntoViewIfNeeded(); const box = await button.boundingBox();
      await mp.waitForTimeout(650);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 11, x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
      await mp.waitForTimeout(100);
      await mp.locator('[data-tab="map"]').tap();
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const stopped = (await field(mp)).drive;
      await mp.waitForTimeout(850);
      assert.equal((await field(mp)).drive.steps, stopped.steps);
      assert.deepEqual([(await field(mp)).drive.x, (await field(mp)).drive.y], [stopped.x, stopped.y]);
      const diagnostic = await mp.evaluate(() => GradMajstoraApp.visuals().fieldwork);
      assert.equal(diagnostic.active, false);
    });

    assert.deepEqual(errors, [], 'No runtime JavaScript failures');
    assert.deepEqual(external, [], 'No external services for local driving or repair');
    assert.deepEqual(httpErrors, [], 'No missing local fieldwork assets');
    console.log('GRAD_FIELDWORK_BROWSER_CHECKS', results.length);
  } finally {
    await fs.writeFile('grad-evidence/fieldwork-browser-results.json', JSON.stringify({ at: new Date().toISOString(), checks: results, androidProfile: true, androidEmulator: false, physicalAndroidDevice: false }, null, 2));
    for (const c of contexts) await c.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
