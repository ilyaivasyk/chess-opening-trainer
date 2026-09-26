# iOS build and subscription handoff

The iOS app is a Capacitor 8 shell around the local Vite build. It includes the web UI, chess engine files, and a native StoreKit 2 bridge. Its bundle ID is `com.ilyaivasyk.debut`; iOS 15 or later is the deployment target. The web service worker is disabled in the native shell, so its packaged assets are the offline source.

The Home Screen name is localized by `en.lproj/InfoPlist.strings` (`Debut`) and `uk.lproj/InfoPlist.strings` (`Дебют`). The launch storyboard contains only artwork, with no text to translate. App Store name, subtitle, and description are separate App Store Connect metadata; create and review English and Ukrainian versions there before distribution. The `InfoPlist.strings` files do not localize the App Store listing.

## Private lesson content

The public code repository is [chess-opening-trainer](https://github.com/ilyaivasyk/chess-opening-trainer). The 49 paid lessons in both languages belong in the separate **private** [chess-opening-trainer-content](https://github.com/ilyaivasyk/chess-opening-trainer-content) repository. Restore that repository's `native-premium.json` to `src/data/native-premium.json` in this checkout before an iOS build. The file must have the shape `{ "uk": Course[], "en": Course[] }`, with the same 49 IDs in both arrays. Both this source file and the copied `ios/App/App/native-premium.json` are gitignored in the public repository. Do not force-add them, put them in `public/`, or import them into web TypeScript.

```sh
git clone https://github.com/ilyaivasyk/chess-opening-trainer-content.git ../chess-opening-trainer-content
cp ../chess-opening-trainer-content/native-premium.json src/data/native-premium.json
npm ci
npm run ios:sync
open ios/App/App.xcodeproj
```

`ios:sync` checks the private file first, copies it to a native Xcode bundle resource outside the WebView's `public` directory, validates the complete bilingual catalog, builds the web app, checks the web output for lesson text, syncs Capacitor, and checks the iOS web assets again. It fails with a clear message if the private file is missing or incomplete. A normal web build does not need the private file. The native bridge checks a verified current StoreKit entitlement before returning full paid lessons. A determined person can still extract files from a distributed IPA; server delivery is required if the lesson text itself must resist extraction.

## Products and API

`src/native/purchases.ts` exposes `getPremiumStatus()`, `getPremiumProducts()`, `purchasePremium(productId)`, `restorePurchases()`, `getPremiumCourses(locale)`, and `onPremiumStatusChange(listener)`. On the web, status is false and products are empty; purchase, restore, and paid-content calls reject. The app should only show prices returned by StoreKit (`displayPrice`), since those are localized for the customer's storefront.

The two auto-renewable subscriptions are in one group and grant the same Pro access: all opening lessons and full game analysis.

| Product ID | Local Xcode test price | Period |
| --- | ---: | --- |
| `com.ilyaivasyk.debut.pro.monthly` | $3.99 | One month |
| `com.ilyaivasyk.debut.pro.yearly` | $29.99 | One year |

There is no introductory offer. `ios/App/App/Local.storekit` defines local test products in Ukrainian and English. The shared `App` Xcode scheme selects it for **Run** only. These prices and products are test data; they are not published to App Store Connect. For a real sale, create the same IDs and subscription group in App Store Connect, configure the live prices, storefronts and localizations, complete Apple's paid-app agreements, and test with Sandbox/TestFlight after selecting **None** for StoreKit Configuration in the Xcode Run scheme.

The bilingual privacy policy is bundled as `public/privacy.html` and opens locally in the iPhone app. The intended public App Store Connect URL is `https://ilyaivasyk.github.io/chess-opening-trainer/privacy.html`. This branch has not been deployed to GitHub Pages, so verify that URL returns the final policy before submitting it. The paywall links to Apple's [standard EULA](https://www.apple.com/legal/internet-services/itunes/dev/stdeula/) for terms.

StoreKit's verified `Transaction.currentEntitlements` determines access, including expiration, revocation, and billing grace periods. The native plugin refreshes on launch, foreground, purchase, restore, and transaction updates. Restore invokes `AppStore.sync()` only after the user's button action, which may show an Apple authentication prompt.

## Native verification still required

This Mac currently has macOS 26.6.2 and about 46 GiB free, but only Xcode Command Line Tools. Capacitor 8 requires full Xcode 26 or later for iOS builds. The Mac App Store currently offers Xcode 27.0 (3,076 MB download, minimum macOS 26.6). `mas` was installed, but the command-line Xcode installation requires an administrator password, and an App Store sign-in could not be checked through the available UI. Installation could not be completed unattended here. Apple says a paid Developer Program membership is not needed to download Xcode or run local StoreKit tests. Install Xcode from the Mac App Store, select it with `xcode-select` if needed, open the project, and run the shared `App` scheme in a simulator. A signing team and Apple Developer Program/App Store Connect access are required later for distribution and live subscriptions.

Before release, verify product loading, monthly and yearly purchases, cancellation, pending Ask to Buy, restore, renewal, expiry, refund/revocation, offline relaunch, and that unpaid users cannot load the private lessons or full analysis. Also inspect the final `dist/` and `ios/App/App/public/` for paid lesson text. Native compilation and StoreKit behavior have **not** been verified on this Mac yet.

Review [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) before distribution. The Stockfish GPL scope for this Web Worker integration and App Store compatibility remain unresolved legal release questions.

Dependency audit at this handoff: `npm audit --omit=dev` found no production advisories. The full audit found a moderate advisory in the development-only Capacitor CLI → `xcode` → `uuid` chain. Do not apply its forced CLI downgrade without retesting Capacitor version compatibility.

References: [Capacitor iOS setup](https://capacitorjs.com/docs/ios), [local iOS plugin](https://capacitorjs.com/docs/ios/custom-code), [Apple StoreKit local testing](https://developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode), [Apple current entitlements](https://developer.apple.com/documentation/storekit/transaction/currententitlements), [Apple restore behavior](https://developer.apple.com/documentation/storekit/appstore/sync()), [Xcode requirements](https://developer.apple.com/xcode/system-requirements), [Xcode membership requirement](https://developer.apple.com/xcode/resources/).
