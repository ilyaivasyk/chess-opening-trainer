import { Chess } from 'chess.js'
import type { Course, CourseScenario, CourseTheory } from '../data/courses'

const english: Record<string, { name: string; theory: CourseTheory; variants: string[] }> = {
  italian: {
    name: 'Italian Game',
    theory: {
      history: 'The Italian Game is listed in the Lichess opening index under the C50 family.',
      summary: 'The Italian Game begins 1.e4 e5 2.Nf3 Nc6 3.Bc4. White develops the kingside quickly, prepares to castle, and points the bishop at f7. Both sides must keep an eye on the central pawn breaks.',
      whiteGoals: ['Develop the knight and bishop, then castle.', 'Keep pressure on f7 without attacking before the pieces are ready.', 'Prepare c3 and d4, or build slowly with d3, Re1, and Nbd2-f1-g3.', 'After development, fight for the center or seek kingside play.'],
      blackGoals: ['Protect the e5 pawn while developing pieces.', 'Castle and reduce the bishop’s pressure on f7.', 'Prepare the central break ...d5 when it is tactically safe.', 'Consider ...a6 and ...b5 for space, or ...Be6 to challenge the bishop on c4.'],
      keySquares: [{ square: 'f7', idea: 'The bishop on c4 attacks this square; only the king initially protects it.' }, { square: 'd5', idea: 'A central break for Black and a square White tries to control.' }, { square: 'e5', idea: 'Black’s central pawn and an early target of the knight on f3.' }, { square: 'f5', idea: 'A possible outpost for White’s knight after Nbd2-f1-g3.' }],
      warning: 'An attack on f7 needs calculation. Watch for a central reply with ...d5.',
    },
    variants: ['All variations', 'Giuoco Pianissimo', 'Two Knights Defense', 'Giuoco Piano', 'Evans Gambit', 'Hungarian Defense', 'Fried Liver Attack', 'Lolli Attack', 'Traxler Counterattack', 'Max Lange Attack', 'Deutz Gambit'],
  },
  london: {
    name: 'London System',
    theory: {
      history: 'Lichess indexes the London System in the D02 opening family.',
      summary: 'White develops the bishop to f4 before playing e3 and usually keeps a solid d4 pawn.',
      whiteGoals: ['Develop the bishop to f4 before e3.', 'Use a knight on e5 when it has support.', 'Prepare c3, Bd3, Nbd2, and castling while watching Black’s play.'],
      blackGoals: ['Challenge d4 with ...c5 and ...Nc6.', 'Keep White from placing a knight on e5 for free.', 'Develop the c8 bishop before the pawn structure restricts it.'],
      keySquares: [{ square: 'e5', idea: 'A possible outpost for a white knight.' }, { square: 'c5', idea: 'A common square for Black’s pawn break.' }],
      warning: 'Check Black’s threats before repeating the same setup.',
    },
    variants: ['All variations', 'Main setup', 'Early ...c5', 'Against ...g6', 'Jobava London', 'Symmetric ...Bf5', 'Early ...Qb6', "Queen's Indian setup", 'Slav setup', 'Dutch setup', 'Anti-London ...Nh5'],
  },
  'queens-gambit': {
    name: "Queen's Gambit",
    theory: {
      history: "Lichess groups Queen's Gambit positions in the D06 opening family.",
      summary: 'After 1.d4 d5 2.c4, White challenges the pawn on d5 with a flank pawn.',
      whiteGoals: ['Build a stronger pawn presence in the center.', 'Develop knights and the c1 bishop quickly.', 'If Black captures on c4, recover the pawn when development permits.'],
      blackGoals: ['Support the center with ...e6 or ...c6.', 'Seek a timely ...c5 break.', 'Avoid spending too many moves trying to hold the c4 pawn.'],
      keySquares: [{ square: 'd5', idea: 'The central pawn White attacks.' }, { square: 'c4', idea: 'The pawn Black may capture.' }],
      warning: 'Do not spend too many moves chasing the c4 pawn while your pieces stay undeveloped.',
    },
    variants: ['All variations', 'Queen’s Gambit Declined', 'Queen’s Gambit Accepted', 'Slav Defense', 'Albin Countergambit', 'Chigorin Defense', 'Semi-Slav Defense', 'Tarrasch Defense', 'Baltic Defense', 'Marshall Defense', 'Austrian Defense'],
  },
  'caro-kann': {
    name: 'Caro-Kann Defense',
    theory: {
      history: 'Lichess indexes the Caro-Kann Defense in the B10 opening family.',
      summary: 'After 1.e4 c6, Black prepares ...d5 and often develops the light-squared bishop before ...e6.',
      whiteGoals: ['Use space in the Advance Variation.', 'Develop pieces promptly after central exchanges.', 'Watch Black’s ...c5 break against the center.'],
      blackGoals: ['Challenge the center with ...c5 or ...e5.', 'Develop the c8 bishop before locking it in.', 'Complete development without weakening the king.'],
      keySquares: [{ square: 'd5', idea: 'Black’s first central challenge.' }, { square: 'e5', idea: 'A white pawn may gain space here.' }],
      warning: 'Black needs active counterplay; a solid pawn structure alone is insufficient.',
    },
    variants: ['All variations', 'Advance Variation', 'Classical Variation', 'Exchange Variation', 'Panov Attack', 'Fantasy Variation', 'Two Knights Variation', 'Karpov Variation', 'Tal Attack', 'Short Variation', 'Gurgenidze Variation'],
  },
  qgd: {
    name: "Queen's Gambit Declined",
    theory: {
      history: 'Lichess indexes the Queen’s Gambit Declined in the D30 opening family.',
      summary: 'Black supports d5 with ...e6, accepting a temporarily blocked c8 bishop.',
      whiteGoals: ['Increase pressure on d5.', 'Use Bg5 to pin the f6 knight when useful.', 'Choose a central e4 plan or a queenside minority attack after the relevant exchanges.'],
      blackGoals: ['Finish development and seek ...c5.', 'Find a route for the c8 bishop.', 'Avoid creating a weakness on c6 without a concrete reason.'],
      keySquares: [{ square: 'd5', idea: 'The central pawn both sides fight over.' }, { square: 'c5', idea: 'Black’s main freeing pawn break.' }],
      warning: 'If Black delays the central break for too long, White can gain space.',
    },
    variants: ['All variations', 'Orthodox Defense', 'Exchange Structure', 'Tartakower Variation', 'Cambridge Springs', 'Tarrasch Defense', 'Semi-Tarrasch', 'Ragozin Defense', 'Vienna Variation', 'Lasker Defense', 'Harrwitz Attack'],
  },
  'ruy-lopez': {
    name: 'Ruy Lopez',
    theory: {
      history: 'Lichess indexes the Ruy Lopez in the C60 opening family.',
      summary: 'After 1.e4 e5 2.Nf3 Nc6 3.Bb5, White attacks the knight that protects e5.',
      whiteGoals: ['Build pressure on e5.', 'Prepare c3 and d4.', 'Keep the bishop active as Black gains queenside space.'],
      blackGoals: ['Gain queenside space with ...a6 and ...b5.', 'Prepare the central ...d5 break.', 'Use active piece play in the Berlin Defense.'],
      keySquares: [{ square: 'e5', idea: 'The pawn White indirectly pressures.' }, { square: 'd5', idea: 'A freeing break for Black.' }],
      warning: 'Do not assume Bxc6 wins e5; calculate Black’s reply.',
    },
    variants: ['All variations', 'Closed Ruy Lopez', 'Berlin Defense', 'Exchange Variation', 'Open Ruy Lopez', 'Marshall Attack', 'Arkhangelsk Variation', 'Schliemann Gambit', 'Steinitz Defense', 'Bird Defense', 'Classical Cordel Defense'],
  },
  sicilian: {
    name: 'Sicilian Defense',
    theory: {
      history: 'Lichess indexes the Sicilian Defense in the B20 opening family.',
      summary: 'After 1.e4 c5, Black attacks d4 from the flank and creates an asymmetric center.',
      whiteGoals: ['Open the center with d4 when prepared.', 'Develop pieces quickly.', 'Use kingside space before Black completes queenside counterplay.'],
      blackGoals: ['Use the half-open c-file after ...cxd4.', 'Look for a safe moment to play ...d5.', 'Create queenside counterplay while keeping the king safe.'],
      keySquares: [{ square: 'd5', idea: 'A key central break for Black.' }, { square: 'c3', idea: 'A common home for White’s queenside knight.' }],
      warning: 'Castle and develop before starting a flank attack.',
    },
    variants: ['All variations', 'Najdorf Variation', 'Dragon Variation', 'Classical Variation', 'Scheveningen Variation', 'Sveshnikov Variation', 'Accelerated Dragon', 'Kan Variation', 'Taimanov Variation', 'Closed Sicilian', 'Alapin Variation'],
  },
  english: {
    name: 'English Opening',
    theory: {
      history: 'Lichess indexes the English Opening in the A10 opening family.',
      summary: 'With 1.c4, White controls d5 from the flank and keeps the center flexible.',
      whiteGoals: ['Develop the knights and the bishop on g2.', 'Pressure d5 before fixing the pawn structure.'],
      blackGoals: ['Choose ...e5 or a symmetrical ...c5 setup.', 'Challenge White before an easy d4 advance.'],
      keySquares: [{ square: 'd5', idea: 'The c4 pawn controls this square.' }, { square: 'e5', idea: 'A frequent central pawn square for Black.' }],
      warning: 'Move order matters after ...d5; check the c-pawn exchange.',
    },
    variants: ['All variations', 'Reversed Sicilian Structure', 'Symmetrical Setup'],
  },
  'kings-indian': {
    name: "King's Indian Defense",
    theory: {
      history: 'Lichess indexes the King’s Indian Defense in the E60 opening family.',
      summary: 'Black allows a broad white center, then attacks it with ...e5 or ...c5.',
      whiteGoals: ['Use the extra central space.', 'Advance on the queenside when the center closes.', 'Prepare for Black’s ...f5 attack.'],
      blackGoals: ['Strike at the center with ...e5 or ...c5.', 'Coordinate kingside piece play with the fianchetto bishop.', 'Act before White consolidates the space advantage.'],
      keySquares: [{ square: 'e5', idea: 'A central pawn break for Black.' }, { square: 'f5', idea: 'A common attacking pawn break.' }],
      warning: 'A closed center can make attacks on opposite wings faster.',
    },
    variants: ['All variations', 'Classical Variation', 'Sämisch Variation', 'Fianchetto Variation', 'Averbakh Variation', 'Four Pawns Attack', 'Petrosian Variation', 'Makogonov Variation', 'Gligorić System', 'Bayonet Attack', 'Orthodox ...Nbd7'],
  },
  'nimzo-indian': {
    name: 'Nimzo-Indian Defense',
    theory: {
      history: 'Lichess indexes the Nimzo-Indian Defense in the E20 opening family.',
      summary: 'After 1.d4 Nf6 2.c4 e6 3.Nc3 Bb4, Black pins the c3 knight and contests e4.',
      whiteGoals: ['Use the bishop pair if Black exchanges on c3.', 'Build a strong center.', 'Protect weak pawns before Black attacks them.'],
      blackGoals: ['Control e4 with pieces.', 'Create structural targets after ...Bxc3.', 'Attack the center with ...d5 or ...c5.'],
      keySquares: [{ square: 'e4', idea: 'The central square Black contests.' }, { square: 'c3', idea: 'The pinned knight can be exchanged.' }],
      warning: 'The bishop pair has value only if White can manage the pawn structure.',
    },
    variants: ['All variations', 'Rubinstein Variation', 'Classical Variation', 'Sämisch Variation', 'Three Knights Variation', 'Leningrad Variation', 'Kmoch Variation', 'Spielmann Variation', 'Romanishin Variation', 'Hübner Variation', 'Zurich Variation'],
  },
  grunfeld: {
    name: 'Grünfeld Defense',
    theory: {
      history: 'Lichess indexes the Grünfeld Defense in the D70 opening family.',
      summary: 'After 1.d4 Nf6 2.c4 g6 3.Nc3 d5, Black attacks the white center with pieces and pawn breaks.',
      whiteGoals: ['Build a d4/e4 pawn center.', 'Support it with developed pieces against ...c5.'],
      blackGoals: ['Pressure d4 along the g7 diagonal.', 'Prepare ...c5 against the white center.'],
      keySquares: [{ square: 'd4', idea: 'Black’s central target.' }, { square: 'c5', idea: 'A common undermining pawn break.' }],
      warning: 'After an exchange on d5, develop pieces to support your center.',
    },
    variants: ['All variations', 'Exchange Variation', 'Three Knights Variation'],
  },
}

