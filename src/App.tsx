import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Chess, type Move, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { courses, getCatalog, getCourses, type Course, type Locale } from './data/courses'
import { StockfishEngine, type EngineStrength } from './stockfish'
import { getPremiumCourses, getPremiumProducts, getPremiumStatus, isNativeIOS, onPremiumStatusChange, purchasePremium, restorePurchases, type PremiumProduct } from './native/purchases'

type Mode = 'coach' | 'practice' | 'exam'
type Screen = 'home' | 'theory' | 'train' | 'rating'
type Category = 'beginner' | 'intermediate' | 'advanced'
type ColorFilter = 'all' | 'white' | 'black'
type VariantFilter = string
type PlayerColor = 'w' | 'b'
type RatingStage = 'playing' | 'between' | 'complete'
type ManualOutcome = 'resigned' | 'draw-agreed' | null
type MoveActor = 'player' | 'engine' | 'course'
type AnalysisLabel = 'brilliant' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'

type MoveQuality = {
  cpLoss: number
  accuracy: number
  winDrop: number
}

type PlacementSample = {
  color: PlayerColor
  opponent: EngineStrength
  score: number
  accuracy: number
  moves: number
  seriousErrors: number
  blunders: number
}

type RatingResult = {
  low: number
  high: number
  center: number
  games: number
  accuracy: number
  seriousErrors: number
  blunders: number
}

type GameMoveRecord = {
  ply: number
  actor: MoveActor
  color: PlayerColor
  san: string
  uci: string
  from: Square
  to: Square
  captured?: Move['captured']
  fenBefore: string
  fenAfter: string
  bookMove: boolean
  openingName: string
  openingNote?: { kind: 'f7' } | { kind: 'deviation'; stepIndex: number }
}

type MoveBadge = {
  square: Square
  symbol: string
  label: string
  tone: 'theory' | 'brilliant' | 'great' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'departure'
}

type AnalysedMove = GameMoveRecord & {
  cpLoss: number
  winDrop: number
  accuracy: number
  bestMove: string | null
  bestMoveSan: string | null
  principalVariationSan: string[]
  principalVariationFens: string[]
  principalVariationUci: string[]
  evaluationCp: number
  label: AnalysisLabel
}

type LessonStep = {
  userMove: string
  title: string
  explanation: string
  opponentMove: string
  opponentExplanation: string
}

type Scenario = {
  id: string
  name: string
  initialMove?: string
  initialExplanation?: string
  steps: LessonStep[]
}

