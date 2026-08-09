import { Platform } from 'react-native';

/**
 * Typography scale — uses system fonts for native feel
 * Inter would be ideal but requires bundling; system fonts
 * are fast and reliable across devices.
 */

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography = {
  fontFamily,

  // Font sizes
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },

  // Font weights (as string values for React Native)
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // Line heights (multiplied from font size)
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Predefined text styles
  heading1: {
    fontSize: 30,
    fontWeight: '700' as const,
    lineHeight: 36,
  },
  heading2: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 30,
  },
  heading3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 26,
  },
  heading4: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  caption: {
    fontSize: 11,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  button: {
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 18,
  },
} as const;

export type TypographyToken = typeof typography;
