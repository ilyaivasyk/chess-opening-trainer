# PWA testing and later iOS migration

Current target: a bilingual offline PWA. Do not install Xcode or buy an Apple Developer membership during this stage. The Capacitor project remains in the repository for a later native build.

## What is available

- 11 free courses, in Ukrainian and English, playable as White or Black. Each category shows four cards before internal scrolling. The other 49 entries are previews marked “Soon” in the public web app.
- Full game review is free during PWA testing. Native iOS review still uses the verified StoreKit entitlement. This temporary web policy is explicit in the menu; it is not a working web subscription.
- Opening lessons, Stockfish JS/WASM, artwork and synthesized move sounds run locally. No CDN or game server is required after the production app has finished saving its offline assets.
- The language selector is in the main menu. The selected language applies to theory, game feedback and review. There is no course-progress system.

The private 49 courses are introductory material, not yet complete popular-branch and trap coverage. Keep their JSON in the separate private content repository. Do not put it into `public/`, import it into web code or unlock it with a local browser flag. A future paid web product needs its own payment and content-delivery design; StoreKit works only in the native app.

## Install and update on iPhone

1. Open the deployed HTTPS app in Safari and choose **Share → Add to Home Screen → Open as Web App**.
2. Open the installed app online. Wait for **Ready to use offline** in the menu before testing without internet. The first visit must download the UI, courses and chess engine completely.
3. For an update, reconnect and return to the menu. **Update** appears after the new release is downloaded. Tap it in the menu; it reloads the app. No update reload is triggered during a game.
4. When moving from an older version without the update button, reopen its website online in Safari, or fully close the installed app and any old Safari tabs for this site, then reopen it.

An update must be deployed first; editing files on a Mac does not change the installed PWA. Browser storage may be removed by the operating system or by clearing website data. If that happens, download again online. The current game and its review are held in memory and are lost on reload; language and approximate playing level are stored locally.

## Development and publication

```sh
npm ci
npm run build
node scripts/check-catalog.mjs
node scripts/test-pwa.mjs
node scripts/test-review.mjs
node scripts/verify-no-premium-web.mjs dist
npm run preview -- --port 4181
```

Service workers are enabled in production builds, not the Vite development server. Localhost can be used for desktop offline checks. A LAN HTTP address is not a replacement for the deployed HTTPS PWA on an iPhone.

`.github/workflows/deploy-pages.yml` builds and publishes `dist` when `main` changes. Its manual dispatch can build another Git ref only if GitHub Pages environment branch rules permit it. A pushed draft PR is not a publication. Keep native resources and private lessons out of the Pages artifact.

## Transfer to native iOS later

The React interface, course IDs, legal move handling, Stockfish worker and local resources are shared. `src/native/purchases.ts` is the native purchase boundary. `src/pwa.ts` and the service worker handle only the web app; they are disabled inside Capacitor.

When the owner chooses to proceed, restore the private content file and follow `docs/ios.md` to sync the existing project, install full Xcode, compile and run the app, test StoreKit locally, and only then configure signing and TestFlight. A prepared project is not a verified iOS build. Device UX, offline behavior, subscriptions, comprehensive course content and Stockfish distribution obligations still require the checks in `docs/verification.md`.