const ui = {
  brand: { uk: 'Шаховий тренер', en: 'Chess trainer' },
  debut: { uk: 'Дебют', en: 'Debut' },
  level: { uk: 'Рівень', en: 'Level' },
  coach: { uk: 'Тренер', en: 'Coach' },
  coachDescription: { uk: 'Показує хід і пояснює кожне рішення', en: 'Shows moves and explains each choice' },
  practice: { uk: 'Практика', en: 'Practice' },
  practiceDescription: { uk: 'Ти ходиш сам, перевірка — одразу', en: 'Play on your own with instant feedback' },
  exam: { uk: 'Іспит', en: 'Exam' },
  examDescription: { uk: 'Без підказок, аналіз після дебюту', en: 'No hints; review after the opening' },
  beginner: { uk: 'Початківець', en: 'Beginner' },
  intermediate: { uk: 'Середній', en: 'Intermediate' },
  advanced: { uk: 'Досвідчений', en: 'Advanced' },
  amateur: { uk: 'Любитель', en: 'Amateur' },
  club: { uk: 'Клубний', en: 'Club' },
  strongClub: { uk: 'Сильний клубний', en: 'Strong club' },
  strong: { uk: 'Сильний', en: 'Strong' },
  maximum: { uk: 'Максимум', en: 'Maximum' },
  white: { uk: 'білі', en: 'white' },
  black: { uk: 'чорні', en: 'black' },
  brilliant: { uk: 'Блискучий', en: 'Brilliant' },
  best: { uk: 'Найкращий', en: 'Best' },
  excellent: { uk: 'Чудовий', en: 'Excellent' },
  good: { uk: 'Добрий', en: 'Good' },
  inaccuracy: { uk: 'Неточність', en: 'Inaccuracy' },
  mistake: { uk: 'Помилка', en: 'Mistake' },
  blunder: { uk: 'Груба помилка', en: 'Blunder' },
  theory: { uk: 'Теорія', en: 'Theory' },
  departure: { uk: 'Поза варіантом', en: 'Outside the line' },
  openingNimzo: { uk: 'Захист Німцовича', en: 'Nimzo-Indian Defense' },
  openingKingsIndian: { uk: 'Староіндійський захист', en: "King's Indian Defense" },
  openingSicilian: { uk: 'Сицилійський захист', en: 'Sicilian Defense' },
  openingCaroKann: { uk: 'Захист Каро — Канн', en: 'Caro-Kann Defense' },
  openingRuyLopez: { uk: 'Іспанська партія', en: 'Ruy Lopez' },
  openingQgd: { uk: 'Відхилений ферзевий гамбіт', en: "Queen's Gambit Declined" },
  openingQueenGambit: { uk: 'Ферзевий гамбіт', en: "Queen's Gambit" },
  openingLondon: { uk: 'Лондонська система', en: 'London System' },
  openingTwoKnights: { uk: 'Італійська партія: захист двох коней', en: 'Italian Game: Two Knights Defense' },
  openingPianissimo: { uk: 'Італійська партія: Джоко-Піанісимо', en: 'Italian Game: Giuoco Pianissimo' },
  openingGiuocoPiano: { uk: 'Італійська партія: Джоко-Піано', en: 'Italian Game: Giuoco Piano' },
  openingItalian: { uk: 'Італійська партія', en: 'Italian Game' },
  openingOpenKnight: { uk: 'Відкрита гра: захист конем c6', en: 'Open Game: Knight on c6' },
  openingOpen: { uk: 'Відкрита гра', en: 'Open Game' },
  openingKingPawn: { uk: 'Дебют королівського пішака', en: "King's Pawn Opening" },
  openingUnknown: { uk: 'Дебют не визначено', en: 'Opening not identified' },
  unknownError: { uk: 'невідома помилка', en: 'unknown error' },
  resignedResult: { uk: 'Ти здався. Партію завершено.', en: 'You resigned. The game is over.' },
  agreedDrawResult: { uk: 'Нічия за згодою.', en: 'Draw by agreement.' },
  blackMateResult: { uk: 'Мат. Чорні перемогли.', en: 'Checkmate. Black won.' },
  whiteMateResult: { uk: 'Мат. Білі перемогли.', en: 'Checkmate. White won.' },
  stalemateResult: { uk: 'Пат. Нічия.', en: 'Stalemate. Draw.' },
  repetitionResult: { uk: 'Триразове повторення позиції. Нічия.', en: 'Threefold repetition. Draw.' },
  materialResult: { uk: 'Недостатньо матеріалу. Нічия.', en: 'Insufficient material. Draw.' },
  drawResult: { uk: 'Нічия.', en: 'Draw.' },
  endedResult: { uk: 'Партію завершено.', en: 'The game is over.' },
  victory: { uk: 'Перемога', en: 'Victory' },
  draw: { uk: 'Нічия', en: 'Draw' },
  defeat: { uk: 'Поразка', en: 'Defeat' },
  stockfishNotStarted: { uk: 'Stockfish не запущений', en: 'Stockfish is not running' },
  f7Idea: { uk: 'Послаблено ідею дебюту: білі втратили тиск на поле f7. Перевір, чи це було виправдано.', en: 'The opening idea weakened: White lost pressure on f7. Check whether this was justified.' },
  coachStartWhite: { uk: 'Знайди підсвічений хід. Натисни фігуру, потім поле.', en: 'Find the highlighted move. Tap the piece, then the square.' },
  coachStartBlack: { uk: '{explanation} Тепер знайди відповідь чорних.', en: '{explanation} Now find Black’s reply.' },
  whiteFirstMove: { uk: 'Білі зробили перший хід.', en: 'White played the first move.' },
  ratingStartWhite: { uk: 'Перша партія: ти граєш білими. Дограй до завершення.', en: 'Game one: you play White. Finish the game.' },
  ratingStartBlack: { uk: 'Друга партія: ти граєш чорними. Stockfish робить перший хід.', en: 'Game two: you play Black. Stockfish moves first.' },
  chooseHighlighted: { uk: 'Обери одне з підсвічених полів.', en: 'Choose one of the highlighted squares.' },
  illegalMove: { uk: 'Ця фігура не може піти на це поле. Обери підсвічене поле.', en: 'This piece cannot move there. Choose a highlighted square.' },
  expectedMove: { uk: 'Відхилення від вивченого плану: очікувався хід {move}. {explanation}', en: 'Outside the learned plan: {move} was expected. {explanation}' },
  outsideExam: { uk: '↗ Це вихід із вивченого варіанта. Після партії Stockfish покаже, чи хід нормальний, чи він послабив дебютний план.', en: '↗ This leaves the learned line. After the game, Stockfish will show whether the move weakened the opening plan.' },
  outsidePractice: { uk: '↗ {move} — легальний хід, але він виходить із поточного дебютного варіанта.', en: '↗ {move} is legal, but it leaves this opening line.' },
  tryAgain: { uk: 'Спробуй інакше. Ідея зараз: {explanation}', en: 'Try another move. The idea is: {explanation}' },
  moveReturned: { uk: 'Хід повернуто. Правильний напрямок підсвічено на дошці. {explanation}', en: 'Move undone. The correct path is highlighted. {explanation}' },
  theoryFeedback: { uk: '📖 Теорія · {opening}. {explanation}', en: '📖 Theory · {opening}. {explanation}' },
  evaluatingMove: { uk: 'Оцінюємо хід…', en: 'Evaluating the move…' },
  ratingMoveError: { uk: 'Stockfish не зміг оцінити хід. Спробуй ще раз.', en: 'Stockfish could not evaluate the move. Please try again.' },
  ratingWhiteDone: { uk: 'Партію білими завершено. Для оцінки обов’язково зіграй ще одну партію чорними.', en: 'Your White game is complete. Play one more game as Black for an estimate.' },
  openingDone: { uk: 'Дебют завершено. {explanation} Тепер гра продовжується проти Stockfish.', en: 'Opening complete. {explanation} Now the game continues against Stockfish.' },
  undoFeedback: { uk: 'Хід повернуто. Правильний маршрут підсвічено. {explanation}', en: 'Move undone. The correct path is highlighted. {explanation}' },
  continueFeedback: { uk: 'Гра продовжується нестандартно проти Stockfish.', en: 'The game continues outside the opening line against Stockfish.' },
  stockfishThinking: { uk: 'Stockfish думає…', en: 'Stockfish is thinking…' },
  yourMove: { uk: 'Твій хід.', en: 'Your move.' },
  engineMoveError: { uk: 'Stockfish не зміг зробити хід. Спробуй ще раз.', en: 'Stockfish could not move. Please try again.' },
  retryEngine: { uk: 'Повторити хід Stockfish', en: 'Retry Stockfish move' },
  retryEvaluation: { uk: 'Повторити оцінювання ходу', en: 'Retry move evaluation' },
  repeatIdea: { uk: 'Повтори ідею: {explanation}', en: 'Try the idea again: {explanation}' },
  resignedFeedback: { uk: 'Ти здався. Партію завершено — тепер можна переглянути повний аналіз.', en: 'You resigned. The game is over. You can now review it.' },
  drawThinking: { uk: 'Stockfish оцінює пропозицію нічиєї…', en: 'Stockfish is considering the draw offer…' },
  drawAccepted: { uk: 'Stockfish погодився на нічию. Можна перейти до аналізу партії.', en: 'Stockfish accepted the draw. You can review the game.' },
  drawDeclined: { uk: 'Stockfish відхилив нічию: у позиції ще є помітні шанси на перемогу. Твій хід.', en: 'Stockfish declined the draw: the position still has winning chances. Your move.' },
  drawError: { uk: 'Не вдалося оцінити пропозицію. Спробуй ще раз.', en: 'Could not evaluate the draw offer. Please try again.' },
  analysisStopped: { uk: 'Не вдалося завершити аналіз.', en: 'Could not finish the review.' },
  tryReviewAgain: { uk: 'Спробувати ще раз', en: 'Try again' },
  close: { uk: 'Закрити', en: 'Close' },
  reviewProTitle: { uk: 'Вивчай більше. Аналізуй кожну партію.', en: 'Learn more. Review every game.' },
  reviewProDescription: { uk: 'Відкрий 49 додаткових дебютів і повний аналіз партій зі Stockfish.', en: 'Unlock 49 more openings and full game review with Stockfish.' },
  proBenefitCatalog: { uk: '60 дебютів для гри білими й чорними', en: '60 openings for White and Black' },
  proBenefitReview: { uk: 'Повний аналіз після кожної партії', en: 'Full review after every game' },
  proBenefitLines: { uk: 'Пояснення ходів і найкраща лінія', en: 'Move explanations and the best line' },
  yearly: { uk: 'Річна підписка', en: 'Yearly subscription' },
  monthly: { uk: 'Місячна підписка', en: 'Monthly subscription' },
  productsUnavailable: { uk: 'Підписки зараз недоступні. Спробуй ще раз пізніше.', en: 'Subscriptions are unavailable now. Please try again later.' },
  restore: { uk: 'Відновити покупки', en: 'Restore purchases' },
  iosOnly: { uk: 'Підписка доступна в застосунку для iPhone.', en: 'Subscriptions are available in the iPhone app.' },
  purchasePendingVerification: { uk: 'Покупку ще не підтверджено. Спробуй відновити її трохи пізніше.', en: 'The purchase is not verified yet. Try restoring it shortly.' },
  purchasePending: { uk: 'Покупка очікує підтвердження.', en: 'The purchase is pending approval.' },
  purchaseFailed: { uk: 'Не вдалося оформити підписку. Спробуй ще раз.', en: 'Could not complete the subscription. Please try again.' },
  noSubscription: { uk: 'Активної підписки не знайдено.', en: 'No active subscription was found.' },
  restoreFailed: { uk: 'Не вдалося відновити покупки. Спробуй ще раз.', en: 'Could not restore purchases. Please try again.' },
  lessonLoadFailed: { uk: 'Не вдалося завантажити урок. Перевір підписку та спробуй ще раз.', en: 'Could not load the lesson. Check your subscription and try again.' },
  appStoreLegal: { uk: 'Оплата й керування підпискою здійснюються через App Store.', en: 'Payment and subscription management are handled by the App Store.' },
  subscriptionRenews: { uk: 'Підписка поновлюється автоматично, доки її не скасувати в налаштуваннях Apple ID.', en: 'The subscription renews automatically until canceled in Apple ID settings.' },
  privacyPolicy: { uk: 'Політика конфіденційності', en: 'Privacy Policy' },
  termsOfUse: { uk: 'Умови використання', en: 'Terms of Use' },
  ratingRepeat: { uk: 'Повторити оцінювання', en: 'Repeat rating estimate' },
  ratingDiscover: { uk: 'Визначити мій рівень', en: 'Estimate my level' },
  ratingRepeatDetail: { uk: 'Знову зіграти білими й чорними', en: 'Play as White and Black again' },
  ratingDiscoverDetail: { uk: '2 повні партії: білими й чорними', en: '2 full games: White and Black' },
  openingTraining: { uk: 'Тренування дебютів', en: 'Opening training' },
  trainingDetail: { uk: 'Підказки, практика та іспит', en: 'Hints, practice, and exam' },
  chooseOpening: { uk: 'Обери дебют', en: 'Choose an opening' },
  catalogCount: { uk: '{free} безкоштовно · {total} у каталозі', en: '{free} free · {total} in the catalog' },
  all: { uk: 'Усі', en: 'All' },
  playWhiteFilter: { uk: 'За білих', en: 'As White' },
  playBlackFilter: { uk: 'За чорних', en: 'As Black' },
  bothColors: { uk: 'Навчання за білих і чорних', en: 'Learn as White and Black' },
  available: { uk: 'Доступно', en: 'Available' },
  sideLabel: { uk: 'Сторона в дебюті', en: 'Opening side' },
  playWhite: { uk: 'Грати білими', en: 'Play as White' },
  whitePlan: { uk: 'Будувати план дебюту', en: 'Build an opening plan' },
  playBlack: { uk: 'Грати чорними', en: 'Play as Black' },
  blackPlan: { uk: 'Вивчити правильну відповідь', en: 'Learn the right reply' },
  premiumLesson: { uk: 'Урок доступний з Дебют Pro.', en: 'This lesson is available with Debut Pro.' },
  lessonLoading: { uk: 'Завантажуємо урок…', en: 'Loading the lesson…' },
  openingSource: { uk: 'Джерело дебюту: Lichess', en: 'Opening source: Lichess' },
  viewSubscription: { uk: 'Переглянути підписку', en: 'View subscription' },
  variation: { uk: 'Варіант · {name}', en: 'Variation · {name}' },
  variantsAvailable: { uk: '{count} доступно', en: '{count} available' },
  randomVariation: { uk: '🎲 Випадковий із {count}', en: '🎲 Random from {count}' },
  mode: { uk: 'Режим', en: 'Mode' },
  surprises: { uk: 'Несподівані варіанти', en: 'Surprise variations' },
  surprisesDetail: { uk: 'Stockfish перевірятиме різними продовженнями', en: 'Stockfish will use different continuations' },
  opponentStrength: { uk: 'Сила суперника', en: 'Opponent strength' },
  strengthDetail: { uk: '{value} · рейтинг і тренування', en: '{value} · rating and training' },
  startTraining: { uk: 'Почати тренування', en: 'Start training' },
  unlockPro: { uk: 'Відкрити Дебют Pro', en: 'Unlock Debut Pro' },
  installIphone: { uk: 'На iPhone: Safari → Поділитися → На початковий екран', en: 'On iPhone: Safari → Share → Add to Home Screen' },
  back: { uk: 'Назад', en: 'Back' },
  beforeGame: { uk: 'Перед грою · {color}', en: 'Before the game · {color}' },
  skip: { uk: 'Пропустити', en: 'Skip' },
  aboutOpening: { uk: 'Про що цей дебют', en: 'About this opening' },
  blackMainPlan: { uk: 'Твій головний план за чорних: {goals}', en: 'Your main plan as Black: {goals}' },
  history: { uk: 'Про дебют', en: 'About this opening' },
  yourGoal: { uk: 'Твоя мета · {color}', en: 'Your goal · {color}' },
  opponentPlan: { uk: 'План суперника · {color}', en: 'Opponent plan · {color}' },
  keySquares: { uk: 'Ключові поля', en: 'Key squares' },
  caution: { uk: 'Не поспішай', en: 'Take your time' },
  watchWhitePlan: { uk: 'Стеж за планом білих: {white} Твоя відповідь: {black}', en: 'Watch White’s plan: {white} Your reply: {black}' },
  gameReport: { uk: 'Звіт про партію', en: 'Game report' },
  analysisFinished: { uk: 'Аналіз завершено', en: 'Review complete' },
  approximatePerformance: { uk: 'Приблизний рівень цієї партії', en: 'Approximate level for this game' },
  yourAccuracy: { uk: 'Твоя точність', en: 'Your accuracy' },
  gameFlow: { uk: 'Перебіг партії', en: 'Game progress' },
  whiteBlackAdvantage: { uk: 'перевага білих / чорних', en: 'White / Black advantage' },
  evaluationChart: { uk: 'Графік оцінки позицій', en: 'Position evaluation chart' },
  youColor: { uk: 'Ти · {color}', en: 'You · {color}' },
  stockfishLevel: { uk: 'Stockfish · {level}', en: 'Stockfish · {level}' },
  yourMoves: { uk: 'Твої ходи', en: 'Your moves' },
  viewReview: { uk: 'Дивитися аналіз', en: 'View review' },
  gameReview: { uk: 'Аналіз партії', en: 'Game review' },
  localEngine: { uk: 'Локальний Stockfish · MAX', en: 'Local Stockfish · MAX' },
  closeReview: { uk: 'Закрити аналіз', en: 'Close review' },
  reviewWorking: { uk: 'Аналізуємо партію', en: 'Reviewing the game' },
  reviewWorkingDetail: { uk: 'Stockfish перевіряє позиції та будує першу лінію.', en: 'Stockfish is checking positions and the best line.' },
  bookMove: { uk: 'Книжковий хід у цьому варіанті.', en: 'A book move in this variation.' },
  keepsEvaluation: { uk: 'Хід зберігає найкращу оцінку позиції.', en: 'This move keeps the best position evaluation.' },
  lostPawns: { uk: 'Втрачено приблизно {amount} пішака оцінки.', en: 'About {amount} pawns of evaluation lost.' },
  bestMove: { uk: 'Найкращий хід', en: 'Best move' },
  bestLine: { uk: 'Перша лінія:', en: 'Best line:' },
  replayLine: { uk: 'Переграти лінію', en: 'Replay line' },
  exitLine: { uk: 'Повернутися до партії', en: 'Return to game' },
  lineStart: { uk: 'Позиція до ходу', en: 'Position before move' },
  lineStep: { uk: 'Хід {current} із {total}', en: 'Move {current} of {total}' },
  previousLine: { uk: 'Попередній хід лінії', en: 'Previous line move' },
  nextLine: { uk: 'Наступний хід лінії', en: 'Next line move' },
  analysisBoard: { uk: 'Шахова дошка аналізу', en: 'Review chessboard' },
  positionEvaluation: { uk: 'Оцінка позиції {value}', en: 'Position evaluation {value}' },
  evaluationUnavailable: { uk: 'Оцінка для цього кроку не розрахована', en: 'Evaluation is not calculated for this step' },
  kingLost: { uk: 'Король програв', en: 'King lost' },
  kingWon: { uk: 'Король переміг', en: 'King won' },
  moveNavigation: { uk: 'Перехід між ходами', en: 'Move navigation' },
  previousMove: { uk: 'Попередній хід', en: 'Previous move' },
  nextMove: { uk: 'Наступний хід', en: 'Next move' },
  reviewUnavailable: { uk: 'Не вдалося отримати аналіз цієї партії.', en: 'Could not review this game.' },
  ratingGame: { uk: 'Оціночна партія', en: 'Rating game' },
  againstStockfish: { uk: 'Проти Stockfish · {level}', en: 'Against Stockfish · {level}' },
  restart: { uk: 'Почати знову', en: 'Start again' },
  ratingLevel: { uk: 'Суперник {level} · аналіз MAX · {color}', en: 'Opponent {level} · MAX review · {color}' },
  coachLevel: { uk: '{mode} · {color}', en: '{mode} · {color}' },
  ratingReady: { uk: 'Рівень визначено', en: 'Level estimated' },
  ratingHalfway: { uk: 'Половина оцінювання готова', en: 'Halfway through the estimate' },
  playWithoutHints: { uk: 'Грай без підказок', en: 'Play without hints' },
  middlegame: { uk: 'Мітельшпіль', en: 'Middlegame' },
  openingComplete: { uk: 'Дебют завершено', en: 'Opening complete' },
  selectMoves: { uk: 'Обирай ходи нижче або переходь кнопками назад і вперед.', en: 'Select moves below or use the back and forward buttons.' },
  ratingInstructions: { uk: 'Дограй партію до завершення. Оцінка з’явиться після двох повних партій: білими та чорними. Аналіз виконується на твоєму телефоні.', en: 'Finish the game. Your estimate appears after two full games, as White and Black. Analysis runs on your phone.' },
  examInstructions: { uk: 'Зіграй дебют самостійно. Результат побачиш після завершення.', en: 'Play the opening on your own. See the result afterward.' },
  deviationTitle: { uk: 'Відхилення від дебюту', en: 'Opening deviation' },
  deviationDetail: { uk: 'Хід залишився на дошці. За вивченим варіантом очікувався хід {from} → {to}.', en: 'Your move stays on the board. The learned line expected {from} → {to}.' },
  undoMove: { uk: 'Повернути хід', en: 'Undo move' },
  continueOutside: { uk: 'Продовжити нестандартно', en: 'Continue outside the line' },
  tryTheoryMove: { uk: 'Спробуй теоретичний хід', en: 'Try the theory move' },
  moveFromTo: { uk: 'Зроби хід із {from} на підсвічене поле {to}.', en: 'Move from {from} to the highlighted square {to}.' },
  opponentMaterial: { uk: 'Матеріал суперника', en: 'Opponent material' },
  board: { uk: 'Шахова дошка', en: 'Chessboard' },
  yourMaterial: { uk: 'Твій матеріал', en: 'Your material' },
  reviewReady: { uk: 'Аналіз готовий', en: 'Review ready' },
  gameFinished: { uk: 'Партію завершено', en: 'Game over' },
  stockfishThinkingShort: { uk: 'Stockfish думає', en: 'Stockfish thinking' },
  yourTurn: { uk: 'Твій хід', en: 'Your turn' },
  stockfishTurn: { uk: 'Хід Stockfish', en: 'Stockfish to move' },
  noHints: { uk: 'Без підказок', en: 'No hints' },
  rewindLesson: { uk: 'Повернути попередній хід і пояснення', en: 'Go back one move and explanation' },
  offerDraw: { uk: 'Запропонувати нічию', en: 'Offer draw' },
  resign: { uk: 'Здатися', en: 'Resign' },
  playBlackGame: { uk: 'Зіграти другу партію чорними', en: 'Play the second game as Black' },
  approximateRating: { uk: 'Приблизна оцінка гри', en: 'Approximate playing level' },
  ratingResults: { uk: 'Діапазон: {low}–{high}. Точність ходів: {accuracy}%. Серйозних помилок: {errors}, із них грубих: {blunders}. Завершено обидві партії: білими й чорними.', en: 'Range: {low}–{high}. Move accuracy: {accuracy}%. Serious errors: {errors}, including {blunders} blunders. Both games are complete, as White and Black.' },
  analyseWholeGame: { uk: 'Проаналізувати всю партію', en: 'Review the whole game' },
} as const

