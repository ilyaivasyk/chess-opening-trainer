# Verification record — 2 October 2026

The current target is a PWA test build. Xcode installation and native verification are deferred at the user's request. This is **not a verified TestFlight build**.

## Current PWA checks

| Check | Result | Limit |
| --- | --- | --- |
| `npm run build` | Pass: TypeScript and production bundle | Main JS is about 515 kB before gzip; Vite reports its standard chunk-size warning |
| `node scripts/test-pwa.mjs` | Pass: complete precache, matching release acknowledgement, manual update, failed-download recovery, scoped cache cleanup, matching shell/assets, `Vary: Origin` regression | Mocked worker lifecycle |
| Production browser, local server stopped | Pass: page reloaded from cache, lesson opened, Stockfish responded, a short game review completed and displayed its first line | Desktop in-app browser; not a physical iPhone or airplane-mode device test |
| Actual menu update | Pass: pending worker activated only after clicking Update, then reloaded to a matching cached release | Foreground/timer behavior on iOS still needs device testing |
| Four-card opening list | Pass: four full rows in a 443 px container at 414 CSS px; native keyboard scrolling changes the internal scroll position | iPhone 11 viewport emulation, not physical hardware |
| Long UK/EN names | All three categories checked at 320 CSS px: no card clipping or horizontal document overflow | Browser emulation; Dynamic Type and VoiceOver remain open |
| Catalog and public-content check | Pass: all 61 course lines in both colors/languages legal and aligned; exactly 11 free courses; all 100 private summaries absent from production output | Does not verify all chess claims or comprehensive popular-line coverage |
| `node scripts/test-review.mjs` | Pass: legal first line from the position before the move, 120-ply search, timeout and cancellation | Mock engine responses; full long-game on-device review still pending |

During the first real offline check, the app shell loaded but React did not. Vite preview adds `Vary: Origin`; precached requests lacked the Origin header present on module/style requests. v23 ignores this header difference only for the known public static assets and passed the server-stopped retest. Arbitrary GET responses retain their Vary matching.

Full review is free in the PWA testing phase. Private courses are previews marked “Soon” in the web app; native StoreKit gating remains in place. Public CI validates catalog shape, PWA lifecycle, review regression and private-content import/asset boundaries before publishing. When private content is absent in CI, its phrase-by-phrase comparison is explicitly skipped; local verification also compares all private summaries.

## Detailed game review checks — 2 October 2026

- `node scripts/test-analysis-engine.mjs`: passes with the exact JS/WASM bytes bundled in the PWA. Covers matching selected-move scores/PVs, both colors, paired pre/post move signs, legal first lines, mate/stalemate, strength switching to MAX, castling, en passant and promotion. The actual App analysis pipeline also reviews all **120 plies** with this real engine, for both player colors, reaching 100% without a cutoff.
- `node scripts/test-game-analysis.mjs`: passes for 140-ply games using controlled engine responses; verifies chronology and metadata, both colors, PV legality and pre-move start, complete/failed/cancelled runs, failure on the final move, repetition/checkmate results, both-color promotion/underpromotion and confirmed sacrifice compensation. Invalid analysis never returns a partial completed review.
- `node scripts/test-review-context.mjs`: passes for all 11 free opening families and common transpositions. Capturing f7 or exchanging a bishop no longer produces a false warning about blocking that bishop.
- Production UI: completed an 18-ply Italian training game, cancelled its active review, successfully restarted, and navigated the finished review. Before the actual Bc4, the engine's Bb5/a6 line starts with the bishop still on f1, replays legally, and returns to the actual Bc4. All six displayed plies, line boundaries and the original initial board are reachable.
- Production UI with the server stopped: reloaded the full cached v25 PWA, opened an English lesson as Black, played a legal deviation without automatic undo, received engine replies and completed the five-ply resigned game's review. For g5, replaying the recommended e6 restores g7 first, plays Black's pawn to e6, and calculates the displayed position's advantage.
- At the iPhone 11 viewport (414 × 896), the commentary is 232 px high and the board starts at the same document position (334 px) before and during line replay. Controls remain directly below the board. 414/430 px views show no horizontal overflow. A 320 px short desktop view exposed a fixed body minimum width interacting with the native scrollbar; that unnecessary minimum was removed.
- Short/book-only games now show insufficient evidence instead of an invented approximate level. The remaining game-level formula is an **uncalibrated heuristic**, not a Chess.com or federation rating.
- Playing requests require a legal engine move; reviewing requests require a matching exact score/PV. A timed engine result containing only a score bound triggers one selected-move recovery search for analysis. A timeout destroys the old worker; late results cannot complete a later search.
- Promotion no longer silently defaults to a knight. A native browser dialog offers queen, rook, bishop and knight, with keyboard focus and Escape handled by the platform. Promotion replay is tested in both colors; the promotion dialog still needs physical iPhone interaction testing.

