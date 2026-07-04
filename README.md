# Neon Strike

HD HTML5 mobile hypercasual soccer kicks & goals.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173/
npm test         # Vitest physics + RLS tests
npm run build    # production build into dist/ + postbuild copy
npm run preview  # serve dist/
```

## Stack

- **Engine:** Phaser 3.90 (global CDN script)
- **Build:** Vite 6 + TypeScript 5
- **Backend:** PocketBase (schema in `pb/migrations/collections.json`)
- **Native wrap:** Capacitor 8 (config in `capacitor.config.ts`)
- **Tests:** Vitest 3 (`tests/physics.test.js`, `tests/rls.test.js`)

## What is implemented

- **Core loop**: drag-back flick power + sideways swipe curve, custom projectile physics, goals/top-corner perfects, streaks, lives, 10-level difficulty curve, keeper AI, wall, moving target ring, wind, storm/timer finale.
- **Juice**: 1.5s celebration beat — hit-stop, slow-motion, screen-shake, confetti/sparks, net ripple, chromatic flash, haptic double-tap, score popups.
- **Audio**: procedural Web Audio kick/net/post/goal/miss/UI/perfect sounds; AudioContext resume on first touch for iOS.
- **Meta**: localStorage progression, 5 unlockable skins, achievements, daily challenge with deterministic seed, in-game shop, rewarded-video mock, IAP mock, remove-ads toggle.
- **Backend**: PocketBase collections, RLS rules, weekly-reset hook, offline-fallback client.
- **Packaging**: PWA manifest + service worker precache, Capacitor config, GitHub Actions CI + APK build.

## APK build

The debug APK is produced automatically by `.github/workflows/build-apk.yml` in GitHub Actions.

Local Android build (requires Android SDK + Java):

```bash
npm install
npm run build
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

The APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Architecture

- `index.html` / `game.js` — current playable runtime (no build required).
- `src/` — modular support systems and TypeScript scaffold.
- `pb/` — PocketBase collections and hooks.
- `tests/` — Vitest tests.
- `.github/workflows/` — CI, PWA verification, and APK build.
