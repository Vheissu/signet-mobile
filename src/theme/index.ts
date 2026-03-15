/**
 * Signet Mobile Design Tokens
 *
 * Matches the browser extension's dark purple theme exactly.
 * All color values, spacing, radii, and typography are defined here.
 */

// --- Colors ---

export const colors = {
  // Backgrounds
  bg: '#1A1128',
  surface: '#231838',
  surfaceElevated: '#2D2145',
  surfaceOverlay: '#3A2D55',
  surfaceCard: '#2A1E42',

  // Brand: Hive
  hive: '#E31337',
  hiveLight: '#FF2D50',
  hiveDark: '#B80F2C',

  // Brand: Coral accents
  coral: '#F4845F',
  coralLight: '#F7A084',

  // Semantic
  success: '#5CEAA0',
  warning: '#FFD166',
  error: '#EF476F',
  info: '#63B3ED',

  // Text
  textPrimary: '#F0ECF5',
  textSecondary: '#A99BBF',
  textTertiary: '#7A6B8F',

  // Borders
  border: 'rgba(255, 255, 255, 0.06)',
  borderAccent: 'rgba(227, 19, 55, 0.2)',

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

export type ColorKey = keyof typeof colors;

// --- Typography ---

export const fonts = {
  // Source Sans 3 is the target; falls back to system font on mobile
  regular: 'SourceSans3-Regular',
  medium: 'SourceSans3-Medium',
  semiBold: 'SourceSans3-SemiBold',
  bold: 'SourceSans3-Bold',
  // System font fallback (used when custom fonts haven't loaded)
  system: 'System',
} as const;

export const fontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 40,
} as const;

export const lineHeights = {
  xs: 16,
  sm: 18,
  md: 22,
  lg: 24,
  xl: 28,
  xxl: 32,
  xxxl: 40,
  display: 48,
} as const;

// --- Spacing ---

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
  section: 48,
} as const;

// --- Border Radii ---

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  full: 9999,
} as const;

// --- Shadows ---

export const shadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;

// --- Animation ---

export const animation = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;

// --- Composite Theme Object ---

export const theme = {
  colors,
  fonts,
  fontSizes,
  lineHeights,
  spacing,
  radii,
  shadows,
  animation,
} as const;

export type Theme = typeof theme;

export default theme;
