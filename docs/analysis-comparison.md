# Analysis comparison: the 21 October 2026 user game

The complete user-provided PGN is saved in `scripts/fixtures/wintr-comparison.pgn`.
It contains 95 plies: 48 White moves and 47 Black moves, ending in checkmate.
The `Stockfish 1000` player header describes the opponent during the game; the
review always uses the unrestricted Stockfish 19 analysis engine.

## Verified behaviour

The actual offline `analyseRecordedGame` and `StockfishEngine` path reproduced
94.1104% White accuracy and 86.1660% Black accuracy with 300 ms searches. These
round to the reported 94% / 86%. A separate run using depth 18 for every position,
and depth 22 around the critical decisions, gave 93.8527% / 85.1029%.
These are individual runs, not fixed outputs: timed search results depend on the
device and search history.

Both runs found the correct consequence of **8...g6**:

- Timed search: White's evaluation rises from +1.02 to +4.60 pawns.
- Depth 22: it rises from +0.83 to +4.73.
- Best alternative before the move: **8...Nb4**.
- Punishment after the move: **9.Bxd5+ Kd7 10.Bxc6+ bxc6**.
- The first capture removes Black's knight on d5. In the shown continuation,
  Black's material balance deteriorates by three points.

The previous classifier called this a mistake because its raw-centipawn blunder
boundary was four pawns. The timed loss was 3.58 pawns; the deeper loss was 3.90.
The first line and the knight-loss explanation were already correct.

## Severity rule and comparison limits

The app retains its MIT-licensed Brilliant-Chess classifier and adds an original
minimum-severity rule: losing at least **22 percentage points** under the app's
existing win-probability model is a blunder. A move classified as engine-best or
an engine-confirmed brilliant sacrifice is protected. For 8...g6 the timed
probability loss is approximately 25.19 percentage points, so it is a blunder.

This threshold is informed by WintrChess's published
[point-loss boundaries](https://github.com/WintrCat/wintrchess/blob/d145b20968955ca955cafe3fc3b51305f3bf41f9/shared/src/lib/reporter/classification/pointLoss.ts#L89-L107).
No WintrChess implementation was copied. This is a minimum-severity correction,
not a claim that the two classifiers or their remaining categories are identical.

Accuracy mathematics is unchanged. The app uses its existing Lichess-derived
sigmoid (gradient 0.00368208, centipawn clamp), volatility weighting and harmonic
average. WintrChess publishes a different
[expected-points model](https://github.com/WintrCat/wintrchess/blob/d145b20968955ca955cafe3fc3b51305f3bf41f9/shared/src/lib/reporter/expectedPoints.ts)
and [accuracy calculation](https://github.com/WintrCat/wintrchess/blob/d145b20968955ca955cafe3fc3b51305f3bf41f9/shared/src/lib/reporter/accuracy.ts).
Percentages such as 93.4% / 90.1% must therefore not be hardcoded or treated as
acceptance targets for this app.

The summary also separates book moves from move-quality categories. Compare
the same side and include the separate theory count when checking totals.

## Regression coverage

`node scripts/test-game-analysis.mjs` validates the complete fixture, the 48/47
side counts, legal best lines from the pre-move position, legal consequence
lines from the post-move position, the g6 knight-loss explanation, the severe
probability-loss rule for both colors, and protection for engine-best moves.
Existing tests retain engine-confirmed sacrifice coverage. The new regression
uses recorded scores and legal lines; it does not run a full engine analysis in
CI or assert exact timed percentages.

Physical iPhone search depth and responsiveness remain device checks. Neither
this fixture nor agreement with another program replaces chess-course editing.