const notes: Record<string, string> = {
  e2e4: 'The pawn takes central space and opens the bishop on f1.', e7e5: 'Black takes central space and opens the bishop on f8.',
  d2d4: 'The pawn takes central space and opens the bishop on c1.', d7d5: 'Black meets the center with a pawn on d5.',
  c2c4: 'The c-pawn attacks d5 from the flank.', c7c5: 'The c-pawn challenges d4 from the flank.',
  c7c6: 'Black supports a coming ...d5.', e7e6: 'Black supports d5 and opens the bishop on f8.',
  g1f3: 'The knight develops and controls central squares.', b1c3: 'The knight develops and adds central control.',
  g8f6: 'The knight develops and controls central squares.', b8c6: 'The knight develops and controls d4.',
  c1f4: 'The bishop develops before e3 closes its diagonal.', f1c4: 'The bishop develops toward f7.',
  f1b5: 'The bishop attacks the knight that protects e5.', f8b4: 'The bishop pins or pressures the c3 knight.',
  f8c5: 'The bishop develops toward f2.', c8f5: 'The bishop develops before ...e6 can restrict it.',
  c8g4: 'The bishop develops and pins the f3 knight when it is present.', c1g5: 'The bishop develops and may pin the f6 knight.',
  e1g1: 'White castles to shelter the king and activate the rook.', e8g8: 'Black castles to shelter the king and activate the rook.',
  d5c4: 'Black captures the c4 pawn and changes the center.', e4e5: 'White gains space and may push a knight from f6.',
  d5e4: 'Black exchanges a central pawn and opens lines.', e4d5: 'White exchanges the central pawn on d5.',
  c4d5: 'White exchanges the c-pawn for the d-pawn.', c6d5: 'The c-pawn recaptures on d5.',
  c6e5: 'The knight jumps to the central e5 square.', f3e5: 'The knight occupies e5 in the center.',
  f3d4: 'The knight centralizes on d4.', d4c6: 'The knight captures on c6 and changes Black’s pawn structure.',
  b5c6: 'The bishop exchanges for the knight on c6.', b4c3: 'The bishop exchanges for the knight on c3.',
  f6e4: 'The knight captures or occupies the e4 square.', f6d5: 'The knight moves to the active d5 square.',
  f6g8: 'The knight retreats and stays available for a new route.', f1e2: 'The bishop develops and clears the way to castle.',
  f8e7: 'The bishop develops and clears the way to castle.', f8g7: 'The bishop takes the long diagonal.',
  g2g3: 'White prepares to develop the bishop on g2.', g7g6: 'Black prepares to develop the bishop on g7.',
  e2e3: 'White supports d4 and opens the bishop on f1.', c2c3: 'White supports a later d4 advance.',
  d2d3: 'White supports e4 and keeps the center compact.', d7d6: 'Black supports e5 and opens the bishop on c8.',
  f2f3: 'White reinforces e4 with the f-pawn.', a2a3: 'White asks the bishop on b4 to decide where to go.',
  a7a6: 'Black asks a bishop on b5 to decide where to go.', h7h6: 'Black takes away the g5 square.',
  b7b6: 'Black prepares to develop the bishop on b7.', c6c5: 'Black attacks the pawn center with ...c5.',
  a2a4: 'White restrains ...b5 on the queenside.', a4b3: 'The bishop retreats but keeps its diagonal.',
  a5b6: 'The bishop retreats while keeping its diagonal.', b1d2: 'The knight develops without blocking the c-pawn.',
  b2b4: 'White offers the b-pawn to gain time against the bishop.', b2c3: 'The b-pawn recaptures on c3.',
  b4a5: 'The bishop retreats to a5.', b5a3: 'The knight retreats to a3.',
  b5a4: 'The bishop retreats while keeping pressure on c6.', b7b5: 'Black gains queenside space and attacks a bishop on a4.',
  b8d7: 'The knight develops and supports the f6 knight.', c1e3: 'The bishop develops and supports the center.',
  c3b5: 'The knight jumps to b5, near c7 and d6.', c3d4: 'The pawn recaptures on d4 and builds a central duo.',
  c3e4: 'The knight captures on e4 and enters the center.', c5b4: 'The bishop checks from b4.',
  c5d4: 'The c-pawn exchanges on d4.', c6b8: 'The knight retreats to b8.',
  c5a7: 'The bishop retreats to a7 and keeps the long diagonal.',
  c8e6: 'The bishop develops and controls d5.', d1c2: 'The queen supports c3 and e4.',
  d4b5: 'The knight jumps to b5 and pressures d6.', d4d5: 'White gains space by advancing the d-pawn.',
  d4c5: 'The pawn captures on c5 and changes the queenside pawn structure.',
  d4e5: 'The pawn captures on e5 and opens a diagonal.', d5d4: 'Black advances the d-pawn and gains space.',
  d7c6: 'The d-pawn recaptures on c6.', d8a5: 'The queen moves to a5 and pins or pressures c3.',
  d8d5: 'The queen recaptures on d5.', d8d6: 'The queen recaptures on d6.',
  e2f3: 'The e-pawn recaptures on f3 and opens the e-file.', e4d6: 'The knight jumps to d6.',
  e4g3: 'The knight retreats to g3.', e5d4: 'The pawn captures on d4 and opens the center.',
  e6d5: 'The e-pawn recaptures on d5.', f1d3: 'The bishop develops on an active diagonal.',
  f1e1: 'The rook moves to the e-file.', f1g2: 'The bishop develops on the long diagonal.',
  f2f4: 'White gains kingside space with the f-pawn.', f3e4: 'The f-pawn recaptures on e4.',
  f4d6: 'The bishop captures on d6.', f4g3: 'The bishop retreats to g3 and keeps its diagonal.',
  f5g6: 'The bishop retreats to g6.', f7f6: 'Black supports e5 but loosens the king’s cover.',
  f8d6: 'The bishop develops toward the center.', g4f3: 'The bishop exchanges for the f3 knight.',
  g5h4: 'The bishop retreats to h4 and keeps its pin.', a7a5: 'Black gains space on the queenside.',
  b2b3: 'White supports b2 and prepares a bishop on b2.', b4c5: 'The bishop captures on c5.',
  b5c4: 'The bishop returns to the c4 diagonal.', c1d2: 'The bishop develops to d2.',
  c3d1: 'The knight recaptures on d1.', c5f2: 'The bishop sacrifices itself on f2 with check.',
  c6d4: 'The knight captures on d4.', c6e7: 'The knight retreats to e7.',
  c8b7: 'The bishop develops on the long diagonal.', c8d7: 'The bishop develops to d7.',
  d1b3: 'The queen moves to b3 and pressures b7.', d1f3: 'The queen moves toward f7.',
  d3c4: 'The bishop captures on c4.', d5c3: 'The knight captures on c3.',
  d5f6: 'The knight returns to f6.', d7f6: 'The knight recaptures on f6.',
  d8b6: 'The queen moves to b6 and pressures b2.', d8c7: 'The queen supports the c-file.',
  d8d1: 'The queen captures on d1 and forces a queen trade.', d8e7: 'The queen recaptures on e7.',
  d8h4: 'The queen checks from h4.', e1f2: 'The king captures on f2 and leaves its starting square.',
  e3d4: 'The pawn recaptures on d4.', e4f5: 'The pawn captures on f5.',
  e4f6: 'The knight captures on f6 with check.', e5c6: 'The knight captures on c6.',
  e5f6: 'The pawn captures on f6.', e6e5: 'Black occupies e5 with the e-pawn.',
  e8f7: 'The king captures on f7 and remains in the center.', f2g1: 'The king retreats to g1.',
  f3g5: 'The knight moves toward the f7 square.', f4g5: 'The bishop moves to g5.',
  f5d7: 'The bishop retreats to d7.', f6g4: 'The knight jumps to g4.',
  f6h5: 'The knight attacks the bishop on f4.', f7e6: 'The king retreats to e6.',
  f7f5: 'Black challenges e4 with the f-pawn.', g2g4: 'White gains kingside space with g4.',
  g5e7: 'The bishop captures on e7.', g5f7: 'The knight sacrifices itself on f7.',
  h2h3: 'White takes away the g4 square.', h2h4: 'White gains kingside space with h4.',
  d5b6: 'The knight retreats to b6.',
  c5c4: 'The c-pawn advances to c4.', f8e8: 'The rook takes the e-file.',
  d3d4: 'White advances the d-pawn to challenge the center.', d2f1: 'The knight retreats to f1 for a new route.',
  f1g3: 'The knight jumps to g3.', c4b3: 'The bishop retreats to b3.',
}

