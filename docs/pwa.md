# PWA testing and later iOS migration

Current target: a bilingual offline PWA. Do not install Xcode or buy an Apple Developer membership during this stage. The Capacitor project remains in the repository for a later native build.

## What is available

- 63 catalog entries: 11 free courses, in Ukrainian and English, playable as White or Black, and 52 private introductory courses shown as “Soon” in the public web app. Categories contain 21 beginner, 22 intermediate and 20 advanced entries. Each category shows four cards before internal scrolling.
- Full game review is free during PWA testing. Native iOS review still uses the verified StoreKit entitlement. This temporary web policy is explicit in the menu; it is not a working web subscription.
- Opponent targets: 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2400 and unrestricted MAX. Targets 600–1200 use Fairy-Stockfish’s built-in UCI_Elo mode; higher targets and all default game reviews use Stockfish 19. The menu marks bot strength as approximate, not a Chess.com rating.
- Surprise replies work only in Practice and Exam during the opening, selecting another prepared legal reply at the same position. Coach hides the entire surprise-replies block and keeps the chosen line; free play uses the selected bot strength.
- Opening lessons, both local engine JS/WASM distributions, artwork and bundled Kenney CC0 wood-click recordings run locally. No CDN or game server is required after the production app has finished saving its offline assets.
- The language selector is in the main menu. The selected language applies to theory, game feedback and review. There is no course-progress system.

The private 52 courses are introductory material, not yet complete popular-branch and trap coverage. Keep their JSON in the separate private content repository. Do not put it into `public/`, import it into web code or unlock it with a local browser flag. A future paid web product needs its own payment and content-delivery design; StoreKit works only in the native app.

## Install and update on iPhone

1. Open the deployed HTTPS app in Safari and choose **Share → Add to Home Screen → Open as Web App**.
2. Open the installed app online. Wait for **Ready to use offline** in the menu before testing without internet. The first visit must download the UI, courses and chess engine completely.
3. For an update, reconnect and return to the menu. **Update** appears after the new release is downloaded. Tap it in the menu; it reloads the app. No update reload is triggered during a game.
4. When moving from an older version without the update button, reopen its website online in Safari, or fully close the installed app and any old Safari tabs for this site, then reopen it.

An update must be deployed first; editing files on a Mac does not change the installed PWA. Browser storage may be removed by the operating system or by clearing website data. If that happens, download again online. The current game and its review are held in memory and are lost on reload; language and approximate playing level are stored locally.

Starting with v37, cache names include the service-worker scope and the public/owner build mode. Activating one scope or mode preserves the other's offline assets. Legacy caches without a scope are retained because their owner cannot be determined; clearing website data removes them. Public and owner previews at the same URL still share one service-worker registration, so use separate URLs for simultaneous testing.

Every production build contains `THIRD_PARTY_LICENSES.txt`, generated from the installed runtime packages pinned by `package-lock.json`, including dependencies bundled inside `react-chessboard`, the vendored Brilliant-Chess classifier's MIT notice and Kenney Impact Sounds CC0 provenance/license records. This file, `licenses/brilliant-chess.txt`, Fairy-Stockfish’s corresponding source archive, browser port, provenance and GPL records, Stockfish's `Copying.txt`/`SOURCE.txt` and the two classic WAV clips with their original OGGs and conversion records are saved for offline use. v45 replaces the rejected Lichess SFX set with short wood clicks; check/end events reuse those clips. These are not Chess.com recordings. The menu's sound setting is saved locally and can mute playback. See `THIRD_PARTY_NOTICES.md` for the remaining GPL distribution and App Store boundary.

## Development and publication

```sh
npm ci
npm run build
node scripts/check-catalog.mjs
node scripts/test-pwa.mjs
node scripts/test-review.mjs
node scripts/test-analysis-engine.mjs
node scripts/test-game-analysis.mjs
node scripts/test-review-context.mjs
node scripts/test-board-icons.mjs
node scripts/test-theory-geometry.mjs
node scripts/verify-no-premium-web.mjs dist
node scripts/runtime-licenses.mjs dist
npm run preview -- --port 4181
```

Service workers are enabled in production builds, not the Vite development server. Localhost can be used for desktop offline checks. A LAN HTTP address is not a replacement for the deployed HTTPS PWA on an iPhone.

`.github/workflows/deploy-pages.yml` builds and publishes `dist` when `main` changes. Its manual dispatch can build another Git ref only if GitHub Pages environment branch rules permit it. A pushed draft PR is not a publication. Keep native resources and private lessons out of the Pages artifact.

## Transfer to native iOS later

The React interface, course IDs, legal move handling, Stockfish worker and local resources are shared. `src/native/purchases.ts` is the native purchase boundary. `src/pwa.ts` and the service worker handle only the web app; they are disabled inside Capacitor.

When the owner chooses to proceed, restore the private content file and follow `docs/ios.md` to sync the existing project, install full Xcode, compile and run the app, test StoreKit locally, and only then configure signing and TestFlight. A prepared project is not a verified iOS build. Device UX, offline behavior, subscriptions, comprehensive course content and Stockfish distribution obligations still require the checks in `docs/verification.md`.

## Private owner preview

`npm run build:owner-preview` builds `dist-owner-preview/` with all 63 prepared courses available, including the 52 private introductory courses. It requires the ignored `src/data/native-premium.json` asset. Serve with `npm run preview -- --outDir dist-owner-preview --port 4181`. This is an explicit build-time mode, not a browser flag or payment bypass. It uses the `v50-owner` release and its own scope/mode cache namespace.

Do not publish this directory or change the public Pages workflow without approval to make test lesson content public. A local HTTP preview is not an installable offline iPhone PWA over Wi-Fi; phone installation requires an HTTPS host. Publication permission is pending because the earlier scope required private paid content to stay out of the public web bundle.

Verification: build both modes; run `node scripts/test-owner-preview.mjs`, `node scripts/runtime-licenses.mjs dist dist-owner-preview` and `node scripts/verify-no-premium-web.mjs dist`. The owner preview contains full lesson text intentionally; the normal web build must remain free of it.

## Dependency audit

On 3 October 2026, `npm audit --omit=dev` reports no known runtime advisories. The complete audit reports one moderate [uuid advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq) as three affected dev-dependency entries: `@capacitor/cli → xcode → uuid`. The installed Xcode helper uses `uuid.v4()`, whereas this advisory concerns `v3/v5/v6` with an external buffer. A compatible patched release is unavailable in the current dependency ranges. Do not force npm's suggested CLI downgrade or a UUID major override merely to make the counter zero; native dependency upgrades require separate compatibility verification.
