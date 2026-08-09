/**
 * Crewly Theme — Colors
 *
 * Construction-themed palette:
 * - Deep navy/slate for authority and professionalism
 * - Amber/orange accents for energy and action (construction hi-vis inspiration)
 * - Concrete grays for surfaces and backgrounds
 * - Status colors for flags (red=danger, amber=warning, green=good)
 */

export const colors = {
  // Primary — Deep construction navy
  primary: {
    50: '#E8EDF5',
    100: '#C5D0E6',
    200: '#9EB1D4',
    300: '#7791C2',
    400: '#597AB5',
    500: '#3B63A8',
    600: '#2F5296',
    700: '#1E3F7E',
    800: '#122D66',
    900: '#0A1D4A',
  },

  // Accent — Hi-vis amber/orange
  accent: {
    50: '#FFF8E1',
    100: '#FFECB3',
    200: '#FFE082',
    300: '#FFD54F',
    400: '#FFCA28',
    500: '#FFC107',
    600: '#FFB300',
    700: '#FFA000',
    800: '#FF8F00',
    900: '#FF6F00',
  },

  // Neutral — Concrete grays
  neutral: {
    0: '#FFFFFF',
    50: '#F8F9FA',
    100: '#F1F3F5',
    200: '#E9ECEF',
    300: '#DEE2E6',
    400: '#CED4DA',
    500: '#ADB5BD',
    600: '#868E96',
    700: '#495057',
    800: '#343A40',
    900: '#212529',
    1000: '#000000',
  },

  // Semantic — Status colors
  success: {
    light: '#D4EDDA',
    main: '#28A745',
    dark: '#1E7E34',
  },
  warning: {
    light: '#FFF3CD',
    main: '#FFC107',
    dark: '#D39E00',
  },
  danger: {
    light: '#F8D7DA',
    main: '#DC3545',
    dark: '#BD2130',
  },
  info: {
    light: '#D1ECF1',
    main: '#17A2B8',
    dark: '#117A8B',
  },

  // Background colors
  background: {
    primary: '#F8F9FA',
    secondary: '#FFFFFF',
    card: '#FFFFFF',
    input: '#F1F3F5',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  // Text colors
  text: {
    primary: '#212529',
    secondary: '#495057',
    tertiary: '#868E96',
    inverse: '#FFFFFF',
    link: '#3B63A8',
  },

  // Role-specific accent colors (for dashboards, badges)
  role: {
    owner: '#3B63A8',        // Navy blue
    super_supervisor: '#7C3AED', // Purple
    site_supervisor: '#FF8F00',  // Amber
    accountant: '#059669',       // Teal green
  },

  // Sync status
  sync: {
    synced: '#28A745',
    pending: '#FFC107',
    conflict: '#DC3545',
    offline: '#868E96',
  },
} as const;

export type ColorToken = typeof colors;