const pieces: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }

function moveParts(uci: string) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' }
}

function englishScenario(scenario: CourseScenario, name: string): CourseScenario {
  const game = new Chess()
  const convert = (uci: string) => {
    const played = game.move(moveParts(uci))
    if (!played) throw new Error(`Illegal course move ${uci} in ${scenario.id}`)
    const contextual = uci === 'c5d4' && played.piece === 'b' ? 'The bishop captures on d4.'
      : uci === 'c5b4' ? (played.captured ? 'The bishop captures the b4 pawn.' : 'The bishop checks from b4.')
      : uci === 'd1f3' && played.captured ? 'The queen recaptures on f3.'
      : undefined
    return {
      title: `Play ${played.san}`,
      explanation: contextual ?? notes[uci] ?? `${played.color === 'w' ? 'White' : 'Black'} moves the ${pieces[played.piece]} to ${played.to}${played.captured ? ' and captures a piece' : ''}.`,
    }
  }
  const initialExplanation = scenario.initialMove ? convert(scenario.initialMove).explanation : undefined
  const steps = scenario.steps.map((step) => {
    const user = convert(step.userMove)
    const opponent = convert(step.opponentMove)
    return { userMove: step.userMove, title: user.title, explanation: user.explanation, opponentMove: step.opponentMove, opponentExplanation: opponent.explanation }
  })
  return { ...scenario, name, initialExplanation, steps }
}

export function localizeFreeCourse(course: Course): Course {
  const localized = english[course.id]
  if (!localized) throw new Error(`Missing English course: ${course.id}`)
  const variants = course.variants.map((variant, index) => ({ ...variant, name: localized.variants[index] ?? variant.name }))
  const scenarioName = (scenario: CourseScenario) => variants.find((variant) => scenario.id.endsWith(variant.id))?.name ?? localized.name
  return {
    ...course,
    name: localized.name,
    theory: localized.theory,
    variants,
    scenarios: course.scenarios.map((scenario) => englishScenario(scenario, scenarioName(scenario))),
    blackScenarios: course.blackScenarios.map((scenario) => englishScenario(scenario, scenarioName(scenario))),
  }
}
