// Adapted from wdeloo/Brilliant-Chess, MIT, © 2025 Delo.
// Upstream commit 56e8c48696d3df874f4f1e0f26cb47bedff3231c, src/engine/stockfish.ts.
// Local changes: isolated classifier, deterministic unused commentary; no worker or UI dependencies.
// Complete permission/copyright notice: public/licenses/brilliant-chess.txt.
import { WHITE, type Color } from 'chess.js'
type moveRating = 'forced' | 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'miss' | 'blunder'
type openings = Record<string, string>
function invertColor(color: Color): Color { return color === 'w' ? 'b' : 'w' }
const COMMENTS = {
    brilliant: [
        'You found a brilliant way to sacrifice a piece.',
        'This sacrifice showcases a deep understanding of the position.',
        'A bold and exceptional sacrifice to gain a strategic edge.',
    ],
    great: [
        "You capitalized on your opponent's mistake effectively.",
        "This move takes full advantage of your opponent's error.",
        "A strong response to punish your opponent's oversight.",
    ],
    best: [
        'This has been the best move in this position.',
        'This was the most optimal move you could play here.',
        'The most precise and effective move for this scenario.',
    ],
    excellent: [
        'This was not the absolute best move, but it is just as strong.',
        'An excellent move that fits the demands of the position perfectly. It is not the best though.',
        'A top-tier choice, even if not the single best move.',
    ],
    good: [
        'This is not among the best moves, but it is still acceptable.',
        'An acceptable move, but there were better options.',
        'This move works, but it misses stronger alternatives.',
    ],
    inaccuracy: [
        'This move causes you to lose some advantage.',
        'This move weakens your overall position.',
        'An avoidable slip that leads to a worse situation.',
    ],
    blunder: [
        'This move loses significant advantage.',
        'This move significantly worsens your position.',
        'This move severely harms your position.',
    ],
    mate: [
        'Delivering checkmate is always a satisfying move.',
        'Checkmating your opponent is the ultimate goal.',
        'A decisive and final move to end the game.',
    ],
    mateIn: [
        'This is the right move to force an eventual checkmate.',
        'A precise move that guarantees a checkmate in the near future.',
        'This move sets up an unstoppable sequence to deliver checkmate.',
    ],
    delayMate: [
        'This move delays a checkmate, but your opponent is still being checkmated.',
        "You slowed down the checkmate sequence, but it's still guaranteed.",
        'A move that postpones the unavoidable checkmate you are delivering.',
    ],
    advanceMate: [
        "This decision shortens the path to your opponent's victory.",
        'You hastened the process of being checkmated with this move.',
        'This move brings your opponent closer to delivering checkmate.',
    ],
    loseAdvantage: [
        'This move causes you to lose the advantage you had.',
        'A costly error that sacrifices your winning edge.',
        'This move shifts the position from advantageous to equal or worse.',
    ],
    giveAdvantage: [
        'This move turns an equal position into a losing one.',
        'A mistake that hands the advantage to your opponent.',
        'This move creates a clear advantage for your opponent.',
    ],
    gettingMated: [
        'This move leads to an eventual forced checkmate by your opponent.',
        'A fatal error that guarantees your opponent will checkmate you.',
        'This move sets up an inevitable checkmate against you.',
    ],
    missMate: [
        'You missed an opportunity to force a checkmate, allowing your opponent to escape.',
        'A chance to secure a decisive checkmate was overlooked with this move.',
        'This move lets your opponent avoid a checkmate you could have forced.',
    ],
    missAdvantage: [
        'You missed an opportunity to gain an advantage.',
        'A key chance to improve your position was lost.',
        'This move overlooks a way to strengthen your position.',
    ],
    forced: [
        'There were no alternatives; this was the only possible move.',
        'You had no choice but to play this move.',
        'The situation left you with just one legal option, and this was it.',
    ]
}

