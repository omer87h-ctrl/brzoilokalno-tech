# Grad majstora: mobile input and persistence verification

## Evidence levels

The executable `scripts/test_grad_mobile.cjs` uses **desktop Google Chrome with
Playwright's Pixel 7 device profile**, an Android user agent, a mobile viewport,
mobile page behavior and touch support. It dispatches real browser touch input
through the Chrome DevTools Protocol; it does not replace the game's event
handlers or directly mutate gameplay state.

This is **not a physical Android test and not an Android-emulator test**. It can
reproduce browser gesture and viewport defects but cannot establish device GPU
performance, battery use, thermal behavior, Android memory pressure, keyboard or
file-picker behavior, or reliability in every Android browser.

Run only in the existing test environment with the existing pinned Playwright
installation and a real locally served build:

```sh
TEZ_CHROME="$(command -v google-chrome)" node scripts/test_grad_mobile.cjs
```

`GRAD_ORIGIN` can select the test server; the default is `http://127.0.0.1:4173`.
The complete portal build, not a copied static screenshot, must be served there.
The root workflow provides that server. Do not infer a passing result merely from
this document or the existence of the test file.

## Executable acceptance

1. Touch-select an actual parcel and construct one home with the exact displayed
   one-time resource charge.
2. Pan using a single-finger CDP touch stream. The camera moves; selected parcel,
   game data and revision remain unchanged.
3. Pinch using two simultaneous touches, release fingers separately, and confirm
   map zoom changes without a phantom tap or browser-page zoom.
4. Reach both zoom limits using touch, verify button limits agree, resize while
   zoomed out, and recenter on the real current district.
5. Introduce a third finger, release it, then cancel a separate gesture. Confirm
   no accidental selection, no retained pointers, unchanged game data, and a
   subsequent normal touch tap still works.
6. Verify 44 CSS-pixel zoom/recenter targets, actual control taps, reachable
   controls and no horizontal page overflow at 360×800, 390×844 and 844×390.
7. Negotiate and dispatch a real job using the touch UI, complete its travel and
   work days, collect its actual payment, and compare the complete saved state
   after normal and offline reloads.

The suite writes `grad-evidence/android-touch-results.json`, a real map screenshot,
and the `GRAD_ANDROID_TOUCH_CHECKS` count. That JSON explicitly records that
physical Android, an Android emulator and device performance were not tested.
It records each completed check and remains useful when a later check fails.

## Required physical-device check

A release reviewer with a physical Android phone should record device/model,
Android version, browser/version, date and result. Use a fresh profile or export
an existing game before resetting it.

- Open the public game online. Start a career and complete its guided first job.
- Tap every map control. Pan slowly and rapidly. Pinch with two fingers, lift
  either finger first, add/remove a third finger, and repeat near canvas edges.
- Confirm the page scrolls normally outside the map and remains stable while
  interacting inside it. Rotate portrait/landscape and return to portrait.
- Switch tabs and apps during a gesture, background/foreground the game, lock
  and unlock the screen, then use the map again.
- Complete and collect a job; export a backup. Close the browser process, reopen
  it and verify the same job, payment, tools and day history.
- Once the offline copy is ready, enable airplane mode and restart. Continue the
  game and verify the same saved state. Reconnect and confirm newer online files
  do not erase local progress.
- Check a low-memory/older device separately. Record freezes, missed touches,
  reloads or dropped progress instead of reporting an unmeasured FPS/battery claim.
- Check Chrome and at least one other browser (for example Samsung Internet or
  Firefox Android). Browser compatibility is not established by user-agent text.

Do not clear browser data as an unexplained remedy: it deletes browser-local
saves. Export a backup first and distinguish browser storage restrictions/private
mode from an application defect.

## Android-emulator availability in this session

Read-only environment inspection on 2026-10-21 found a Chromium executable but
no `adb` or `emulator` command and no `/dev/kvm`. No Android system image was
installed and no Android-emulator job was launched. A future dedicated Linux CI
emulator job is technically possible if KVM and an Android system image are
configured, but it would still be emulator evidence, not physical-device evidence.
The present release must not be described as physically Android-tested on the
strength of this suite.
