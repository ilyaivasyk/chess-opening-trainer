# Verification record — 2 October 2026

The current target is a PWA test build. Xcode installation and native verification are deferred at the user's request. This is **not a verified TestFlight build**.

## Current PWA checks

| Check | Result | Limit |
| --- | --- | --- |
| `npm run build` | Pass: TypeScript and production bundle | Main JS is about 507 kB before gzip; Vite reports its standard chunk-size warning |
| `node scripts/test-pwa.mjs` | Pass: complete precache, matching release acknowledgement, manual update, failed-download recovery, scoped cache cleanup, matching shell/assets, `Vary: Origin` regression | Mocked worker lifecycle |
| Production browser, local server stopped | Pass: page reloaded from cache, lesson opened, Stockfish responded, a short game review completed and displayed its first line | Desktop in-app browser; not a physical iPhone or airplane-mode device test |
| Actual menu update | Pass: pending worker activated only after clicking Update, then reloaded to a matching cached release | Foreground/timer behavior on iOS still needs device testing |
| Four-card opening list | Pass: four full rows in a 443 px container at 414 CSS px; native keyboard scrolling changes the internal scroll position | iPhone 11 viewport emulation, not physical hardware |
| Long UK/EN names | All three categories checked at 320 CSS px: no card clipping or horizontal document overflow | Browser emulation; Dynamic Type and VoiceOver remain open |
| Catalog and public-content check | Pass: all 60 course lines in both colors/languages legal and aligned; exactly 11 free courses; all 98 private summaries absent from production output | Does not verify all chess claims or comprehensive popular-line coverage |
| `node scripts/test-review.mjs` | Pass: legal first line from the position before the move, 120-ply search, timeout and cancellation | Mock engine responses; full long-game on-device review still pending |

During the first real offline check, the app shell loaded but React did not. Vite preview adds `Vary: Origin`; precached requests lacked the Origin header present on module/style requests. v23 ignores this header difference only for the known public static assets and passed the server-stopped retest. Arbitrary GET responses retain their Vary matching.

Full review is free in the PWA testing phase. Private courses are previews marked “Soon” in the web app; native StoreKit gating remains in place. Public CI validates catalog shape, PWA lifecycle, review regression and private-content import/asset boundaries before publishing. When private content is absent in CI, its phrase-by-phrase comparison is explicitly skipped; local verification also compares all private summaries.

## Earlier checks — 26 September 2026

The public web build and source-level iOS checks passed. Native compilation and subscription behavior remain untested until full Xcode is available.

| Check | Result | Limit |
| --- | --- | --- |
| `npm run ios:sync` | Pass: TypeScript/Vite build, Capacitor sync, private content copied to native resource | Does not compile or run Swift/iOS |
| `node scripts/check-catalog.mjs --require-native` | Pass: 20 courses per level; 11 free/49 paid; legal lines and UK/EN IDs/moves for both colors | Does not prove opening frequency, engine quality, or editorial accuracy |
| `npm run check:course` | Pass: existing Italian white/black lessons | Covers only those lessons |
| `node scripts/test-review.mjs` | Pass: matched score and first line from the position before the move; 120-ply search, timeout and cancellation | Mock worker; not a real iOS game review |
| `npm run test:rating` | Pass: two complete games, one with each color | Estimate is not a Chess.com rating |
| Paid-content leak check in `ios:sync` | Pass: paid lesson summaries absent from `dist` and native WebView assets | A distributed IPA remains extractable |
| iOS plist/project/strings syntax | Pass with `plutil` and XML checks | No Xcode compiler available |
| Web responsive layout | At widths 320, 375, 414, 430 and 768 CSS px, document width did not exceed viewport width | Browser emulation only; no physical iPhone 11 or simulator run |

The bilingual private lessons currently cover **introductory lines**, with 34 paid courses having one scenario per color and 15 having two. They are not yet the selected popular-branch and trap coverage requested for a full release. The source record is in `src/data/SOURCES.md`. The content must be expanded and independently checked before being described as comprehensive.

## Native acceptance still open

- Install full Xcode 26+ and build the `App` scheme for an iPhone 11 simulator, a smaller screen, and a larger screen. Check Dynamic Type, VoiceOver, keyboard/accessibility labels, board gestures and scrolling, performance, audio and offline launch.
- Run `Local.storekit` monthly and yearly purchases, cancellation, pending purchase, restore, renewal, expiration, refund/revocation and offline entitlement checks. Confirm full review and paid lessons stay locked when not entitled.
- Run a real long-game review on device and verify the first line, evaluation chart, move labels and interruption behavior.
- Resolve Stockfish GPL distribution obligations and App Store compatibility; see `THIRD_PARTY_NOTICES.md`.
- Publish and open the privacy policy URL, then configure live subscription products, signing, and TestFlight in the account owner's App Store Connect.
