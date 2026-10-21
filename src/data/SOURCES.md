# Opening catalog source and verification record

The 63 course families are a **curated introductory curriculum**, with 21 beginner, 22 intermediate, and 20 advanced entries. Eleven courses are free; 52 are private native lessons. No entries have been ranked or selected using measured game frequency, rating-band statistics, or a live Lichess Opening Explorer query.

The public [Lichess Chess Openings index](https://github.com/lichess-org/chess-openings/blob/master/README.md) (CC0) is the reference for opening family names and ECO codes. Each public catalog item links to the corresponding [A](https://github.com/lichess-org/chess-openings/blob/master/a.tsv), [B](https://github.com/lichess-org/chess-openings/blob/master/b.tsv), [C](https://github.com/lichess-org/chess-openings/blob/master/c.tsv), [D](https://github.com/lichess-org/chess-openings/blob/master/d.tsv), or [E](https://github.com/lichess-org/chess-openings/blob/master/e.tsv) source volume. This index supplies named positions and PGN move orders. It does not certify our strategic explanations or a move's engine quality.

The free courses retain their existing move sequences. The 52 private courses contain 67 introductory lines: 37 have one line and 15 have two. Forty lines contain four player steps, 23 contain five, and four contain six to eight. The following additional branches were checked against named Lichess PGN rows:

| Course | Branch | Lichess volume |
| --- | --- | --- |
| Scotch Game | Scotch Gambit | [C44](https://github.com/lichess-org/chess-openings/blob/master/c.tsv) |
| Four Knights Game | Scotch Variation | [C47](https://github.com/lichess-org/chess-openings/blob/master/c.tsv) |
| French Defense | Advance Variation | [C02](https://github.com/lichess-org/chess-openings/blob/master/c.tsv) |
| Scandinavian Defense | Modern Variation | [B01](https://github.com/lichess-org/chess-openings/blob/master/b.tsv) |
| Pirc Defense | Austrian Attack | [B09](https://github.com/lichess-org/chess-openings/blob/master/b.tsv) |
| King's Gambit | Falkbeer Countergambit | [C31](https://github.com/lichess-org/chess-openings/blob/master/c.tsv) |
| Petrov Defense | Cochrane Gambit | [C42](https://github.com/lichess-org/chess-openings/blob/master/c.tsv) |
| Slav Defense | Exchange Variation | [D13](https://github.com/lichess-org/chess-openings/blob/master/d.tsv) |
| Catalan Opening | Closed Catalan | [E08](https://github.com/lichess-org/chess-openings/blob/master/e.tsv) |
| Budapest Gambit | Alekhine Variation | [A52](https://github.com/lichess-org/chess-openings/blob/master/a.tsv) |
| Semi-Slav Defense | Marshall Gambit | [D31](https://github.com/lichess-org/chess-openings/blob/master/d.tsv) |
| Benko Gambit | Accepted Gambit | [A57–A58](https://github.com/lichess-org/chess-openings/blob/master/a.tsv) |
| Sicilian Najdorf | English Attack | [B90](https://github.com/lichess-org/chess-openings/blob/master/b.tsv) |
| Sicilian Dragon | Yugoslav Attack | [B75–B76](https://github.com/lichess-org/chess-openings/blob/master/b.tsv) |
| Berlin Defense | 4.d3 setup | [C65](https://github.com/lichess-org/chess-openings/blob/master/c.tsv) |

The short move notes and goals are original descriptions of the displayed positions. We check move legality, turn order, both-color lesson structure, and Ukrainian/English parity with `node scripts/check-catalog.mjs --require-native`. We have **not** performed an engine MultiPV review, frequency analysis, or independent expert review of every theory sentence. These are introductions, not complete opening repertoires or a full trap-to-middlegame curriculum.

Paid lesson text is stored only in the private content repository and the native iOS bundle. The public web build imports catalog metadata and eleven free lessons; its release process must continue checking that paid prose is absent from web assets.

Additional reference checks (2026-10-02):
- Bird: https://www.chess.com/openings/Birds-Opening — 1.f4, Dutch-style setups and From's Gambit.
- Grob: https://www.chess.com/openings/Grob-Opening — 1.g4, ...d5/Bg2/...c6 setup; risky and weakens the king. Current native course is introductory, not complete coverage.
- Petrov naming: https://www.chess.com/openings/Petrovs-Defense — alternative to Russian Game.

Editorial correction pass (2026-10-02): reviewed the main move explanations of the then-existing 50 introductory private courses plus their extra scenarios. Corrected early Bb5/Bb4 “pin” claims where d7/d2 still blocked the king diagonal, Polish ...Nf6 incorrectly said to attack Be5, Taimanov ...Qc7 incorrectly said to directly support c5 through Nc6, and generic Bd6 “same diagonal” wording. F7 king captures lose castling rights; f7 is not a central square. These are board-geometry corrections, not a claim to have completed book-level independent review of every strategic plan.
References: https://www.chess.com/openings/Ruy-Lopez-Opening ; https://www.chess.com/openings/Four-Knights-Game ; https://www.chess.com/openings/Polish-Opening ; https://raw.githubusercontent.com/lichess-org/chess-openings/master/a.tsv

Danish Gambit C21 and Stafford Gambit C42 introductory lines follow the CC0 Lichess C opening index: https://github.com/lichess-org/chess-openings/blob/master/c.tsv . Explanations are original UK/EN text, with board geometry checks. Risk labels do not imply a sound repertoire recommendation.

## Offline opening names and public book moves (2026-10-03)

`opening-index.json` is a deterministic projection of all five public Lichess TSV volumes at commit [`c67912be581f0793dbaa776be5ccf111e01f88d9`](https://github.com/lichess-org/chess-openings/tree/c67912be581f0793dbaa776be5ccf111e01f88d9). The upstream [README](https://github.com/lichess-org/chess-openings/blob/c67912be581f0793dbaa776be5ccf111e01f88d9/README.md) releases the facts under [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/). The snapshot retains the source PGN, English name, ECO and computed position for each of its 3,815 rows, plus legal move edges from 5,485 book positions. It contains no private lesson prose.

Recognition uses the last named position reached, with piece placement, side to move, castling rights and legal en-passant state. Named positions cover every one of the 63 catalog families, including Stafford, Danish, Najdorf, Meran and Stonewall; this does not mean each short introductory lesson reaches its family's most precise named position. English displays upstream variation names. Ukrainian uses existing translated course/variation names and the exact ECO; an unlocalized family displays its ECO rather than an invented translation. A book move must be an actual edge in an upstream PGN, not merely any legal move from a known position.

Regenerate with `node scripts/update-opening-index.mjs` using the pinned revision; an optional directory argument reads already downloaded `a.tsv` through `e.tsv`. `node scripts/test-review-context.mjs` replays every source PGN, verifies every indexed position and book edge, checks all catalog families, and tests names and transpositions. The CC0 index provides opening facts; it does not validate our historical or strategic explanations, engine evaluations, practical soundness, or complete repertoire coverage.

Contextual correction pass (2026-10-03): the free-course UK/EN notes now inspect the displayed board for a3/a6/b5/b3 and the bishop moves Bg4/Bg5/Bh4/Bb4. In particular, Najdorf ...a6 does not attack an absent b5 bishop, Albin a3 does not attack an absent b4 bishop, Semi-Slav ...b5 attacks the bishop on c4, Chigorin ...Bg4 is not a pin through the e2 pawn, and Tartakower Bh4 is not a pin through Be7. London b3 describes the pawn moving to the c2 pawn's protection. Six UK/EN regression positions and the explicit English geometry checks cover these corrections; independent review of all strategic prose remains outstanding.

## Analysis mathematics (2026-10-03)

The local move-accuracy and complete-game accuracy calculations in `src/game-analysis.ts` independently implement the mathematics described on [Lichess Accuracy](https://lichess.org/page/accuracy), checked against [AccuracyPercent.scala](https://github.com/lichess-org/lila/blob/4f00b4643caf30918303b30adcfbe0cbb2eff8a8/modules/analyse/src/main/AccuracyPercent.scala) at revision `4f00b4643caf30918303b30adcfbe0cbb2eff8a8`. No Scala or Lila UI implementation is copied. The full-precision move coefficients and +1 uncertainty allowance match that source; the public explanatory page still displays rounded coefficients without the allowance. Win percentages clamp centipawns to ±1000, including mate evaluations.

Game accuracy uses sliding windows of 2–8 positions, population standard deviation clamped to 0.5–12 as weights, and the average of the volatility-weighted and harmonic means. Weights come from the **complete alternating-color trace before selecting a side**. Our trace begins with the actual initial Stockfish evaluation; Lichess's default is 15 cp. Per-side empty input displays zero locally; the upstream combined result is optional. Engine builds, search duration and initial evaluation differ, so this does not promise identical Lichess scores. Independent numerical fixtures cover both colors, window sizes 2/3/4/8, late errors, quiet and volatile traces, and mate clamping.

The separate two-game placement screen still aggregates human-only samples without a full opposing-side evaluation trace. Its estimate remains an uncalibrated approximation, not a Lichess or Chess.com rating. Move category glyphs are based on the MIT classifier recorded in `THIRD_PARTY_NOTICES.md`, plus additional engine verification for sacrifices; Lichess's own advice exposes inaccuracy/mistake/blunder rather than Chess.com-style brilliant moves.
