'use strict';

// Chrome with an Android device profile and real CDP touch dispatch.
// This is neither Android-emulator execution nor physical-device testing.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { createRequire } = require('node:module');
const qa = createRequire('/tmp/tez-qa/package.json');
const { chromium, devices } = qa('playwright');
const G = require('../igra/core.js');
const origin = process.env.GRAD_ORIGIN || 'http://127.0.0.1:4173';
const results = [];

(async () => {
  await fs.mkdir('grad-evidence', { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.TEZ_CHROME || '/usr/bin/google-chrome',
    args: ['--no-sandbox'],
  });
  try {
    const { defaultBrowserType, ...profile } = devices['Pixel 7'];
    const context = await browser.newContext({ ...profile, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const errors = [], httpErrors = [], external = [];
    page.on('pageerror', e => errors.push(e.message));
    context.on('request', r => {
      if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== origin) external.push(r.url());
    });
    context.on('response', r => {
      if (r.url().startsWith(origin + '/') && r.status() >= 400) httpErrors.push({ url: r.url(), status: r.status() });
    });
    const snapshot = () => page.evaluate(() => GradMajstoraApp.snapshot());
    const visuals = () => page.evaluate(() => GradMajstoraApp.visuals());
    async function test(name, fn) {
      await fn();
      results.push({ name, passed: true });
      console.log('PASS', name);
    }
    async function map() {
      await page.locator('[data-tab="map"]').tap();
      await page.locator('#city').scrollIntoViewIfNeeded();
      const b = await page.locator('#city').boundingBox();
      assert(b && b.width > 250 && b.height > 250, 'A real visible map is required');
      return b;
    }
    async function touch(type, points) {
      await cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: points.map(p => ({ ...p, radiusX: 4, radiusY: 4, force: 0.65 })),
      });
    }
    async function pointForPlot(id) {
      const b = await map(), v = await visuals(), p = G.PLOTS[id];
      assert(Number.isFinite(v.zoom) && Number.isFinite(v.camera?.x) && Number.isFinite(v.camera?.y), 'Read-only camera diagnostics are required');
      return {
        x: b.x + b.width / 2 + ((p.x - p.y) * 32 - v.camera.x) * v.zoom,
        y: b.y + b.height / 2 + ((p.x + p.y) * 16 - v.camera.y) * v.zoom,
      };
    }
    async function pinch(startHalf, endHalf) {
      const b = await map(), x = b.x + b.width / 2, y = b.y + b.height / 2;
      await touch('touchStart', [{ id: 1, x: x - startHalf, y }, { id: 2, x: x + startHalf, y }]);
      for (let step = 1; step <= 6; step++) {
        const h = startHalf + (endHalf - startHalf) * step / 6;
        await touch('touchMove', [{ id: 1, x: x - h, y }, { id: 2, x: x + h, y }]);
      }
      // Release fingers separately, as an actual multi-touch gesture can do.
      await touch('touchEnd', [{ id: 2, x: x + endHalf, y }]);
      await touch('touchEnd', []);
    }
    async function turn() {
      await page.locator('#next-day').tap();
      await page.getByRole('button', { name: 'Pošalji ekipu →', exact: true }).tap();
    }

    await test('Android-profile touch taps select a real parcel and construct with one exact charge', async () => {
      await page.goto(origin + '/igra/');
      await page.locator('#start').tap();
      await page.getByRole('button', { name: 'Gradska kampanja', exact: true }).tap();
      await page.getByRole('button', { name: 'Krenimo graditi', exact: true }).tap();
      const environment = await page.evaluate(() => ({
        ua: navigator.userAgent, touchPoints: navigator.maxTouchPoints, viewportScale: visualViewport.scale,
      }));
      assert(environment.ua.includes('Android'));
      assert(environment.touchPoints > 0);
      const p = await pointForPlot(0);
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForFunction(() => GradMajstoraApp.visuals().selectedPlot === 0);
      const before = await snapshot();
      await page.locator('#plot-actions .primary').tap();
      const after = await snapshot();
      assert.equal(after.buildings.filter(b => b.plot === 0).length, 1);
      assert.equal(after.buildings.find(b => b.plot === 0).level, 1);
      assert.equal(after.cash, before.cash - 110);
      assert.equal(after.materials, before.materials - 2);
      assert.equal(after.revision, before.revision + 1);
    });

    await test('Single-finger panning changes the camera without selecting or changing game data', async () => {
      const b = await map(), before = await snapshot(), v = await visuals();
      const x = b.x + b.width / 2, y = b.y + b.height / 2;
      await touch('touchStart', [{ id: 1, x, y }]);
      for (let step = 1; step <= 6; step++) await touch('touchMove', [{ id: 1, x: x + step * 9, y: y + step * 5 }]);
      await touch('touchEnd', []);
      await page.waitForFunction(({ x, y }) => {
        const c = GradMajstoraApp.visuals().camera;
        return Math.hypot(c.x - x, c.y - y) > 20;
      }, v.camera);
      const after = await visuals();
      assert.equal(after.selectedPlot, v.selectedPlot);
      assert.equal(after.pointers, 0);
      assert.deepEqual(await snapshot(), before);
    });

    await test('Two-finger pinch zooms the map while separate releases never become a tap', async () => {
      await page.locator('#recenter').tap();
      const before = await snapshot(), v = await visuals();
      await pinch(30, 55);
      await page.waitForFunction(z => GradMajstoraApp.visuals().zoom > z * 1.4, v.zoom);
      const after = await visuals();
      assert(after.zoom <= 2.2 && after.zoom >= 0.3);
      assert.equal(after.selectedPlot, v.selectedPlot);
      assert.equal(after.pointers, 0);
      assert.deepEqual(await snapshot(), before);
      assert.equal(await page.evaluate(() => visualViewport.scale), 1, 'Canvas gesture must not zoom the entire page');
    });

    await test('Pinch and button zoom share bounded limits; resizing preserves a deliberately zoomed-out view', async () => {
      const before = await snapshot();
      await pinch(8, 100);
      assert(Math.abs((await visuals()).zoom - 2.2) < 0.001);
      await page.locator('#zoom-in').tap();
      assert(Math.abs((await visuals()).zoom - 2.2) < 0.001);
      await pinch(100, 8);
      assert(Math.abs((await visuals()).zoom - 0.3) < 0.001);
      await page.locator('#zoom-out').tap();
      assert(Math.abs((await visuals()).zoom - 0.3) < 0.001);
      await page.setViewportSize({ width: 360, height: 800 });
      await page.waitForFunction(() => Math.abs(GradMajstoraApp.visuals().zoom - 0.3) < 0.001);
      await page.locator('#recenter').tap();
      const v = await visuals(), z = G.ZONES[v.zone];
      assert(Math.abs(v.camera.x - (z.x - z.y) * 32) < 0.001);
      assert(Math.abs(v.camera.y - (z.x + z.y + 6) * 16) < 0.001);
      assert(v.zoom > 0.3 && v.zoom < 2.2);
      assert.deepEqual(await snapshot(), before);
    });

    await test('Third-finger release and touch cancellation do not create phantom taps or leave captured pointers', async () => {
      const b = await map(), before = await snapshot(), v = await visuals();
      const x = b.x + b.width / 2, y = b.y + b.height / 2;
      const pair = [{ id: 1, x: x - 35, y }, { id: 2, x: x + 35, y }];
      await touch('touchStart', pair);
      await touch('touchStart', [...pair, { id: 3, x, y: y + 40 }]);
      await touch('touchEnd', pair);
      await touch('touchEnd', [pair[1]]);
      await touch('touchEnd', []);
      assert.equal((await visuals()).selectedPlot, v.selectedPlot);
      await touch('touchStart', [{ id: 4, x, y }]);
      await touch('touchMove', [{ id: 4, x: x + 15, y: y + 10 }]);
      await touch('touchCancel', []);
      assert.equal((await visuals()).pointers, 0);
      assert.equal((await visuals()).selectedPlot, v.selectedPlot);
      assert.deepEqual(await snapshot(), before);
      await page.locator('#recenter').tap();
      const p = await pointForPlot(1);
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForFunction(() => GradMajstoraApp.visuals().selectedPlot === 1);
    });

    await test('Map touch controls retain 44px targets and page width across portrait and landscape sizes', async () => {
      for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
        await page.setViewportSize(viewport);
        await map();
        for (const id of ['zoom-in', 'zoom-out', 'recenter']) {
          const control = page.locator('#' + id);
          await control.scrollIntoViewIfNeeded();
          const b = await control.boundingBox();
          assert(b && b.width >= 44 && b.height >= 44, id + ' must remain a usable touch target');
          assert(b.x >= 0 && b.x + b.width <= viewport.width + 1 && b.y >= -1 && b.y + b.height <= viewport.height + 1, id + ' must be reachable in the viewport');
          await control.tap();
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), JSON.stringify(viewport));
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await map();
      await page.locator('#recenter').tap();
      await page.locator('#city').screenshot({ path: 'grad-evidence/android-profile-map.png' });
      console.log('GRAD_ANDROID_TOUCH_MAP ' + (await page.locator('#city').screenshot({ type: 'jpeg', quality: 60 })).toString('base64'));
    });

    await test('An actual touch-authored completed job and its payment survive normal and offline restart', async () => {
      await page.locator('[data-tab="jobs"]').tap();
      await page.locator('[data-job="2"]').tap();
      if (!(await snapshot()).dispatch.jobs.find(j => j.id === 2).diagnosed) await page.getByRole('button', { name: 'Pitaj za detalje', exact: true }).tap();
      await page.locator('#offer-price').fill('100');
      await page.getByRole('button', { name: 'Pošalji ponudu', exact: true }).tap();
      await page.locator('#job-worker').selectOption('adnan');
      await page.getByRole('button', { name: 'Pošalji na adresu', exact: true }).tap();
      await turn();
      await turn();
      assert.equal((await snapshot()).dispatch.jobs.find(j => j.id === 2).status, 'review');
      await page.locator('[data-tab="jobs"]').tap();
      await page.locator('[data-job="2"]').tap();
      const before = await snapshot();
      await page.getByRole('button', { name: 'Predaj rad i naplati', exact: true }).tap();
      const after = await snapshot(), job = after.dispatch.jobs.find(j => j.id === 2);
      assert.equal(job.status, 'completed');
      assert(job.paid > 0);
      assert.equal(after.cash, before.cash + job.paid);
      assert.equal(after.dispatch.stats.completed, before.dispatch.stats.completed + 1);
      await page.reload();
      await page.locator('#continue').tap();
      assert.deepEqual(await snapshot(), after);
      await page.evaluate(async () => navigator.serviceWorker.ready);
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
      await context.setOffline(true);
      await page.reload();
      await page.locator('#continue').tap();
      assert.deepEqual(await snapshot(), after);
      assert.equal((await snapshot()).version, G.VERSION);
      await context.setOffline(false);
    });

    assert.deepEqual(errors, []);
    assert.deepEqual(httpErrors, []);
    assert.deepEqual(external, []);
    console.log('GRAD_ANDROID_TOUCH_CHECKS', results.length);
  } finally {
    await fs.writeFile('grad-evidence/android-touch-results.json', JSON.stringify({
      at: new Date().toISOString(),
      checks: results,
      target: 'desktop Chrome with Pixel 7 Android user-agent, mobile viewport and CDP touch input',
      androidEmulator: false,
      physicalAndroidDevice: false,
      devicePerformanceEstablished: false,
    }, null, 2));
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