type UiKey = keyof typeof ui
function translate(locale: Locale, key: UiKey, values: Record<string, string | number> = {}) {
  let value: string = ui[key][locale]
  for (const [name, replacement] of Object.entries(values)) value = value.replaceAll(`{${name}}`, String(replacement))
  return value
}

const modes: { id: Mode; name: UiKey; description: UiKey }[] = [
  { id: 'coach', name: 'coach', description: 'coachDescription' },
  { id: 'practice', name: 'practice', description: 'practiceDescription' },
  { id: 'exam', name: 'exam', description: 'examDescription' },
]
const categories: { id: Category; name: UiKey }[] = [
  { id: 'beginner', name: 'beginner' }, { id: 'intermediate', name: 'intermediate' }, { id: 'advanced', name: 'advanced' },
]
const strengthOptions: { value: EngineStrength; label: UiKey }[] = [
  { value: 800, label: 'beginner' }, { value: 1200, label: 'amateur' },
  { value: 1600, label: 'club' }, { value: 1800, label: 'strongClub' },
  { value: 2000, label: 'strong' }, { value: 3000, label: 'maximum' },
]
const analysisLabels: AnalysisLabel[] = ['brilliant', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder']

const ratingKey = 'player-rating-v3'
const samplesKey = 'placement-pair-v3'

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || '') as T
  } catch {
    return fallback
  }
}

function winPercent(centipawns: number) {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * centipawns)) - 1)
}

function lichessMoveAccuracy(winDrop: number) {
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * winDrop) - 3.1669))
}

function gameAccuracy(moves: MoveQuality[]) {
  const arithmetic = moves.reduce((sum, move) => sum + move.accuracy, 0) / moves.length
  const harmonic = moves.length / moves.reduce((sum, move) => sum + 1 / Math.max(1, move.accuracy), 0)
  return (arithmetic + harmonic) / 2
}

function estimateRange(accuracy: number, seriousErrors: number, blunders: number, totalMoves: number, samples: PlacementSample[]) {
  let quality = accuracy < 45 ? 400
    : accuracy < 58 ? 600
      : accuracy < 70 ? 850
        : accuracy < 80 ? 1100
          : accuracy < 88 ? 1400
            : accuracy < 93 ? 1750
              : accuracy < 96 ? 2000
                : 2300

  const seriousPer40 = seriousErrors * 40 / totalMoves
  const blundersPer40 = blunders * 40 / totalMoves
  if (seriousPer40 >= 8) quality -= 100
  else if (seriousPer40 >= 6) quality -= 50
  if (blundersPer40 >= 3) quality -= 100
  else if (blundersPer40 >= 2) quality -= 50

  const averageOpponent = samples.reduce((sum, item) => sum + (item.opponent === 3000 ? 2600 : item.opponent), 0) / samples.length
  const score = samples.reduce((sum, item) => sum + item.score, 0) / samples.length
  const performance = averageOpponent + (score >= .875 ? 300 : score >= .625 ? 150 : score >= .375 ? 0 : score >= .125 ? -150 : -300)
  const center = Math.round(((quality + performance) / 2) / 50) * 50
  return { low: Math.max(100, center - 250), high: Math.min(2800, center + 250), center }
}

function moveParts(uci: string) {
  return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci[4] }
}

function scenarioVariant(scenario: Scenario) {
  if (scenario.id.includes('two-knights')) return 'two-knights'
  if (scenario.id.includes('pianissimo')) return 'pianissimo'
  return scenario.id.replace(/^(white|black)-/, '')
}

function positionKey(fen: string) {
  return fen.split(' ').slice(0, 4).join(' ')
}

function buildOpeningBook(courseList: Course[]) {
  const book = new Set<string>()
  const scenarios = courseList.flatMap((course) => [...course.scenarios, ...course.blackScenarios]) as Scenario[]
  for (const scenario of scenarios) {
    const position = new Chess()
    const add = (uci: string) => {
      book.add(`${positionKey(position.fen())}|${uci}`)
      const move = moveParts(uci)
      position.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' })
    }
    if (scenario.initialMove) add(scenario.initialMove)
    for (const step of scenario.steps) {
      add(step.userMove)
      add(step.opponentMove)
    }
  }
  return book
}

function detectOpening(moves: string[], locale: Locale) {
  const starts = (...line: string[]) => line.every((move, index) => moves[index] === move)
  if (starts('d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4')) return translate(locale, 'openingNimzo')
  if (starts('d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7')) return translate(locale, 'openingKingsIndian')
  if (starts('e2e4', 'c7c5')) return translate(locale, 'openingSicilian')
  if (starts('e2e4', 'c7c6')) return translate(locale, 'openingCaroKann')
  if (starts('e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5')) return translate(locale, 'openingRuyLopez')
  if (starts('d2d4', 'd7d5', 'c2c4', 'e7e6')) return translate(locale, 'openingQgd')
  if (starts('d2d4', 'd7d5', 'c2c4')) return translate(locale, 'openingQueenGambit')
  if (starts('d2d4', 'd7d5', 'g1f3', 'g8f6', 'c1f4') || starts('d2d4', 'g8f6', 'g1f3', 'd7d5', 'c1f4')) return translate(locale, 'openingLondon')
  if (starts('e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6')) return translate(locale, 'openingTwoKnights')
  if (starts('e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5')) {
    if (moves.includes('c2c3') && moves.includes('d2d3')) return translate(locale, 'openingPianissimo')
    return translate(locale, 'openingGiuocoPiano')
  }
  if (starts('e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4')) return translate(locale, 'openingItalian')
  if (starts('e2e4', 'e7e5', 'g1f3', 'b8c6')) return translate(locale, 'openingOpenKnight')
  if (starts('e2e4', 'e7e5')) return translate(locale, 'openingOpen')
  if (starts('e2e4')) return translate(locale, 'openingKingPawn')
  return translate(locale, 'openingUnknown')
}

function badgeForAnalysis(move: AnalysedMove, locale: Locale): MoveBadge {
  if (move.bookMove) return { square: move.to, symbol: '📖', label: translate(locale, 'theory'), tone: 'theory' }
  const badges: Record<AnalysedMove['label'], Omit<MoveBadge, 'square'>> = {
    brilliant: { symbol: '!!', label: translate(locale, 'brilliant'), tone: 'brilliant' },
    best: { symbol: '★', label: translate(locale, 'best'), tone: 'great' },
    excellent: { symbol: '!', label: translate(locale, 'excellent'), tone: 'great' },
    good: { symbol: '✓', label: translate(locale, 'good'), tone: 'good' },
    inaccuracy: { symbol: '?!', label: translate(locale, 'inaccuracy'), tone: 'inaccuracy' },
    mistake: { symbol: '?', label: translate(locale, 'mistake'), tone: 'mistake' },
    blunder: { symbol: '??', label: translate(locale, 'blunder'), tone: 'blunder' },
  }
  return { square: move.to, ...badges[move.label] }
}

function badgePosition(square: Square, orientation: PlayerColor): CSSProperties {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1]) - 1
  const column = orientation === 'w' ? file : 7 - file
  const row = orientation === 'w' ? 7 - rank : rank
  return { left: `${column * 12.5 + 7.5}%`, top: `${row * 12.5 + .7}%` }
}

function materialBalance(position: Chess, color: PlayerColor) {
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
  return position.board().flat().reduce((total, piece) => total + (piece ? values[piece.type] * (piece.color === color ? 1 : -1) : 0), 0)
}

