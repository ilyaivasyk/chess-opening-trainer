# Opening catalog source and verification record

The 60 course families are a **curated curriculum**, with 20 entries in each of the beginner, intermediate, and advanced groups. They are not the 20 most played openings in each group. No entries have been ranked or selected using measured game frequency, rating-band statistics, or a live Lichess Opening Explorer query.

The public [Lichess Chess Openings index](https://github.com/lichess-org/chess-openings/blob/master/README.md) (CC0) is the reference for opening family names and ECO codes. Each public catalog item links to the corresponding [A](https://github.com/lichess-org/chess-openings/blob/master/a.tsv), [B](https://github.com/lichess-org/chess-openings/blob/master/b.tsv), [C](https://github.com/lichess-org/chess-openings/blob/master/c.tsv), [D](https://github.com/lichess-org/chess-openings/blob/master/d.tsv), or [E](https://github.com/lichess-org/chess-openings/blob/master/e.tsv) source volume. This index supplies named positions and PGN move orders. It does not certify our strategic explanations or a move's engine quality.

The free courses retain their existing scenarios. Forty-nine paid courses add at least one introductory line from the standard opening family; fifteen of those add a separately named branch. The following additional branches were checked against named Lichess PGN rows:

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