The engine runs at unrestricted maximum strength for review, with 300 ms searches and deeper sacrifice checks. This is a finite approximation, not unlimited-depth analysis or a reproduction of Chess.com's proprietary classification. Error explanations outside course theory remain chiefly evaluation-loss text plus the replayable best line; exhaustive tactical prose is not implemented. Physical iPhone Safari/PWA, VoiceOver and native iOS checks remain open. The current draft branch is not deployed to public Pages.

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

### Result badges and material display (v28)

- Checkmate uses a red fallen-king SVG; the winner uses a green crown SVG. Labels appear briefly, then can be reopened by tapping the 44px target. Resignation is labelled separately and is hidden on earlier review positions.
- Captures reuse the board's SVG pieces, grouped with counts; the advantage is computed from the displayed board, including promotions, rather than subtracting capture counts.
- `node scripts/test-board-icons.mjs` verifies mate/resignation mapping, hiding historical outcomes, SVG theory icons and grouped captures. Resignation was also exercised through the real UI at 414×896. Physical iPhone Safari remains unverified.
- Catalog now has 61 entries (20 beginner / 21 intermediate / 20 advanced), including a risky Grob introductory course in the private native asset. Public PWA still exposes 11 complete free courses; premium entries, including Bird and Grob, remain previews marked Soon. The unconventional filter selects seven existing entries, not an exhaustive or statistically ranked list.
- Petrov uses its alternative established name; the former geographic 4.Bg5 label is now a descriptive move label. The underlying lines and IDs are unchanged.
- Traps toggle and individual course purchases were discussed; neither has been implemented in this change.

- Final review at 320×568: document client width 305px and scroll width 305px (no horizontal overflow), board 260px. Actual before-move first line was visible in the UI. Result badges: 2 at the final resigned position, 0 on an earlier reviewed move.
- Explicit private owner-preview build now unlocks all 61 prepared courses. Both-language inclusion and distinct service-worker release are checked by `scripts/test-owner-preview.mjs`; public build still passes all 100 private-summary exclusions. Public phone deployment is pending permission to publish the test content.

- Owner preview UI: all seven unconventional cards were available; Grob's theory opened and 1.g4 was accepted as the taught move. This exposed missing recognition of new families, now covered by additional position anchors and a regression check. Course completeness remains introductory for most private courses.

- Editorial pass: all 50 private main lines and their additional scenarios were read. Specific incorrect pin/attack/diagonal/castling descriptions were corrected in both languages. `scripts/test-theory-geometry.mjs` checks unambiguous English piece-target and pin assertions against the actual position. This limited grammar does not validate all strategic prose or replace independent book-level review.

## Latest checkpoint — full owner preview

61 prepared courses are unlocked in the private owner-preview build (11 free, 50 premium introductions). Ordinary public builds still exclude premium lesson text. Full curricula and all popular branches/traps are not complete. Publication of the all-content phone preview remains pending user confirmation.

Fixed truncation of the last black move in generated courses: a final learner move can now end the lesson without an invented opponent reply; Stockfish continues the game. Catalog legality and locale checks pass. 370 explicit English piece-target/pin claims pass board geometry checks; this is not a book-level semantic verification. Physical iPhone testing and native compilation remain unverified.
