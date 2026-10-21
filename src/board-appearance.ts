export const BOARD_THEMES = {
  classic: { light: '#d8cfb6', dark: '#6f8b7e' },
  walnut: { light: '#ead9b5', dark: '#986d4e' },
  blue: { light: '#dee8ed', dark: '#5c7d96' },
} as const

export type BoardTheme = keyof typeof BOARD_THEMES

export function getBoardTheme(value: unknown): BoardTheme {
  return value === 'classic' || value === 'walnut' || value === 'blue' ? value : 'classic'
}
