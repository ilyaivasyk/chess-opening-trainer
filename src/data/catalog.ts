import type { Locale } from '../i18n/locale'

export type CourseCategory = 'beginner' | 'intermediate' | 'advanced'
export type CourseAccess = 'free' | 'premium'
export type CourseCatalogEntry = {
  id: string
  name: string
  category: CourseCategory
  eco: string
  access: CourseAccess
  source: string
}

type CatalogRow = readonly [id: string, category: CourseCategory, eco: string, uk: string, en: string]

// Names and ECO families follow the CC0 Lichess opening index. The native-only
// lesson asset contains the actual training lines; this file is safe to bundle.
// https://github.com/lichess-org/chess-openings
const rows: CatalogRow[] = [
  ['italian', 'beginner', 'C50', 'Італійська партія', 'Italian Game'],
  ['london', 'beginner', 'D02', 'Лондонська система', 'London System'],
  ['queens-gambit', 'beginner', 'D06', 'Ферзевий гамбіт', "Queen's Gambit"],
  ['caro-kann', 'beginner', 'B10', 'Захист Каро — Канн', 'Caro-Kann Defense'],
  ['qgd', 'beginner', 'D30', 'Відхилений ферзевий гамбіт', "Queen's Gambit Declined"],
  ['scotch', 'beginner', 'C45', 'Шотландська партія', 'Scotch Game'],
  ['vienna', 'beginner', 'C25', 'Віденська партія', 'Vienna Game'],
  ['four-knights', 'beginner', 'C47', 'Дебют чотирьох коней', 'Four Knights Game'],
  ['french', 'beginner', 'C00', 'Французький захист', 'French Defense'],
  ['scandinavian', 'beginner', 'B01', 'Скандинавський захист', 'Scandinavian Defense'],
  ['pirc', 'beginner', 'B07', 'Захист Пірца', 'Pirc Defense'],
  ['alekhine', 'beginner', 'B02', 'Захист Алехіна', "Alekhine's Defense"],
  ['kings-gambit', 'beginner', 'C30', 'Королівський гамбіт', "King's Gambit"],
  ['center-game', 'beginner', 'C21', 'Центральна партія', 'Center Game'],
  ['bishops-opening', 'beginner', 'C23', 'Дебют слона', "Bishop's Opening"],
  ['philidor', 'beginner', 'C41', 'Захист Філідора', 'Philidor Defense'],
  ['petrov', 'beginner', 'C42', 'Російська партія', 'Petrov Defense'],
  ['slav', 'beginner', 'D10', 'Слов’янський захист', 'Slav Defense'],
  ['dutch', 'beginner', 'A80', 'Голландський захист', 'Dutch Defense'],
  ['queens-pawn', 'beginner', 'D00', 'Дебют ферзевого пішака', "Queen's Pawn Game"],

  ['ruy-lopez', 'intermediate', 'C60', 'Іспанська партія', 'Ruy Lopez'],
  ['sicilian', 'intermediate', 'B20', 'Сицилійський захист', 'Sicilian Defense'],
  ['english', 'intermediate', 'A10', 'Англійський початок', 'English Opening'],
  ['reti', 'intermediate', 'A04', 'Дебют Реті', 'Réti Opening'],
  ['catalan', 'intermediate', 'E00', 'Каталонський початок', 'Catalan Opening'],
  ['trompowsky', 'intermediate', 'A45', 'Атака Тромповського', 'Trompowsky Attack'],
  ['colle', 'intermediate', 'D04', 'Система Колле', 'Colle System'],
  ['torre', 'intermediate', 'A46', 'Атака Торре', 'Torre Attack'],
  ['bird', 'intermediate', 'A02', 'Дебют Берда', "Bird's Opening"],
  ['modern', 'intermediate', 'B06', 'Сучасний захист', 'Modern Defense'],
  ['owens', 'intermediate', 'B00', 'Захист Оуена', "Owen's Defense"],
  ['budapest', 'intermediate', 'A51', 'Будапештський гамбіт', 'Budapest Gambit'],
  ['queens-indian', 'intermediate', 'E12', 'Ферзево-індійський захист', "Queen's Indian Defense"],
  ['bogo-indian', 'intermediate', 'E11', 'Захист Боголюбова', 'Bogo-Indian Defense'],
  ['semi-slav', 'intermediate', 'D43', 'Напівслов’янський захист', 'Semi-Slav Defense'],
  ['larsen', 'intermediate', 'A01', 'Дебют Ларсена', "Larsen's Opening"],
  ['polish', 'intermediate', 'A00', 'Польський дебют', 'Polish Opening'],
  ['kings-indian-attack', 'intermediate', 'A07', 'Староіндійський початок', "King's Indian Attack"],
  ['stonewall-dutch', 'intermediate', 'A84', 'Голландський Стоунвол', 'Stonewall Dutch'],
  ['benko-gambit', 'intermediate', 'A57', 'Гамбіт Бенко', 'Benko Gambit'],

  ['kings-indian', 'advanced', 'E60', 'Староіндійський захист', "King's Indian Defense"],
  ['nimzo-indian', 'advanced', 'E20', 'Захист Німцовича', 'Nimzo-Indian Defense'],
  ['grunfeld', 'advanced', 'D70', 'Захист Грюнфельда', 'Grünfeld Defense'],
  ['najdorf', 'advanced', 'B90', 'Сицилійський варіант Найдорфа', 'Sicilian Najdorf'],
  ['dragon', 'advanced', 'B70', 'Сицилійський Дракон', 'Sicilian Dragon'],
  ['sveshnikov', 'advanced', 'B33', 'Сицилійський варіант Свєшнікова', 'Sicilian Sveshnikov'],
  ['maroczy-bind', 'advanced', 'B36', 'Побудова Мароці', 'Maróczy Bind'],
  ['taimanov', 'advanced', 'B45', 'Сицилійський варіант Тайманова', 'Sicilian Taimanov'],
  ['scheveningen', 'advanced', 'B80', 'Сицилійський Схевенінген', 'Sicilian Scheveningen'],
  ['benoni', 'advanced', 'A60', 'Сучасний Беноні', 'Modern Benoni'],
  ['ragozin', 'advanced', 'D37', 'Захист Рагозіна', 'Ragozin Defense'],
  ['meran', 'advanced', 'D47', 'Меранський варіант', 'Meran Variation'],
  ['berlin', 'advanced', 'C65', 'Берлінський захист', 'Berlin Defense'],
  ['marshall-attack', 'advanced', 'C89', 'Атака Маршалла', 'Marshall Attack'],
  ['open-ruy', 'advanced', 'C80', 'Відкрита іспанська партія', 'Open Ruy Lopez'],
  ['kings-indian-samisch', 'advanced', 'E80', 'Варіант Земіша', 'Sämisch Variation'],
  ['nimzo-samisch', 'advanced', 'E24', 'Земіш проти захисту Німцовича', 'Sämisch Nimzo-Indian'],
  ['grunfeld-exchange', 'advanced', 'D85', 'Розмінний захист Грюнфельда', 'Grünfeld Exchange'],
  ['catalan-open', 'advanced', 'E04', 'Відкритий каталонський початок', 'Open Catalan'],
  ['french-winawer', 'advanced', 'C15', 'Французький варіант Вінавера', 'French Winawer'],
]

export const freeCourseIds = [
  'italian', 'london', 'queens-gambit', 'caro-kann', 'qgd',
  'ruy-lopez', 'sicilian', 'english',
  'kings-indian', 'nimzo-indian', 'grunfeld',
] as const

const freeIds = new Set<string>(freeCourseIds)

export function getCatalog(locale: Locale): CourseCatalogEntry[] {
  return rows.map(([id, category, eco, uk, en]) => ({
    id, category, eco,
    name: locale === 'en' ? en : uk,
    access: freeIds.has(id) ? 'free' : 'premium',
    source: `https://github.com/lichess-org/chess-openings/blob/master/${eco[0].toLowerCase()}.tsv`,
  }))
}
