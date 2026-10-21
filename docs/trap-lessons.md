# Opening trap lessons — v54 verification

There is one interactive trap lesson in each of the 11 public courses. Each uses
published positions with original Ukrainian and English explanations and visible
source links. It is a selected teaching example, not an exhaustive trap database.

## Interaction

1. Show the opponent's mistake from its original position.
2. Find the selected punishment. The opponent replies automatically.
3. Switch sides and find a safe move from before the mistake.

Other legal moves are called alternatives outside the lesson line, not errors.
The solution can replay automatically, pause, or step in either direction. Changing
phase or leaving the screen cancels its timer. Lessons do not write game history
or course progress. Conditional replies are labelled illustrative continuations.

## Chess verification

Every SAN move replays strictly with chess.js. The exact shipped Stockfish 19 lite
single build checked the before/after positions, selected punishment and safe
first move at depth 18, without a strength handicap. Scores below are White's
point of view; mate/material outcomes refer to the shown continuation.

| Course | Opponent mistake | Before | After mistake | Demonstrated outcome |
|---|---|---:|---:|---|
| italian | Bxd1 | +2.22 | mate | mate |
| london | Ne4 | +0.54 | +3.54 | +2 net material |
| queens-gambit | cxb5 | +1.97 | +4.65 | +2 net material |
| caro-kann | Ngf6 | +0.33 | mate | mate |
| qgd | Nxd5 | +0.34 | -4.68 | +2 net material |
| ruy-lopez | Qxd4 | +0.05 | -3.12 | +1 net material |
| sicilian | h3 | +0.22 | -4.29 | mate |
| english | e4 | +0.21 | +3.92 | +2 net material |
| kings-indian | Ne2 | -0.16 | -3.39 | +2 net material |
| nimzo-indian | O-O | +0.09 | +5.40 | +2 net material |
| grunfeld | c6 | +0.56 | +4.25 | +2 net material |

The Queen's Gambit safe line was corrected to `e6 Bxc4 Nf6` after engine testing:
`e6 Bxc4 cxb5` reopened the same queen-diagonal tactic. Avoiding a trap does not
promise an equal position. The Ruy Lopez example wins one additional net material
point from before the mistake; its later bishop-for-pawn exchange is worth two.
The Sicilian mating line depends on the illustrated `Nxd4` reply.

Reproducible data checks: `node scripts/test-traps.mjs`. Existing course validation
and the release's public-content boundary checks also run in CI. Source links are
stored beside each lesson in `src/data/traps.json`.

The editorial review used the required codex-seo profile pinned at
`9a4a0b9e3c44eec2ceedcc21d10659427ee3bc1c`; it checked wording and rendered UK/EN
lessons, not measured search traffic. This is not an independent FIDE trainer
certification. Physical iPhone/Safari/VoiceOver checks remain unverified.