export function classifyMove(staticEval: string[], previousStaticEvals: string[][], bestMoveSan: string, moveSan: string, fen: string, color: Color, sacrifice: boolean, previousSacrice: boolean, openings: openings): { comment: string, moveRating: moveRating } {
    if (previousStaticEvals[0] === undefined) previousStaticEvals[0] = []
    if (previousStaticEvals[1] === undefined) previousStaticEvals[1] = []
    if (previousStaticEvals[2] === undefined) previousStaticEvals[2] = []
    if (previousStaticEvals[3] === undefined) previousStaticEvals[3] = []

    const winning = Number(staticEval[1]) < 0
    const previousWinig = Number(previousStaticEvals[0][1]) > 0

    const previousColor = invertColor(color)

    function getRandomCommentNumber() {
        return 0
    }

    const commentNumber = getRandomCommentNumber()

    function getStandardRating(diff: number) {
        let rating: moveRating = 'excellent'
        if (diff >= 0.4) rating = 'good'
        if (diff >= 0.8) rating = 'inaccuracy'
        if (diff >= 4) rating = 'blunder'

        return rating
    }

    function losingGeatAdvantage(evaluation: number, previousEvaluation: number, color: Color) {
        const GREAT_ADVANTAGE = 2

        if (color === "w") {
            return previousEvaluation >= GREAT_ADVANTAGE && evaluation < GREAT_ADVANTAGE
        } else {
            return previousEvaluation <= -GREAT_ADVANTAGE && evaluation > -GREAT_ADVANTAGE
        }
    }

    function givingGeatAdvantage(evaluation: number, previousEvaluation: number, color: Color) {
        const GREAT_ADVANTAGE = -2

        if (color === "w") {
            return previousEvaluation >= GREAT_ADVANTAGE && evaluation < GREAT_ADVANTAGE
        } else {
            return previousEvaluation <= -GREAT_ADVANTAGE && evaluation > -GREAT_ADVANTAGE
        }
    }

    function keepMating(mateIn: number, previousMateIn: number, color: Color) {
        if (color === "w") {
            return mateIn < previousMateIn
        } else {
            return mateIn > previousMateIn
        }
    }

    function advanceMate(mateIn: number, previousMateIn: number, color: Color) {
        if (color === "w") {
            return mateIn > previousMateIn
        } else {
            return mateIn < previousMateIn
        }
    }

    function getPreviousStaticEvalAmount(number: number) {
        const checkColor = number % 2 === 0 ? 'b' : 'w'
        return Number(previousStaticEvals[number][1]) / 100 * (color === checkColor ? -1 : 1)
    }

    const staticEvalAmount = Number(staticEval[1]) / 100 * (color === 'w' ? -1 : 1)

    function getWasNotMateRelated(number: number) {
        return previousStaticEvals[number][0] !== 'mate' && previousStaticEvals[number + 1][0] !== 'mate'
    }

    const isNotMateRelated = staticEval[0] !== 'mate' && previousStaticEvals[0][0] !== 'mate'

    // book
    const openingName = openings[fen]
    if (openingName) return { moveRating: 'book', comment: openingName }

    // standard
    function getPreviousStandardRating(number: number) {
        return getStandardRating(getPreviousEvaluationDiff(number))
    }

    function getPreviousEvaluationDiff(number: number) {
        const checkColor = number % 2 === 0 ? 'b' : 'w'
        return color === checkColor ? getPreviousStaticEvalAmount(number + 1) - getPreviousStaticEvalAmount(number) : getPreviousStaticEvalAmount(number) - getPreviousStaticEvalAmount(number + 1)
    }

    const evaluationDiff = color === "w" ? getPreviousStaticEvalAmount(0) - staticEvalAmount : staticEvalAmount - getPreviousStaticEvalAmount(0)
    const standardRating = getStandardRating(evaluationDiff)

    const previousMistake = getWasNotMateRelated(0) && getWasNotMateRelated(1) && getPreviousStandardRating(0) === "inaccuracy" && getPreviousEvaluationDiff(0) >= 1.2 && (losingGeatAdvantage(getPreviousStaticEvalAmount(0), getPreviousStaticEvalAmount(1), previousColor) || givingGeatAdvantage(getPreviousStaticEvalAmount(0), getPreviousStaticEvalAmount(1), previousColor))
    const previousPreviousMistake = getWasNotMateRelated(1) && getWasNotMateRelated(2) && getPreviousStandardRating(1) === "inaccuracy" && getPreviousEvaluationDiff(1) >= 1.2 && (losingGeatAdvantage(getPreviousStaticEvalAmount(1), getPreviousStaticEvalAmount(2), color) || givingGeatAdvantage(getPreviousStaticEvalAmount(1), getPreviousStaticEvalAmount(2), color))

    const previousMiss =
    (
        getWasNotMateRelated(0)
        &&
        (previousPreviousMistake || getPreviousStandardRating(1) === "blunder")
        &&
        (getPreviousStandardRating(0) === "blunder" || getPreviousStandardRating(0) === "inaccuracy")
        &&
        (getPreviousEvaluationDiff(0) <= getPreviousEvaluationDiff(1) + 0.5)
    )

    // brilliant - sacrifice
    const previousBrilliant = getWasNotMateRelated(0) && previousSacrice && getPreviousStandardRating(0) === 'excellent'
    if (
        !previousBrilliant
        &&
        isNotMateRelated
        &&
        standardRating === 'excellent'
        &&
        sacrifice
        &&
        (
            getPreviousStandardRating(0) === 'inaccuracy' || getPreviousStandardRating(0) === 'blunder'
            ||
            (
                !(getPreviousStandardRating(1) === 'inaccuracy' || getPreviousStandardRating(1) === 'blunder')
                &&
                (getPreviousStandardRating(2) === 'inaccuracy' || getPreviousStandardRating(2) === 'blunder')
            )
        )
    ) return { moveRating: 'brilliant', comment: COMMENTS.brilliant[commentNumber] }

    // brilliant - start mate
    if (sacrifice && previousStaticEvals[0][0] !== 'mate' && staticEval[0] === 'mate' && winning) return { moveRating: 'brilliant', comment: COMMENTS.brilliant[commentNumber] }

    // brilliant - right move to mate
    if (sacrifice && previousStaticEvals[0][0] === 'mate' && staticEval[0] === 'mate' && keepMating(staticEvalAmount, getPreviousStaticEvalAmount(0), color) && winning) return { moveRating: 'brilliant', comment: COMMENTS.brilliant[commentNumber] }

    // great - gaining advantage
    if (
        !previousMiss
        &&
        getWasNotMateRelated(0)
        &&
        isNotMateRelated
        &&
        standardRating === 'excellent'
        &&
        (previousMistake || getPreviousStandardRating(0) === 'blunder')
    ) return { moveRating: 'great', comment: COMMENTS.great[commentNumber] }

    // best
    const isBest = bestMoveSan === moveSan
    if (isBest && staticEval[0] === 'mate' && !staticEval[1]) return { moveRating: 'best', comment: COMMENTS.mate[commentNumber] }

    if (isBest) return { moveRating: 'best', comment: COMMENTS.best[commentNumber] }

    // excellent - mate
    if (staticEval[0] === 'mate' && !staticEval[1]) return { moveRating: 'excellent', comment: COMMENTS.mate[commentNumber] }

    // excellent - start mate
    if (previousStaticEvals[0][0] !== 'mate' && staticEval[0] === 'mate' && winning) return { moveRating: 'excellent', comment: COMMENTS.mateIn[commentNumber] }

    // excellent - right move to mate
    if (previousStaticEvals[0][0] === 'mate' && staticEval[0] === 'mate' && keepMating(staticEvalAmount, getPreviousStaticEvalAmount(0), color) && winning) return { moveRating: 'excellent', comment: COMMENTS.mateIn[commentNumber] }

    // good - delay mate
    if (previousStaticEvals[0][0] === 'mate' && staticEval[0] === 'mate' && !keepMating(staticEvalAmount, getPreviousStaticEvalAmount(0), color) && winning) return { moveRating: 'good', comment: COMMENTS.delayMate[commentNumber] }

    // good - advance mate
    if (previousStaticEvals[0][0] === 'mate' && staticEval[0] === 'mate' && advanceMate(staticEvalAmount, getPreviousStaticEvalAmount(0), color) && !winning) return { moveRating: 'good', comment: COMMENTS.advanceMate[commentNumber] }

    // miss - mate
    if (previousStaticEvals[0][0] === 'mate' && staticEval[0] !== 'mate' && previousWinig) return { moveRating: 'miss', comment: COMMENTS.missMate[commentNumber] }

    // miss - gain advantage
    if (
        !previousMiss
        &&
        isNotMateRelated
        &&
        (previousMistake || getPreviousStandardRating(0) === 'blunder')
        &&
        (standardRating === "blunder" || standardRating === "inaccuracy")
        &&
        (evaluationDiff <= getPreviousEvaluationDiff(0) + 0.5)
    ) return { moveRating: 'miss', comment: COMMENTS.missAdvantage[commentNumber] }

    // mistake - lose advantage
    if (isNotMateRelated && standardRating === "inaccuracy" && evaluationDiff >= 1.2 && losingGeatAdvantage(staticEvalAmount, getPreviousStaticEvalAmount(0), color)) return { moveRating: 'mistake', comment: COMMENTS.loseAdvantage[commentNumber] }

    // mistake - give advantage
    if (isNotMateRelated && standardRating === "inaccuracy" && evaluationDiff >= 1.2 && givingGeatAdvantage(staticEvalAmount, getPreviousStaticEvalAmount(0), color)) return { moveRating: 'mistake', comment: COMMENTS.giveAdvantage[commentNumber] }

    // mistake - mate
    if (previousStaticEvals[0][0] !== 'mate' && staticEval[0] === 'mate' && !winning && (color === WHITE ? getPreviousStaticEvalAmount(0) <= -2 : getPreviousStaticEvalAmount(0) >= 2)) return { moveRating: 'mistake', comment: COMMENTS.gettingMated[commentNumber] }

    // blunder - mate
    if (
        (previousStaticEvals[0][0] !== 'mate' && staticEval[0] === 'mate' && !winning)
        ||
        (previousStaticEvals[0][0] === 'mate' && staticEval[0] === 'mate' && !winning && previousWinig)
    ) return { moveRating: 'blunder', comment: COMMENTS.gettingMated[commentNumber] }

    return { moveRating: standardRating, comment: COMMENTS[standardRating][commentNumber] }
}