function capturedMaterial(moves: { color: PlayerColor; captured?: Move['captured'] }[], capturer: PlayerColor) {
  const victim = capturer === 'w' ? 'b' : 'w'
  const symbols = victim === 'w'
    ? { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' }
    : { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' }
  const order = ['q', 'r', 'b', 'n', 'p'] as const
  const captures = moves.filter((move) => move.color === capturer && move.captured && move.captured !== 'k').map((move) => move.captured as (typeof order)[number])
  const pieces = order.flatMap((piece) => captures.filter((captured) => captured === piece).map(() => symbols[piece]))
  return { pieces }
}

function isGoodPieceSacrifice(move: GameMoveRecord, cpLoss: number, beforeScore: number, afterScore: number) {
  const before = new Chess(move.fenBefore)
  const movedPiece = before.get(move.from)
  if (!movedPiece || !['n', 'b', 'r', 'q'].includes(movedPiece.type) || cpLoss > 25 || beforeScore >= 500 || -afterScore < -150) return false
  if (before.isAttacked(move.from, move.color === 'w' ? 'b' : 'w')) return false
  const balanceBefore = materialBalance(before, move.color)
  const after = new Chess(move.fenAfter)
  return after.moves({ verbose: true })
    .filter((reply) => reply.to === move.to && Boolean(reply.captured))
    .some((reply) => {
      const line = new Chess(move.fenAfter)
      line.move(reply)
      return materialBalance(line, move.color) <= balanceBefore - 2
    })
}

function moveLabel(winDrop: number, bestMove: string | null, playedMove: string, brilliant: boolean): AnalysisLabel {
  if (brilliant) return 'brilliant'
  if (bestMove === playedMove || winDrop <= .5) return 'best'
  if (winDrop <= 2) return 'excellent'
  if (winDrop <= 5) return 'good'
  if (winDrop <= 10) return 'inaccuracy'
  if (winDrop <= 20) return 'mistake'
  return 'blunder'
}

function variationToSan(fen: string, moves: string[], limit = 6) {
  const position = new Chess(fen)
  const san: string[] = []
  for (const uci of moves.slice(0, limit)) {
    const move = moveParts(uci)
    try {
      san.push(position.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' }).san)
    } catch { break }
  }
  return san
}

function variationPositions(fen: string, moves: string[]) {
  const position = new Chess(fen)
  const positions = [fen]
  for (const uci of moves) {
    const move = moveParts(uci)
    try {
      position.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' })
      positions.push(position.fen())
    } catch { break }
  }
  return positions
}

function gamePerformance(accuracy: number, opponent: EngineStrength, score: number) {
  const quality = accuracy < 45 ? 400 : accuracy < 58 ? 600 : accuracy < 70 ? 850 : accuracy < 80 ? 1100 : accuracy < 88 ? 1400 : accuracy < 93 ? 1750 : accuracy < 96 ? 2000 : 2300
  const opponentRating = opponent === 3000 ? 2600 : opponent
  const resultRating = opponentRating + (score === 1 ? 200 : score === .5 ? 0 : -200)
  return Math.max(100, Math.min(2800, Math.round(((quality + resultRating) / 2) / 50) * 50))
}

function gameResultText(position: Chess, outcome: ManualOutcome, locale: Locale) {
  if (outcome === 'resigned') return translate(locale, 'resignedResult')
  if (outcome === 'draw-agreed') return translate(locale, 'agreedDrawResult')
  if (position.isCheckmate()) return translate(locale, position.turn() === 'w' ? 'blackMateResult' : 'whiteMateResult')
  if (position.isStalemate()) return translate(locale, 'stalemateResult')
  if (position.isThreefoldRepetition()) return translate(locale, 'repetitionResult')
  if (position.isInsufficientMaterial()) return translate(locale, 'materialResult')
  if (position.isDraw()) return translate(locale, 'drawResult')
  return translate(locale, 'endedResult')
}

function qualityClass(label: AnalysedMove['label']) {
  if (label === 'brilliant') return 'brilliant'
  if (label === 'best' || label === 'excellent') return 'great'
  if (label === 'good') return 'good'
  if (label === 'inaccuracy') return 'inaccuracy'
  if (label === 'mistake') return 'mistake'
  return 'blunder'
}

function kingSquare(position: Chess, color: PlayerColor): Square | null {
  for (const file of 'abcdefgh') {
    for (let rank = 1; rank <= 8; rank += 1) {
      const square = `${file}${rank}` as Square
      const piece = position.get(square)
      if (piece?.type === 'k' && piece.color === color) return square
    }
  }
  return null
}

function evaluationLabel(centipawns: number) {
  if (Math.abs(centipawns) >= 9000) return centipawns > 0 ? '+M' : '−M'
  const pawns = centipawns / 100
  return `${pawns >= 0 ? '+' : '−'}${Math.abs(pawns).toFixed(1)}`
}

function graphPointColor(move: AnalysedMove) {
  if (move.bookMove) return '#9b74c7'
  if (move.label === 'brilliant') return '#27b7b6'
  if (move.label === 'best' || move.label === 'excellent') return '#72b64b'
  if (move.label === 'good') return '#89a892'
  if (move.label === 'inaccuracy') return '#e5b534'
  if (move.label === 'mistake') return '#ed832f'
  return '#e04b43'
}

function App() {
  const game = useRef(new Chess())
  const engine = useRef<StockfishEngine | null>(null)
  const gameHistory = useRef<GameMoveRecord[]>([])
  const gameSession = useRef(0)
  const lastDropAt = useRef(0)
  const audioContext = useRef<AudioContext | null>(null)
  const reviewMovesRef = useRef<HTMLDivElement | null>(null)
  const [screen, setScreen] = useState<Screen>('home')
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = localStorage.getItem('locale')
    if (saved === 'uk' || saved === 'en') return saved
    return (navigator.languages[0] ?? navigator.language).toLowerCase().startsWith('uk') ? 'uk' : 'en'
  })
  const [premium, setPremium] = useState(false)
  const [premiumCourses, setPremiumCourses] = useState<Course[]>([])
  const [products, setProducts] = useState<PremiumProduct[]>([])
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [purchaseBusy, setPurchaseBusy] = useState(false)
  const [purchaseMessage, setPurchaseMessage] = useState('')
  const [category, setCategory] = useState<Category>('beginner')
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0].id)
  const [colorFilter, setColorFilter] = useState<ColorFilter>('all')
  const [variantFilter, setVariantFilter] = useState<VariantFilter>('all')
  const [mode, setMode] = useState<Mode>('coach')
  const [surprises, setSurprises] = useState(true)
  const [strength, setStrength] = useState<EngineStrength>(1200)
  const [scenario, setScenario] = useState<Scenario>(courses[0].scenarios[0])
  const [trainingColor, setTrainingColor] = useState<PlayerColor>('w')
  const [step, setStep] = useState(0)
  const [fen, setFen] = useState(game.current.fen())
  const [selected, setSelected] = useState<Square | null>(null)
  const [legalTargets, setLegalTargets] = useState<Square[]>([])
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null)
  const [moveBadge, setMoveBadge] = useState<MoveBadge | null>(null)
  const [feedback, setFeedback] = useState('')
  const [practiceCorrection, setPracticeCorrection] = useState(false)
  const [practiceDeviation, setPracticeDeviation] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [engineFailure, setEngineFailure] = useState<'rating-evaluation' | 'engine-move' | null>(null)
  const [freePlay, setFreePlay] = useState(false)
  const [manualOutcome, setManualOutcome] = useState<ManualOutcome>(null)
  const [strengthMenuOpen, setStrengthMenuOpen] = useState(false)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [analysisSummaryOpen, setAnalysisSummaryOpen] = useState(false)
  const [analysisBusy, setAnalysisBusy] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [analysisError, setAnalysisError] = useState('')
  const [analysisItems, setAnalysisItems] = useState<AnalysedMove[]>([])
  const [analysisIndex, setAnalysisIndex] = useState(0)
  const [variationPly, setVariationPly] = useState<number | null>(null)
  const [ratingMoves, setRatingMoves] = useState<MoveQuality[]>([])
  const [ratingResult, setRatingResult] = useState<RatingResult | null>(null)
  const [playerColor, setPlayerColor] = useState<PlayerColor>('w')
  const [ratingStage, setRatingStage] = useState<RatingStage>('playing')
  const t = (key: UiKey, values?: Record<string, string | number>) => translate(locale, key, values)
  const colorName = (color: PlayerColor) => t(color === 'w' ? 'white' : 'black')
  const savedRating = readJson<RatingResult | null>(ratingKey, null)
  const localizedCourses = getCourses(locale)
  const availableCourses = [...localizedCourses, ...premiumCourses]
  const catalog = getCatalog(locale)
  const selectedEntry = catalog.find((course) => course.id === selectedCourseId) ?? catalog[0]
  const selectedLesson = availableCourses.find((course) => course.id === selectedCourseId)
  const selectedCourse = selectedLesson ?? localizedCourses[0]
  const visibleCourses = catalog.filter((course) => course.category === category)
  const openingBook = useMemo(() => buildOpeningBook(availableCourses), [locale, premiumCourses])

  const activeScenario = (trainingColor === 'w' ? selectedCourse.scenarios : selectedCourse.blackScenarios).find((item) => item.id === scenario.id) ?? scenario
  const current = activeScenario.steps[step]
  const progress = Math.min(100, Math.round((step / activeScenario.steps.length) * 100))
  const hint = screen === 'train' && current && (mode === 'coach' || practiceCorrection) ? moveParts(current.userMove) : null
  const playerSide = screen === 'rating' ? playerColor : trainingColor
  const gameFinished = Boolean(manualOutcome) || game.current.isGameOver()
  const analysedMove = analysisItems[analysisIndex]
  const analysisOpeningName = analysedMove ? detectOpening(analysisItems.slice(0, analysisIndex + 1).map((item) => item.uci), locale) : ''
  const analysisOpeningNote = analysedMove?.openingNote?.kind === 'f7' ? t('f7Idea')
    : analysedMove?.openingNote?.kind === 'deviation' ? t('expectedMove', {
      move: activeScenario.steps[analysedMove.openingNote.stepIndex]?.userMove ?? '',
      explanation: activeScenario.steps[analysedMove.openingNote.stepIndex]?.explanation ?? '',
    }) : ''
  const displayedFen = analysisOpen && analysedMove
    ? variationPly === null ? analysedMove.fenAfter : analysedMove.principalVariationFens[variationPly] ?? analysedMove.fenAfter
    : fen
  const displayedBadge = analysisOpen && analysedMove
    ? variationPly === null ? badgeForAnalysis(analysedMove, locale) : null
    : moveBadge
  const displayedLastMove = analysisOpen && analysedMove
    ? variationPly === null ? { from: analysedMove.from, to: analysedMove.to }
      : variationPly > 0 ? moveParts(analysedMove.principalVariationUci[variationPly - 1]) : null
    : lastMove
  const playerAnalysis = analysisItems.filter((item) => item.color === playerSide && item.actor === 'player')
  const opponentAnalysis = analysisItems.filter((item) => item.color !== playerSide)
  const analysisAccuracy = playerAnalysis.length ? Math.round(gameAccuracy(playerAnalysis)) : 0
  const opponentAccuracy = opponentAnalysis.length ? Math.round(gameAccuracy(opponentAnalysis)) : 0
  const playerScore = manualOutcome === 'resigned' ? 0 : manualOutcome === 'draw-agreed' || game.current.isDraw() ? .5 : game.current.isCheckmate() ? (game.current.turn() === playerSide ? 0 : 1) : .5
  const performanceRating = gamePerformance(analysisAccuracy, strength, playerScore)
  const analysisCounts = Object.fromEntries(analysisLabels.map((label) => [label, playerAnalysis.filter((item) => !item.bookMove && item.label === label).length])) as Record<AnalysisLabel, number>
  const bookMoveCount = playerAnalysis.filter((item) => item.bookMove).length
  const resultTitle = t(playerScore === 1 ? 'victory' : playerScore === .5 ? 'draw' : 'defeat')
  const displayedPosition = useMemo(() => new Chess(displayedFen), [displayedFen])
  const checkedKingSquare = displayedPosition.isCheck() ? kingSquare(displayedPosition, displayedPosition.turn()) : null
  const mateLoserSquare = displayedPosition.isCheckmate() ? kingSquare(displayedPosition, displayedPosition.turn()) : null
  const mateWinnerSquare = displayedPosition.isCheckmate() ? kingSquare(displayedPosition, displayedPosition.turn() === 'w' ? 'b' : 'w') : null
  const currentEvaluation = analysedMove?.evaluationCp ?? 0
  const visibleEvaluation = variationPly === null ? currentEvaluation : null
  const evaluationWhite = visibleEvaluation === null ? 50 : Math.abs(visibleEvaluation) >= 9000 ? (visibleEvaluation > 0 ? 100 : 0) : Math.max(5, Math.min(95, winPercent(visibleEvaluation)))
  const graphPoints = analysisItems.map((item, index) => {
    const x = analysisItems.length <= 1 ? 10 : 10 + index * 300 / (analysisItems.length - 1)
    const y = 60 - Math.max(-50, Math.min(50, item.evaluationCp / 10))
    return { x, y, item }
  })
  const graphPath = graphPoints.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
  const materialMoves = analysisOpen && analysedMove ? analysisItems.slice(0, analysisIndex + (variationPly === null ? 1 : 0)) : gameHistory.current
  const variationCaptures: { color: PlayerColor; captured?: Move['captured'] }[] = []
  if (analysisOpen && analysedMove && variationPly !== null) {
    const position = new Chess(analysedMove.fenBefore)
    for (const uci of analysedMove.principalVariationUci.slice(0, variationPly)) {
      const move = moveParts(uci)
      const played = position.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' })
      variationCaptures.push({ color: played.color, captured: played.captured })
    }
  }
  const whiteCaptured = capturedMaterial([...materialMoves, ...variationCaptures], 'w')
  const blackCaptured = capturedMaterial([...materialMoves, ...variationCaptures], 'b')
  const whiteAdvantage = Math.max(0, materialBalance(displayedPosition, 'w'))
  const blackAdvantage = Math.max(0, materialBalance(displayedPosition, 'b'))
  const playerCaptured = playerSide === 'w' ? whiteCaptured : blackCaptured
  const opponentCaptured = playerSide === 'w' ? blackCaptured : whiteCaptured
  const playerMaterialAdvantage = playerSide === 'w' ? whiteAdvantage : blackAdvantage
  const opponentMaterialAdvantage = playerSide === 'w' ? blackAdvantage : whiteAdvantage

  useEffect(() => {
    engine.current = new StockfishEngine()
    return () => engine.current?.destroy()
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = locale === 'uk' ? 'Дебют — шаховий тренер' : 'Debut — Chess Trainer'
    document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')
      ?.setAttribute('content', locale === 'uk' ? 'Дебют' : 'Debut')
  }, [locale])

  useEffect(() => {
    let mounted = true
    let removeListener: (() => void) | undefined
    void getPremiumStatus().then((active) => { if (mounted) setPremium(active) }).catch(() => {})
    void getPremiumProducts().then((items) => { if (mounted) setProducts(items) }).catch(() => {})
    void onPremiumStatusChange((active) => { if (mounted) setPremium(active) }).then((remove) => {
      if (mounted) removeListener = remove
      else remove()
    }).catch(() => {})
    return () => { mounted = false; removeListener?.() }
  }, [])

  useEffect(() => {
    if (!premium) { setPremiumCourses([]); return }
    let mounted = true
    void getPremiumCourses(locale).then((items) => { if (mounted) setPremiumCourses(items) }).catch(() => {
      if (mounted) setPremiumCourses([])
    })
    return () => { mounted = false }
  }, [premium, locale])

  useEffect(() => {
    const list = reviewMovesRef.current
    const active = list?.children[analysisIndex] as HTMLElement | undefined
    if (list && active) list.scrollTo({ left: active.offsetLeft - list.clientWidth / 2 + active.clientWidth / 2 })
  }, [analysisIndex, analysisSummaryOpen, analysisOpen])

  async function changeLocale(next: Locale) {
    if (next === locale) return
    if (premium && premiumCourses.length) {
      try { setPremiumCourses(await getPremiumCourses(next)) }
      catch { setPurchaseMessage(t('lessonLoadFailed')); return }
    }
    setLocale(next)
    setFeedback('')
    setPurchaseMessage('')
    localStorage.setItem('locale', next)
  }

  async function buyPremium(productId: string) {
    setPurchaseBusy(true)
    setPurchaseMessage('')
    try {
      const result = await purchasePremium(productId)
      if (result === 'purchased') {
        const active = await getPremiumStatus()
        setPremium(active)
        if (active) setPaywallOpen(false)
        else setPurchaseMessage(t('purchasePendingVerification'))
      } else if (result === 'pending') setPurchaseMessage(t('purchasePending'))
    } catch {
      setPurchaseMessage(t('purchaseFailed'))
    } finally { setPurchaseBusy(false) }
  }

  async function restorePremium() {
    setPurchaseBusy(true)
    setPurchaseMessage('')
    try {
      const active = await restorePurchases()
      setPremium(active)
      if (active) setPaywallOpen(false)
      else setPurchaseMessage(t('noSubscription'))
    } catch {
      setPurchaseMessage(t('restoreFailed'))
    } finally { setPurchaseBusy(false) }
  }

  function restartEngine() {
    engine.current?.destroy()
    engine.current = new StockfishEngine()
  }

  function playSound(kind: 'move' | 'capture' | 'check' | 'mate') {
    try {
      const context = audioContext.current ?? new AudioContext()
      audioContext.current = context
      if (context.state === 'suspended') void context.resume()
      const notes = kind === 'mate' ? [220, 165, 110] : kind === 'check' ? [520, 690] : kind === 'capture' ? [190, 130] : [260]
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        const start = context.currentTime + index * .075
        oscillator.type = kind === 'move' ? 'sine' : 'triangle'
        oscillator.frequency.setValueAtTime(frequency, start)
        gain.gain.setValueAtTime(.0001, start)
        gain.gain.exponentialRampToValueAtTime(.12, start + .008)
        gain.gain.exponentialRampToValueAtTime(.0001, start + .085)
        oscillator.connect(gain).connect(context.destination)
        oscillator.start(start)
        oscillator.stop(start + .09)
      })
    } catch {
      // Sound is optional when iOS blocks Web Audio before a user gesture.
    }
  }

  function playMoveSound(played: Move) {
    playSound(game.current.isCheckmate() ? 'mate' : game.current.isCheck() ? 'check' : played.captured ? 'capture' : 'move')
  }

  async function analyseSafely(position: string, engineStrength: EngineStrength, moveTime: number) {
    if (!engine.current) throw new Error(t('stockfishNotStarted'))
    const activeEngine = engine.current
    try {
      return await activeEngine.analyse(position, engineStrength, moveTime)
    } catch {
      if (engine.current !== activeEngine) throw new Error('Stockfish search was stopped')
      restartEngine()
      return await engine.current!.analyse(position, engineStrength, moveTime)
    }
  }

  function resetGameState() {
    gameSession.current += 1
    restartEngine()
    gameHistory.current = []
    setSelected(null)
    setLegalTargets([])
    setLastMove(null)
    setMoveBadge(null)
    setPracticeCorrection(false)
    setPracticeDeviation(false)
    setManualOutcome(null)
    setStrengthMenuOpen(false)
    setAnalysisOpen(false)
    setAnalysisSummaryOpen(false)
    setAnalysisBusy(false)
    setAnalysisProgress(0)
    setAnalysisError('')
    setAnalysisItems([])
    setAnalysisIndex(0)
    setVariationPly(null)
    setThinking(false)
    setEngineFailure(null)
  }

  function cancelAnalysis() {
    gameSession.current += 1
    restartEngine()
    setAnalysisBusy(false)
    setAnalysisOpen(false)
    setAnalysisSummaryOpen(false)
    setVariationPly(null)
  }

  function selectAnalysisMove(index: number) {
    setAnalysisIndex(index)
    setVariationPly(null)
  }

  function stepVariation(next: number) {
    if (!analysedMove || next < 0 || next >= analysedMove.principalVariationFens.length) return
    if (variationPly !== null && next === variationPly + 1) {
      const move = moveParts(analysedMove.principalVariationUci[variationPly])
      const position = new Chess(analysedMove.principalVariationFens[variationPly])
      const played = position.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' })
      playSound(position.isCheckmate() ? 'mate' : position.isCheck() ? 'check' : played.captured ? 'capture' : 'move')
    }
    setVariationPly(next)
  }

  function recordMove(beforeFen: string, played: Move, actor: MoveActor, openingNote?: GameMoveRecord['openingNote']) {
    const uci = `${played.from}${played.to}${played.promotion ?? ''}`
    gameHistory.current.push({
      ply: gameHistory.current.length + 1,
      actor,
      color: played.color,
      san: played.san,
      uci,
      from: played.from,
      to: played.to,
      captured: played.captured,
      fenBefore: beforeFen,
      fenAfter: game.current.fen(),
      bookMove: openingBook.has(`${positionKey(beforeFen)}|${uci}`),
      openingName: detectOpening([...gameHistory.current.map((move) => move.uci), uci], locale),
      openingNote,
    })
  }

  function openingIdeaNote(beforeFen: string, afterFen: string, color: PlayerColor): GameMoveRecord['openingNote'] {
    if (color !== 'w') return undefined
    const before = new Chess(beforeFen)
    const after = new Chess(afterFen)
    if (before.isAttacked('f7', 'w') && !after.isAttacked('f7', 'w')) {
      return { kind: 'f7' }
    }
    return undefined
  }

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {}
    if (selected) styles[selected] = { boxShadow: 'inset 0 0 0 4px #efbe4d' }
    for (const square of legalTargets) styles[square] = { background: 'radial-gradient(circle, rgba(20,30,27,.38) 0 16%, transparent 18%)' }
    if (displayedLastMove) {
      styles[displayedLastMove.from] = { backgroundColor: 'rgba(236,198,85,.35)' }
      styles[displayedLastMove.to] = { backgroundColor: 'rgba(236,198,85,.35)' }
    }
    if (practiceCorrection && hint) {
      styles[hint.from] = { boxShadow: 'inset 0 0 0 5px #efbe4d' }
      styles[hint.to] = { background: 'radial-gradient(circle, rgba(239,190,77,.95) 0 24%, rgba(239,190,77,.28) 26% 48%, transparent 50%)' }
    }
    if (checkedKingSquare) styles[checkedKingSquare] = { ...styles[checkedKingSquare], boxShadow: 'inset 0 0 0 5px #e14d47', background: 'radial-gradient(circle, rgba(225,77,71,.72), rgba(139,25,28,.82))' }
    return styles
  }, [selected, legalTargets, displayedLastMove, practiceCorrection, hint, checkedKingSquare])

  function start(course = selectedCourse) {
    const source = trainingColor === 'w' ? course.scenarios : course.blackScenarios
    const allChoices = source as Scenario[]
    const choices = variantFilter === 'all' ? allChoices : allChoices.filter((item) => scenarioVariant(item) === variantFilter)
    const selectedScenario = variantFilter === 'all' || surprises ? choices[Math.floor(Math.random() * choices.length)] : choices[0]
    game.current.reset()
    resetGameState()
    setScenario(selectedScenario)
    setStep(0)
    setFen(game.current.fen())
    setFreePlay(false)
    setRatingStage('playing')
    if (trainingColor === 'b' && selectedScenario.initialMove) {
      const initial = moveParts(selectedScenario.initialMove)
      const beforeFen = game.current.fen()
      const played = game.current.move({ from: initial.from, to: initial.to, promotion: initial.promotion || 'q' })
      recordMove(beforeFen, played, 'course')
      setFen(game.current.fen())
      setLastMove({ from: played.from, to: played.to })
    }
    setFeedback(mode === 'coach'
      ? trainingColor === 'w'
        ? t('coachStartWhite')
        : t('coachStartBlack', { explanation: selectedScenario.initialExplanation ?? t('whiteFirstMove') })
      : '')
    setScreen('train')
  }

  async function beginFromMenu() {
    if (selectedEntry.access === 'premium' && !premium) {
      setPaywallOpen(true)
      return
    }
    let course = availableCourses.find((item) => item.id === selectedEntry.id)
    if (!course && selectedEntry.access === 'premium') {
      try {
        const premiumLessons = await getPremiumCourses(locale)
        setPremiumCourses(premiumLessons)
        course = premiumLessons.find((item) => item.id === selectedEntry.id)
      } catch {
        setPurchaseMessage(t('lessonLoadFailed'))
        setPaywallOpen(true)
        return
      }
    }
    if (!course) return
    if (localStorage.getItem(`theory-seen-${course.id}-${trainingColor}`)) start(course)
    else setScreen('theory')
  }

  function finishTheory() {
    localStorage.setItem(`theory-seen-${selectedCourse.id}-${trainingColor}`, '1')
    start()
  }

  function startRating(color: PlayerColor = 'w') {
    if (color === 'w') localStorage.removeItem(samplesKey)
    game.current.reset()
    resetGameState()
    setFen(game.current.fen())
    setRatingMoves([])
    setRatingResult(null)
    setFreePlay(false)
    setPlayerColor(color)
    setRatingStage('playing')
    setFeedback(t(color === 'w' ? 'ratingStartWhite' : 'ratingStartBlack'))
    setScreen('rating')
    const session = gameSession.current
    if (color === 'b') window.setTimeout(() => {
      if (session === gameSession.current) void requestEngineMove(strength, true)
    }, 0)
  }

  function chooseSquare(square: Square) {
    if (Date.now() - lastDropAt.current < 180 || analysisOpen) return
    const userColor = playerSide
    if (thinking || manualOutcome || (screen === 'rating' && ratingStage !== 'playing') || game.current.turn() !== userColor || game.current.isGameOver()) return

    if (!selected) {
      const piece = game.current.get(square)
      if (!piece || piece.color !== userColor) return
      setSelected(square)
      setLegalTargets(game.current.moves({ square, verbose: true }).map((move) => move.to))
      return
    }

    if (selected === square) {
      setSelected(null)
      setLegalTargets([])
      return
    }

    const piece = game.current.get(square)
    if (piece?.color === userColor) {
      setSelected(square)
      setLegalTargets(game.current.moves({ square, verbose: true }).map((move) => move.to))
      return
    }

    if (!legalTargets.includes(square)) {
      setFeedback(t('chooseHighlighted'))
      return
    }

    playUserMove(selected, square)
  }

  function playUserMove(from: Square, to: Square): boolean {
    const userColor = playerSide
    if (thinking || manualOutcome || analysisOpen || game.current.isGameOver() || game.current.turn() !== userColor) return false
    const piece = game.current.get(from)
    if (!piece || piece.color !== userColor) return false
    const legalMove = game.current.moves({ square: from, verbose: true }).find((move) => move.to === to)
    if (!legalMove) {
      setFeedback(t('illegalMove'))
      return false
    }

    const beforeFen = game.current.fen()
    const played = game.current.move({ from, to, promotion: legalMove.promotion || 'q' })
    playMoveSound(played)

    setSelected(null)
    setLegalTargets([])
    setLastMove({ from, to })
    setFen(game.current.fen())

    const uci = `${played.from}${played.to}${played.promotion ?? ''}`
    const isBookMove = openingBook.has(`${positionKey(beforeFen)}|${uci}`)
    if (screen === 'rating') {
      recordMove(beforeFen, played, 'player')
      void evaluateRatingMove(beforeFen, game.current.fen())
      return true
    }
    if (freePlay || !current) {
      setMoveBadge(null)
      recordMove(beforeFen, played, 'player', openingIdeaNote(beforeFen, game.current.fen(), trainingColor))
      if (game.current.isGameOver()) {
        setFeedback(gameResultText(game.current, null, locale))
        return true
      }
      void requestEngineMove()
      return true
    }

    setMoveBadge(isBookMove
      ? { square: played.to, symbol: '📖', label: t('theory'), tone: 'theory' }
      : { square: played.to, symbol: '↗', label: t('departure'), tone: 'departure' })

    if (uci !== current.userMove) {
      if (mode === 'exam') {
        recordMove(beforeFen, played, 'player', { kind: 'deviation', stepIndex: step })
        setFreePlay(true)
        setFeedback(t('outsideExam'))
        void requestEngineMove()
        return true
      }

      if (mode === 'practice') {
        recordMove(beforeFen, played, 'player', { kind: 'deviation', stepIndex: step })
        setPracticeCorrection(false)
        setPracticeDeviation(true)
        setFeedback(t('outsidePractice', { move: played.san }))
        return true
      }

      game.current.undo()
      setFen(game.current.fen())
      setLastMove(null)
      setMoveBadge(null)
      setPracticeCorrection(false)
      setFeedback(t(mode === 'coach' ? 'tryAgain' : 'moveReturned', { explanation: current.explanation }))
      return false
    }

    setPracticeCorrection(false)
    recordMove(beforeFen, played, 'player')
    if (mode !== 'exam') setFeedback(t('theoryFeedback', { opening: detectOpening(gameHistory.current.map((move) => move.uci), locale), explanation: current.explanation }))
    setThinking(true)
    const session = gameSession.current
    window.setTimeout(() => {
      if (session === gameSession.current) playCourseReply(current)
    }, mode === 'practice' ? 900 : 500)
    return true
  }

  async function evaluateRatingMove(beforeFen: string, afterFen: string) {
    if (!engine.current) return
    const session = gameSession.current
    setThinking(true)
    setEngineFailure(null)
    setFeedback(t('evaluatingMove'))
    try {
      const before = await analyseSafely(beforeFen, 3000, 360)
      const after = game.current.isThreefoldRepetition()
        ? { bestMove: null, scoreCp: 0, principalVariation: [] }
        : await analyseSafely(afterFen, 3000, 360)
      if (session !== gameSession.current) return
      const cpLoss = Math.max(0, Math.min(1000, before.scoreCp + after.scoreCp))
      const winDrop = Math.max(0, winPercent(before.scoreCp) - winPercent(-after.scoreCp))
      const quality = { cpLoss, winDrop, accuracy: lichessMoveAccuracy(winDrop) }
      const nextMoves = [...ratingMoves, quality]
      setRatingMoves(nextMoves)

      if (game.current.isGameOver()) {
        finishRating(nextMoves)
        return
      }
      await requestEngineMove(strength, true)
      if (game.current.isGameOver()) finishRating(nextMoves)
      else setFeedback('')
    } catch (error) {
      if (session !== gameSession.current) return
      setThinking(false)
      setEngineFailure('rating-evaluation')
      setFeedback(t('ratingMoveError'))
    }
  }

  function finishRating(moves = ratingMoves) {
    if (!moves.length) return
    const sample: PlacementSample = {
      color: playerColor,
      opponent: strength,
      score: game.current.isDraw() ? .5 : game.current.turn() === playerColor ? 0 : 1,
      accuracy: gameAccuracy(moves),
      moves: moves.length,
      seriousErrors: moves.filter((move) => move.winDrop >= 6 || move.cpLoss >= 100).length,
      blunders: moves.filter((move) => move.winDrop >= 12 || move.cpLoss >= 200).length,
    }
    if (playerColor === 'w') {
      localStorage.setItem(samplesKey, JSON.stringify([sample]))
      setRatingStage('between')
      setThinking(false)
      setFeedback(t('ratingWhiteDone'))
      return
    }

    const whiteSample = readJson<PlacementSample[]>(samplesKey, []).find((item) => item.color === 'w')
    const samples = whiteSample ? [whiteSample, sample] : [sample]
    const totalMoves = samples.reduce((sum, item) => sum + item.moves, 0)
    const accuracy = samples.reduce((sum, item) => sum + item.accuracy * item.moves, 0) / totalMoves
    const seriousErrors = samples.reduce((sum, item) => sum + item.seriousErrors, 0)
    const blunders = samples.reduce((sum, item) => sum + item.blunders, 0)
    const range = estimateRange(accuracy, seriousErrors, blunders, totalMoves, samples)
    const result: RatingResult = {
      ...range,
      games: samples.length,
      accuracy: Math.round(accuracy),
      seriousErrors,
      blunders,
    }
    localStorage.setItem(ratingKey, JSON.stringify(result))
    localStorage.removeItem(samplesKey)
    setRatingResult(result)
    setRatingStage('complete')
    setThinking(false)
    setFeedback('')
  }

  function playCourseReply(lesson: LessonStep) {
    const reply = moveParts(lesson.opponentMove)
    const beforeFen = game.current.fen()
    const played = game.current.move({ from: reply.from, to: reply.to, promotion: reply.promotion || 'q' })
    playMoveSound(played)
    recordMove(beforeFen, played, 'course')
    setLastMove({ from: reply.from, to: reply.to })
    setMoveBadge(null)
    setFen(game.current.fen())
    setThinking(false)

    const next = step + 1
    if (next >= activeScenario.steps.length) {
      setStep(next)
      setFreePlay(true)
      setFeedback(mode === 'exam' ? '' : t('openingDone', { explanation: lesson.opponentExplanation }))
      return
    }

    setStep(next)
    if (mode !== 'exam') setFeedback(lesson.opponentExplanation)
  }

  function undoPracticeDeviation() {
    if (mode !== 'practice' || !practiceDeviation || thinking) return
    game.current.undo()
    gameHistory.current.pop()
    setFen(game.current.fen())
    setLastMove(null)
    setMoveBadge(null)
    setPracticeDeviation(false)
    setPracticeCorrection(true)
    setSelected(null)
    setLegalTargets([])
    setFeedback(t('undoFeedback', { explanation: current?.explanation ?? '' }))
  }

  function continuePracticeDeviation() {
    if (mode !== 'practice' || !practiceDeviation || thinking) return
    setPracticeDeviation(false)
    setPracticeCorrection(false)
    setFreePlay(true)
    setFeedback(t('continueFeedback'))
    void requestEngineMove()
  }

  async function requestEngineMove(engineStrength = strength, ratingGame = false) {
    if (!engine.current || game.current.isGameOver() || manualOutcome) return
    const session = gameSession.current
    setThinking(true)
    setEngineFailure(null)
    if (ratingGame || mode !== 'exam') setFeedback(t('stockfishThinking'))
    try {
      const result = await analyseSafely(game.current.fen(), engineStrength, engineStrength >= 2000 ? 700 : 350)
      if (session !== gameSession.current || manualOutcome) return
      if (!result.bestMove && !game.current.isGameOver()) throw new Error('Stockfish returned no legal move')
      if (result.bestMove) {
        const move = moveParts(result.bestMove)
        const beforeFen = game.current.fen()
        const played = game.current.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' })
        playMoveSound(played)
        recordMove(beforeFen, played, 'engine')
        setLastMove({ from: move.from, to: move.to })
        setMoveBadge(null)
        setFen(game.current.fen())
      }
      setThinking(false)
      if (ratingGame) setFeedback(game.current.isGameOver() ? gameResultText(game.current, null, locale) : '')
      else if (game.current.isGameOver()) setFeedback(gameResultText(game.current, null, locale))
      else if (mode !== 'exam') setFeedback(t('yourMove'))
    } catch (error) {
      if (session !== gameSession.current) return
      setThinking(false)
      setEngineFailure('engine-move')
      setFeedback(t('engineMoveError'))
    }
  }

  function retryFailedEngine() {
    if (engineFailure === 'rating-evaluation') {
      const last = gameHistory.current.at(-1)
      if (last?.actor === 'player') void evaluateRatingMove(last.fenBefore, last.fenAfter)
    } else if (engineFailure === 'engine-move') void requestEngineMove(strength, screen === 'rating')
  }

  function rewindLesson() {
    if (screen !== 'train' || mode === 'exam' || freePlay || thinking || step < 1) return
    gameSession.current += 1
    game.current.undo()
    game.current.undo()
    gameHistory.current.splice(-2)
    const previousStep = step - 1
    setStep(previousStep)
    setFen(game.current.fen())
    setSelected(null)
    setLegalTargets([])
    setLastMove(null)
    setMoveBadge(null)
    setPracticeCorrection(false)
    setPracticeDeviation(false)
    setFeedback(t('repeatIdea', { explanation: activeScenario.steps[previousStep].explanation }))
  }

  function resignGame() {
    if (screen === 'rating' || !freePlay || gameFinished || thinking) return
    gameSession.current += 1
    setThinking(false)
    setSelected(null)
    setLegalTargets([])
    setManualOutcome('resigned')
    setFeedback(t('resignedFeedback'))
  }

  async function offerDraw() {
    if (screen === 'rating' || !freePlay || gameFinished || thinking || game.current.turn() !== trainingColor) return
    const session = gameSession.current
    setThinking(true)
    setFeedback(t('drawThinking'))
    try {
      const result = await analyseSafely(game.current.fen(), 3000, 300)
      if (session !== gameSession.current) return
      setThinking(false)
      if (game.current.isDraw() || Math.abs(result.scoreCp) <= 100) {
        gameSession.current += 1
        restartEngine()
        setManualOutcome('draw-agreed')
        setFeedback(t('drawAccepted'))
      } else {
        setFeedback(t('drawDeclined'))
      }
    } catch (error) {
      if (session !== gameSession.current) return
      setThinking(false)
      setFeedback(t('drawError'))
    }
  }

  async function analyseGame() {
    if (!premium) { setPaywallOpen(true); return }
    const records = [...gameHistory.current]
    if (!records.length || analysisBusy) return
    const session = gameSession.current
    setAnalysisOpen(true)
    setAnalysisSummaryOpen(false)
    setAnalysisBusy(true)
    setAnalysisProgress(0)
    setAnalysisError('')
    setAnalysisIndex(0)
    setVariationPly(null)
    setAnalysisItems([])
    setSelected(null)
    setLegalTargets([])
    const cache = new Map<string, Awaited<ReturnType<typeof analyseSafely>>>()
    const analysed: AnalysedMove[] = []
    const replay = new Chess()
    try {
      for (let index = 0; index < records.length; index += 1) {
        if (session !== gameSession.current) return
        const record = records[index]
        if (replay.fen() !== record.fenBefore) throw new Error('Recorded positions do not match')
        const recordedMove = moveParts(record.uci)
        replay.move({ from: recordedMove.from, to: recordedMove.to, promotion: recordedMove.promotion || 'q' })
        if (replay.fen() !== record.fenAfter) throw new Error('Recorded move is invalid')
        let before = cache.get(record.fenBefore)
        if (!before) {
          before = await analyseSafely(record.fenBefore, 3000, 300)
          cache.set(record.fenBefore, before)
        }
        let after = replay.isThreefoldRepetition() ? { bestMove: null, scoreCp: 0, principalVariation: [] } : cache.get(record.fenAfter)
        if (!after) {
          after = await analyseSafely(record.fenAfter, 3000, 300)
          cache.set(record.fenAfter, after)
        }
        if (session !== gameSession.current) return
        const cpLoss = Math.max(0, Math.min(1000, before.scoreCp + after.scoreCp))
        const winDrop = Math.max(0, winPercent(before.scoreCp) - winPercent(-after.scoreCp))
        const rawPrincipalVariation = before.principalVariation.length ? before.principalVariation : before.bestMove ? [before.bestMove] : []
        const positions = variationPositions(record.fenBefore, rawPrincipalVariation.slice(0, 6))
        const legalVariation = rawPrincipalVariation.slice(0, positions.length - 1)
        const bestMove = legalVariation[0] === before.bestMove ? before.bestMove : null
        let brilliant = false
        if (isGoodPieceSacrifice(record, cpLoss, before.scoreCp, after.scoreCp)) {
          const deeperBefore = await analyseSafely(record.fenBefore, 3000, 1000)
          const deeperAfter = await analyseSafely(record.fenAfter, 3000, 1000)
          if (session !== gameSession.current) return
          brilliant = Math.max(0, deeperBefore.scoreCp + deeperAfter.scoreCp) <= 35 && -deeperAfter.scoreCp >= -150
        }
        analysed.push({
          ...record,
          cpLoss,
          winDrop,
          accuracy: lichessMoveAccuracy(winDrop),
          bestMove,
          bestMoveSan: bestMove ? variationToSan(record.fenBefore, [bestMove], 1)[0] : null,
          principalVariationSan: variationToSan(record.fenBefore, legalVariation),
          principalVariationFens: positions,
          principalVariationUci: legalVariation,
          evaluationCp: new Chess(record.fenAfter).turn() === 'w' ? after.scoreCp : -after.scoreCp,
          label: moveLabel(winDrop, bestMove, record.uci, brilliant),
        })
        setAnalysisItems([...analysed])
        setAnalysisProgress(Math.round(((index + 1) / records.length) * 100))
      }
    } catch (error) {
      if (session !== gameSession.current) return
      setAnalysisError(t('analysisStopped'))
      setAnalysisItems([])
    } finally {
      if (session === gameSession.current) {
        setAnalysisBusy(false)
        if (analysed.length === records.length) setAnalysisSummaryOpen(true)
      }
    }
  }

  const languagePicker = <div className="language-picker" role="group" aria-label="Language / Мова"><button className={locale === 'uk' ? 'active' : ''} onClick={() => void changeLocale('uk')} aria-pressed={locale === 'uk'}>Українська</button><button className={locale === 'en' ? 'active' : ''} onClick={() => void changeLocale('en')} aria-pressed={locale === 'en'}>English</button></div>

  if (privacyOpen) {
    return <main className="privacy-screen"><header className="paywall-header"><button className="icon-button" onClick={() => setPrivacyOpen(false)} aria-label={t('back')}>←</button><strong>{t('privacyPolicy')}</strong><span /></header><iframe title={t('privacyPolicy')} src={`${import.meta.env.BASE_URL}privacy.html#${locale}`} /></main>
  }

  if (paywallOpen) {
    return (
      <main className="paywall-screen">
        <header className="paywall-header"><button className="icon-button" onClick={() => setPaywallOpen(false)} aria-label={t('close')}>×</button><strong>{t('debut')} Pro</strong><span /></header>
        <div className="paywall-hero"><span>♛</span><h1>{t('reviewProTitle')}</h1><p>{t('reviewProDescription')}</p></div>
        <div className="paywall-benefits"><div>♟ <span>{t('proBenefitCatalog')}</span></div><div>♜ <span>{t('proBenefitReview')}</span></div><div>♝ <span>{t('proBenefitLines')}</span></div></div>
        {isNativeIOS() ? <>
          <div className="paywall-products">
            {products.map((product) => <button key={product.id} disabled={purchaseBusy} onClick={() => void buyPremium(product.id)}><span><strong>{product.displayName}</strong><small>{t(product.id.endsWith('yearly') ? 'yearly' : 'monthly')}</small></span><b>{product.displayPrice}</b></button>)}
          </div>
          {!products.length && <p className="paywall-status">{t('productsUnavailable')}</p>}
          <button className="secondary paywall-restore" disabled={purchaseBusy} onClick={() => void restorePremium()}>{t('restore')}</button>
        </> : <p className="paywall-status">{t('iosOnly')}</p>}
        {purchaseMessage && <p className="paywall-status" role="status">{purchaseMessage}</p>}
        <p className="paywall-legal">{t('appStoreLegal')} {t('subscriptionRenews')}</p>
        <div className="paywall-links"><button onClick={() => setPrivacyOpen(true)}>{t('privacyPolicy')}</button><a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noopener noreferrer">{t('termsOfUse')}</a></div>
      </main>
    )
  }

  if (screen === 'home') {
    return (
      <main className="shell home">
        <header className="game-hero">
          <div className="brand-mark"><img src={`${import.meta.env.BASE_URL}icon-192-v4.png`} alt="" /></div>
          <div><span className="eyebrow">{t('brand')}</span><h1>{t('debut')}</h1></div>
          <div className="rating-badge"><small>{t('level')}</small><strong>{savedRating ? `≈${savedRating.center}` : '—'}</strong></div>
        </header>

        {languagePicker}

        <section className="play-menu">
          <button className="play-card rating-play" onClick={() => startRating('w')}>
            <span className="play-icon">♟</span>
            <span><strong>{t(savedRating ? 'ratingRepeat' : 'ratingDiscover')}</strong><small>{t(savedRating ? 'ratingRepeatDetail' : 'ratingDiscoverDetail')}</small></span>
            <b>→</b>
          </button>
          <div className="play-card lesson-play">
            <span className="play-icon">♜</span>
            <span><strong>{t('openingTraining')}</strong><small>{t('trainingDetail')}</small></span>
          </div>
        </section>

        <section>
          <div className="section-title">
            <h2>{t('chooseOpening')}</h2>
            <span>{t('catalogCount', { free: catalog.filter((item) => item.access === 'free').length, total: catalog.length })}</span>
          </div>
          <div className="category-tabs">
            {categories.map((item) => <button className={category === item.id ? 'active' : ''} onClick={() => {
              setCategory(item.id)
              const first = catalog.find((course) => course.category === item.id)
              if (first) setSelectedCourseId(first.id)
              setVariantFilter('all')
            }} key={item.id}><strong>{t(item.name)}</strong><small>{catalog.filter((course) => course.category === item.id).length}</small></button>)}
          </div>
          <div className="color-filter">
            {([['all', 'all'], ['white', 'playWhiteFilter'], ['black', 'playBlackFilter']] as [ColorFilter, UiKey][]).map(([id, label]) => <button className={colorFilter === id ? 'active' : ''} onClick={() => {
              setColorFilter(id)
              if (id !== 'all') setTrainingColor(id === 'white' ? 'w' : 'b')
            }} key={id}>{t(label)}</button>)}
          </div>
          <div className="opening-list">
            {visibleCourses.map((course, index) => (
              <button className={`opening-card ${selectedEntry.id === course.id ? 'active' : ''} ${course.access === 'premium' && !premium ? 'locked' : ''}`} onClick={() => { setSelectedCourseId(course.id); setVariantFilter('all') }} key={course.id}>
                <span className="opening-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="opening-copy"><strong>{course.name}</strong><small>{course.eco} · {t('bothColors')}</small></span>
                <span className={`opening-tag ${course.access === 'premium' && !premium ? 'premium-tag' : ''}`}>{course.access === 'premium' && !premium ? '♛ Pro' : t('available')}</span>
              </button>
            ))}
          </div>
          <div className={`side-choice ${colorFilter === 'all' ? '' : 'single'}`} aria-label={t('sideLabel')}>
            {colorFilter !== 'black' && <button aria-pressed={trainingColor === 'w'} className={trainingColor === 'w' ? 'active' : ''} onClick={() => { setTrainingColor('w'); setColorFilter('white') }}><span>♙</span><strong>{t('playWhite')}</strong><small>{t('whitePlan')}</small></button>}
            {colorFilter !== 'white' && <button aria-pressed={trainingColor === 'b'} className={trainingColor === 'b' ? 'active' : ''} onClick={() => { setTrainingColor('b'); setColorFilter('black') }}><span>♟</span><strong>{t('playBlack')}</strong><small>{t('blackPlan')}</small></button>}
          </div>
          {selectedEntry.access === 'premium' && !selectedLesson ? <div className="locked-preview"><strong>♛ {selectedEntry.name}</strong><span>{selectedEntry.eco} · {premium ? t('lessonLoading') : t('premiumLesson')}</span><a href={selectedEntry.source} target="_blank" rel="noopener noreferrer">{t('openingSource')} ↗</a>{!premium && <button onClick={() => setPaywallOpen(true)}>{t('viewSubscription')} →</button>}</div> : <div className="variant-filter">
              <div><strong>{t('variation', { name: selectedEntry.name })}</strong><small>{t('variantsAvailable', { count: selectedCourse.variants.length - 1 })}</small></div>
              <div className="variant-options">
                {selectedCourse.variants.map((item) => <button className={variantFilter === item.id ? 'active' : ''} onClick={() => setVariantFilter(item.id)} key={item.id}>{item.id === 'all' ? t('randomVariation', { count: selectedCourse.variants.length - 1 }) : item.name}</button>)}
              </div>
            </div>}
        </section>

        <section>
          <div className="section-title"><h2>{t('mode')}</h2></div>
          <div className="mode-grid">
            {modes.map((item, index) => (
              <button className={`mode-card ${mode === item.id ? 'selected' : ''}`} onClick={() => setMode(item.id)} key={item.id}>
                <span>{index + 1}</span><strong>{t(item.name)}</strong><small>{t(item.description)}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-card">
          <label className="switch-row">
            <span><strong>{t('surprises')}</strong><small>{t('surprisesDetail')}</small></span>
            <input type="checkbox" checked={surprises} onChange={(event) => setSurprises(event.target.checked)} />
          </label>
          <div className="strength-row">
            <span><strong>{t('opponentStrength')}</strong><small>{t('strengthDetail', { value: strength === 3000 ? t('maximum') : `≈ ${strength} Elo` })}</small></span>
            <div className="strength-picker">
              <button className="strength-trigger" aria-expanded={strengthMenuOpen} onClick={() => setStrengthMenuOpen((open) => !open)}>
                {t(strengthOptions.find((item) => item.value === strength)?.label ?? 'amateur')}
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
              </button>
              {strengthMenuOpen && <div className="strength-menu" role="listbox" aria-label={t('opponentStrength')}>
                {strengthOptions.map((item) => <button role="option" aria-selected={strength === item.value} className={strength === item.value ? 'active' : ''} onClick={() => { setStrength(item.value); setStrengthMenuOpen(false) }} key={item.value}>{t(item.label)}<small>{item.value === 3000 ? 'MAX' : `${item.value} Elo`}</small></button>)}
              </div>}
            </div>
          </div>
        </section>

        <button className="primary" onClick={() => void beginFromMenu()}>{t(selectedEntry.access === 'premium' && !premium ? 'unlockPro' : 'startTraining')} <span>→</span></button>
        {!isNativeIOS() && <p className="install-note">{t('installIphone')}</p>}
      </main>
    )
  }

  if (screen === 'theory') {
    const theory = selectedCourse.theory
    const preview = selectedCourse.scenarios.find((item) => variantFilter === 'all' || scenarioVariant(item) === variantFilter) ?? selectedCourse.scenarios[0]
    const previewMoves = preview.steps.flatMap((item) => [item.userMove, item.opponentMove])
    const previewLine = variationToSan(new Chess().fen(), previewMoves, 8).join(' ')
    return (
      <main className="shell theory-screen">
        <header className="theory-header">
          <button className="icon-button" onClick={() => setScreen('home')} aria-label={t('back')}>←</button>
          <div><span className="eyebrow">{t('beforeGame', { color: colorName(trainingColor) })}</span><h1>{selectedCourse.name}</h1></div>
          <button className="skip-button" onClick={finishTheory}>{t('skip')}</button>
        </header>
        <section className="theory-intro">
          <span className="move-sequence">{previewLine}</span>
          <h2>{t('aboutOpening')}</h2>
          <p>{trainingColor === 'w' ? theory.summary : `${theory.summary} ${t('blackMainPlan', { goals: theory.blackGoals.join(' ') })}`}</p>
        </section>
        <section className="theory-block history-block"><span>{t('history')}</span><p>{theory.history}</p></section>
        <section className="theory-columns">
          {(trainingColor === 'w' ? [
            <div className="theory-block" key="white"><span>{t('yourGoal', { color: t('white') })}</span><ul>{theory.whiteGoals.map((goal) => <li key={goal}>{goal}</li>)}</ul></div>,
            <div className="theory-block dark-goals" key="black"><span>{t('opponentPlan', { color: t('black') })}</span><ul>{theory.blackGoals.map((goal) => <li key={goal}>{goal}</li>)}</ul></div>,
          ] : [
            <div className="theory-block" key="black"><span>{t('yourGoal', { color: t('black') })}</span><ul>{theory.blackGoals.map((goal) => <li key={goal}>{goal}</li>)}</ul></div>,
            <div className="theory-block dark-goals" key="white"><span>{t('opponentPlan', { color: t('white') })}</span><ul>{theory.whiteGoals.map((goal) => <li key={goal}>{goal}</li>)}</ul></div>,
          ])}
        </section>
        <section>
          <div className="section-title"><h2>{t('keySquares')}</h2></div>
          <div className="square-guide">{theory.keySquares.map((item) => <div key={item.square}><strong>{item.square}</strong><p>{item.idea}</p></div>)}</div>
        </section>
        <section className="warning-card"><strong>{t('caution')}</strong><p>{trainingColor === 'w' ? theory.warning : t('watchWhitePlan', { white: theory.whiteGoals[0], black: theory.blackGoals[0] })}</p></section>
        <button className="primary" onClick={finishTheory}>{t('startTraining')} <span>→</span></button>
      </main>
    )
  }

  if (analysisOpen && analysisSummaryOpen && !analysisBusy && playerAnalysis.length > 0) {
    return (
      <main className="analysis-report" role="dialog" aria-modal="true" aria-labelledby="analysis-report-title">
        <header className="report-header">
          <button className="icon-button" onClick={cancelAnalysis} aria-label={t('close')}>×</button>
          <strong>{t('gameReport')}</strong>
          <span />
        </header>
        <section className={`report-result ${playerScore === 1 ? 'win' : playerScore === .5 ? 'draw' : 'loss'}`}>
          <span className="result-crown">{playerScore === 1 ? '♔' : playerScore === .5 ? '½' : '♚'}</span>
          <div><small>{t('analysisFinished')}</small><h1 id="analysis-report-title">{resultTitle}</h1><p>{gameResultText(game.current, manualOutcome, locale)}</p></div>
        </section>
        <section className="report-rating">
          <div><small>{t('approximatePerformance')}</small><strong>≈ {performanceRating}</strong></div>
          <div><small>{t('yourAccuracy')}</small><strong>{analysisAccuracy}%</strong></div>
        </section>
        <section className="evaluation-chart" aria-label={t('evaluationChart')}>
          <div className="chart-title"><strong>{t('gameFlow')}</strong><span>{t('whiteBlackAdvantage')}</span></div>
          <svg viewBox="0 0 320 120" role="img" aria-label={t('evaluationChart')}>
            <rect x="0" y="0" width="320" height="60" rx="10" fill="rgba(238,242,232,.055)" />
            <rect x="0" y="60" width="320" height="60" rx="10" fill="rgba(0,0,0,.18)" />
            <line x1="0" y1="60" x2="320" y2="60" stroke="rgba(238,242,232,.35)" strokeWidth="1" />
            {graphPath && <path d={graphPath} fill="none" stroke="#eef2e8" strokeWidth="2.5" strokeLinejoin="round" />}
            {graphPoints.map((point) => <circle key={`${point.item.ply}-${point.item.uci}`} cx={point.x} cy={point.y} r="3.5" fill={graphPointColor(point.item)} />)}
          </svg>
        </section>
        <section className="players-summary">
          <div><span className="player-piece">{playerSide === 'w' ? '♔' : '♚'}</span><small>{t('youColor', { color: colorName(playerSide) })}</small><strong>{analysisAccuracy}%</strong></div>
          <div><span className="player-piece">{playerSide === 'w' ? '♚' : '♔'}</span><small>{t('stockfishLevel', { level: strength === 3000 ? 'MAX' : strength })}</small><strong>{opponentAccuracy}%</strong></div>
        </section>
        <section className="quality-report">
          <h2>{t('yourMoves')}</h2>
          <div className="quality-summary">
            <div><span className="quality theory">📖</span><strong>{bookMoveCount}</strong><small>{t('theory')}</small></div>
            {analysisLabels.map((label) => <div key={label}><span className={`quality ${qualityClass(label)}`}>{badgeForAnalysis({ label, to: 'a1' } as AnalysedMove, locale).symbol}</span><strong>{analysisCounts[label]}</strong><small>{t(label)}</small></div>)}
          </div>
        </section>
        <button className="primary report-review-button" onClick={() => setAnalysisSummaryOpen(false)}>{t('viewReview')} <span>→</span></button>
      </main>
    )
  }

  if (analysisOpen) {
    return (
      <main className="analysis-screen">
        <header className="review-header">
          <button className="icon-button" onClick={cancelAnalysis} aria-label={t('closeReview')}>×</button>
          <div><strong>{t('gameReview')}</strong><small>{t('localEngine')}</small></div>
          <span className="evaluation-number">{analysedMove ? visibleEvaluation === null ? '—' : evaluationLabel(visibleEvaluation) : '…'}</span>
        </header>

        {analysisBusy && (
          <section className="analysis-loading">
            <span className="analysis-spinner" />
            <h1>{t('reviewWorking')}</h1>
            <p>{t('reviewWorkingDetail')}</p>
            <div className="analysis-progress"><span style={{ width: `${analysisProgress}%` }} /></div>
            <strong>{analysisProgress}%</strong>
          </section>
        )}

        {!analysisBusy && analysedMove && (
          <>
            <section className="review-commentary" aria-live="polite">
              <div className="review-title">
                <span className={`quality ${analysedMove.bookMove ? 'theory' : qualityClass(analysedMove.label)}`}>{analysedMove.bookMove ? `📖 ${t('theory')}` : `${badgeForAnalysis(analysedMove, locale).symbol} ${t(analysedMove.label)}`}</span>
                <strong>{Math.ceil(analysedMove.ply / 2)}{analysedMove.color === 'w' ? '.' : '...'} {analysedMove.san}</strong>
              </div>
              <p><b>{analysisOpeningName}.</b> {analysedMove.bookMove
                ? t('bookMove')
                : analysedMove.cpLoss <= 10
                ? t('keepsEvaluation')
                : t('lostPawns', { amount: (analysedMove.cpLoss / 100).toFixed(1) })}</p>
              {analysedMove.bestMoveSan && (
                <div className="review-best-line">
                  <span>{t('bestMove')} <strong>{analysedMove.bestMoveSan}</strong></span>
                  <p><b>{t('bestLine')}</b> {analysedMove.principalVariationSan.join(' ') || analysedMove.bestMoveSan}</p>
                </div>
              )}
              {analysedMove.principalVariationUci.length > 0 && (variationPly === null
                ? <button className="line-toggle" onClick={() => stepVariation(0)}>{t('replayLine')} →</button>
                : <div className="line-controls"><button onClick={() => stepVariation(variationPly - 1)} disabled={variationPly === 0} aria-label={t('previousLine')}>‹</button><span>{variationPly === 0 ? t('lineStart') : `${t('lineStep', { current: variationPly, total: analysedMove.principalVariationUci.length })} · ${analysedMove.principalVariationSan[variationPly - 1]}`}</span><button onClick={() => stepVariation(variationPly + 1)} disabled={variationPly >= analysedMove.principalVariationUci.length} aria-label={t('nextLine')}>›</button><button className="line-exit" onClick={() => setVariationPly(null)}>{t('exitLine')}</button></div>)}
              {analysisOpeningNote && <p className="opening-note">♟ {analysisOpeningNote}</p>}
            </section>

            <div className="material-row analysis-material opponent-material">
              <span>{t('stockfishLevel', { level: strength === 3000 ? 'MAX' : strength })} · {colorName(playerSide === 'w' ? 'b' : 'w')}</span>
              <b>{opponentCaptured.pieces.join(' ') || '—'} {opponentMaterialAdvantage > 0 ? `+${opponentMaterialAdvantage}` : ''}</b>
            </div>
            <section className="review-board-row">
              <div className={`evaluation-bar ${playerSide === 'b' ? 'black-orientation' : ''}`} aria-label={visibleEvaluation === null ? t('evaluationUnavailable') : t('positionEvaluation', { value: evaluationLabel(visibleEvaluation) })}>
                {playerSide === 'w' ? <>
                  <span className="eval-dark" style={{ height: `${100 - evaluationWhite}%` }} />
                  <span className="eval-light" style={{ height: `${evaluationWhite}%` }} />
                </> : <>
                  <span className="eval-light" style={{ height: `${evaluationWhite}%` }} />
                  <span className="eval-dark" style={{ height: `${100 - evaluationWhite}%` }} />
                </>}
                <b>{visibleEvaluation === null ? '—' : evaluationLabel(visibleEvaluation)}</b>
              </div>
              <div className="board-wrap review-board" aria-label={t('analysisBoard')}>
                <Chessboard options={{
                  id: 'analysis-board',
                  position: displayedFen,
                  boardOrientation: playerSide === 'b' ? 'black' : 'white',
                  boardStyle: { borderRadius: '8px', overflow: 'hidden' },
                  lightSquareStyle: { backgroundColor: '#d8cfb6' },
                  darkSquareStyle: { backgroundColor: '#6f8b7e' },
                  squareStyles,
                  animationDurationInMs: 120,
                  allowDrawingArrows: false,
                  canDragPiece: () => false,
                }} />
                {displayedBadge && <div className={`move-badge ${displayedBadge.tone}`} style={badgePosition(displayedBadge.square, playerSide)} aria-label={displayedBadge.label}>{displayedBadge.symbol}</div>}
                {mateLoserSquare && <div className="king-result-badge loss" style={badgePosition(mateLoserSquare, playerSide)} aria-label={t('kingLost')}>×</div>}
                {mateWinnerSquare && <div className="king-result-badge win" style={badgePosition(mateWinnerSquare, playerSide)} aria-label={t('kingWon')}>♛</div>}
              </div>
            </section>

            <div className="material-row analysis-material">
              <span>{t('youColor', { color: colorName(playerSide) })}</span>
              <b>{playerCaptured.pieces.join(' ') || '—'} {playerMaterialAdvantage > 0 ? `+${playerMaterialAdvantage}` : ''}</b>
            </div>

            <nav className="review-controls" aria-label={t('moveNavigation')}>
              <button onClick={() => selectAnalysisMove(Math.max(0, analysisIndex - 1))} disabled={analysisIndex === 0} aria-label={t('previousMove')}>‹</button>
              <div className="review-moves" ref={reviewMovesRef}>
                {analysisItems.map((item, index) => <button className={`${analysisIndex === index ? 'active' : ''} ${item.bookMove ? 'theory' : qualityClass(item.label)}`} onClick={() => selectAnalysisMove(index)} key={`${item.ply}-${item.uci}`}>{Math.ceil(item.ply / 2)}{item.color === 'w' ? '.' : '…'} {item.san}</button>)}
              </div>
              <button onClick={() => selectAnalysisMove(Math.min(analysisItems.length - 1, analysisIndex + 1))} disabled={analysisIndex >= analysisItems.length - 1} aria-label={t('nextMove')}>›</button>
            </nav>
          </>
        )}

        {!analysisBusy && !analysedMove && <div className="analysis-failure" role="alert"><p>{analysisError || t('reviewUnavailable')}</p><button className="primary" onClick={() => void analyseGame()}>{t('tryReviewAgain')} →</button></div>}
      </main>
    )
  }

  return (
      <main className="shell training">
      <header className="training-header">
        <button className="icon-button" onClick={() => setScreen('home')} aria-label={t('back')}>←</button>
        <div><strong>{screen === 'rating' ? t('ratingGame') : selectedCourse.name}</strong><small>{screen === 'rating' ? t('againstStockfish', { level: strength === 3000 ? 'MAX' : strength }) : activeScenario.name}</small></div>
        <button className="icon-button" onClick={screen === 'rating' ? () => startRating('w') : () => start()} aria-label={t('restart')}>↻</button>
        </header>

      {screen !== 'rating' && <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>}

      <section className={`coach-card ${screen !== 'rating' && mode === 'practice' ? 'practice-mode' : ''}`}>
        <span className="mode-pill">{screen === 'rating' ? t('ratingLevel', { level: strength === 3000 ? 'MAX' : strength, color: colorName(playerColor) }) : t('coachLevel', { mode: t(modes.find((item) => item.id === mode)?.name ?? 'coach'), color: colorName(trainingColor) })}</span>
        <h2>{screen === 'rating' ? (ratingResult ? t('ratingReady') : ratingStage === 'between' ? t('ratingHalfway') : t('playWithoutHints')) : gameFinished ? gameResultText(game.current, manualOutcome, locale) : freePlay ? t('middlegame') : current?.title ?? t('openingComplete')}</h2>
        <p className="feedback" aria-live="polite">{feedback || '\u00a0'}</p>
        <p className="coach-copy">
          {screen === 'rating' && ratingStage === 'playing'
            ? t('ratingInstructions')
            : screen !== 'rating' && mode === 'coach' && current && !freePlay
              ? current.explanation
              : screen !== 'rating' && mode === 'exam' && !freePlay
                ? t('examInstructions')
                : '\u00a0'}
        </p>
      </section>

      {screen === 'train' && mode === 'practice' && practiceDeviation && current && (
        <section className="practice-correction" aria-live="assertive">
          <strong>{t('deviationTitle')}</strong>
          <p>{t('deviationDetail', { from: current.userMove.slice(0, 2), to: current.userMove.slice(2, 4) })}</p>
          <small>{current.explanation}</small>
          <div className="deviation-actions">
            <button className="secondary" onClick={undoPracticeDeviation}>← {t('undoMove')}</button>
            <button className="primary" onClick={continuePracticeDeviation}>{t('continueOutside')}</button>
          </div>
        </section>
      )}

      {screen === 'train' && mode === 'practice' && practiceCorrection && current && hint && (
        <section className="practice-correction" aria-live="assertive">
          <strong>{t('tryTheoryMove')}</strong>
          <p>{t('moveFromTo', { from: hint.from, to: hint.to })}</p>
          <small>{current.explanation}</small>
        </section>
      )}

      <div className="material-row opponent-material" aria-label={t('opponentMaterial')}>
        <span>Stockfish · {colorName(playerSide === 'w' ? 'b' : 'w')}</span>
        <b>{opponentCaptured.pieces.join(' ') || '—'} {opponentMaterialAdvantage > 0 ? `+${opponentMaterialAdvantage}` : ''}</b>
      </div>

      <section className={`board-wrap ${selected ? 'piece-selected' : ''}`} aria-label={t('board')}>
        <Chessboard options={{
          id: 'training-board',
          position: displayedFen,
          boardOrientation: playerSide === 'b' ? 'black' : 'white',
          boardStyle: { borderRadius: '12px', boxShadow: '0 16px 38px rgba(0,0,0,.28)', overflow: 'hidden', touchAction: 'pan-y' },
          lightSquareStyle: { backgroundColor: '#d8cfb6' },
          darkSquareStyle: { backgroundColor: '#6f8b7e' },
          squareStyles,
          arrows: !analysisOpen && hint ? [{ startSquare: hint.from, endSquare: hint.to, color: 'rgba(239,190,77,.82)' }] : [],
          animationDurationInMs: 120,
          allowDrawingArrows: false,
          canDragPiece: ({ piece }) => {
            return !window.matchMedia('(pointer: coarse)').matches && !analysisOpen && !thinking && !gameFinished && (screen !== 'rating' || ratingStage === 'playing') && game.current.turn() === playerSide && piece.pieceType.startsWith(playerSide)
          },
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            lastDropAt.current = Date.now()
            return Boolean(targetSquare && playUserMove(sourceSquare as Square, targetSquare as Square))
          },
          onSquareClick: ({ square }) => chooseSquare(square as Square),
        }} />
        {displayedBadge && (
          <div className={`move-badge ${displayedBadge.tone}`} style={badgePosition(displayedBadge.square, playerSide)} title={displayedBadge.label} aria-label={displayedBadge.label}>
            {displayedBadge.tone === 'theory'
              ? '📖'
              : displayedBadge.symbol}
          </div>
        )}
        {mateLoserSquare && <div className="king-result-badge loss" style={badgePosition(mateLoserSquare, playerSide)} aria-label={t('kingLost')}>×</div>}
        {mateWinnerSquare && <div className="king-result-badge win" style={badgePosition(mateWinnerSquare, playerSide)} aria-label={t('kingWon')}>♛</div>}
      </section>

      <div className="material-row player-material" aria-label={t('yourMaterial')}>
        <span>{t('youColor', { color: colorName(playerSide) })}</span>
        <b>{playerCaptured.pieces.join(' ') || '—'} {playerMaterialAdvantage > 0 ? `+${playerMaterialAdvantage}` : ''}</b>
      </div>

      <section className="game-controls">
        <div><span className={thinking ? 'status-dot thinking' : 'status-dot'} />{gameFinished ? t('gameFinished') : thinking ? t('stockfishThinkingShort') : game.current.turn() === playerSide ? t('yourTurn') : t('stockfishTurn')}</div>
        <span>{screen === 'rating' ? t('noHints') : freePlay ? `${strength === 3000 ? 'MAX' : strength} Elo` : `${step}/${activeScenario.steps.length}`}</span>
      </section>

      {engineFailure && !thinking && <button className="secondary engine-retry" onClick={retryFailedEngine}>{t(engineFailure === 'rating-evaluation' ? 'retryEvaluation' : 'retryEngine')} →</button>}

      {screen === 'train' && !freePlay && mode !== 'exam' && step > 0 && !thinking && (
        <button className="secondary lesson-back" onClick={rewindLesson}>← {t('rewindLesson')}</button>
      )}

      {screen !== 'rating' && freePlay && !gameFinished && !analysisOpen && (
        <div className="end-controls">
          <button onClick={() => void offerDraw()} disabled={thinking || game.current.turn() !== trainingColor}>{t('offerDraw')}</button>
          <button className="danger" onClick={resignGame} disabled={thinking}>{t('resign')}</button>
        </div>
      )}

      {screen === 'rating' && ratingStage === 'between' && (
        <button className="primary" onClick={() => startRating('b')}>{t('playBlackGame')} <span>→</span></button>
      )}

      {screen === 'rating' && ratingResult && (
        <section className="rating-result">
          <small>{t('approximateRating')}</small>
          <strong>≈ {ratingResult.center}</strong>
          <p>{t('ratingResults', { low: ratingResult.low, high: ratingResult.high, accuracy: ratingResult.accuracy, errors: ratingResult.seriousErrors, blunders: ratingResult.blunders })}</p>
          <button className="primary" onClick={() => startRating('w')}>{t('ratingRepeat')} <span>→</span></button>
        </section>
      )}

      {gameFinished && !analysisOpen && gameHistory.current.length > 0 && (
        <button className="primary analysis-start" onClick={() => void analyseGame()}>{t('analyseWholeGame')} <span>→</span></button>
      )}

    </main>
  )
}

export default App
