# Verification record — 26 September 2026

This is a preparation build, **not a verified TestFlight build**. The public web build and source-level iOS checks pass. Native compilation and subscription behavior remain untested until full Xcode is available.

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
