import type { MantineColorsTuple } from '@mantine/core';
import { createTheme } from '@mantine/core';

export const brand = {
  navy: '#071D35',
  tealDeep: '#063F46',
  teal: '#0C7774',
  gold: '#C99A3D',
  goldLight: '#E5C46A',
  ivory: '#F8F6F0',
  sand: '#EEE9DD',
  border: '#E2D9C8',
  muted: '#5C6B73',
  success: '#2E7D5B',
  warning: '#C9842A',
  danger: '#C4473A',
  tealSoft: '#E7F3F2',
  goldSoft: '#F8F0DC',
} as const;

export const cardStyle = {
  backgroundColor: brand.ivory,
  border: `1px solid ${brand.border}`,
  boxShadow: '0 4px 14px rgba(7, 29, 53, 0.07)',
} as const;

export const LEGACY_PRIMARY = new Set(['#8B7355', '#8b7355']);
export const LEGACY_ACCENT = new Set(['#6F5C45', '#6f5c45']);
export const LEGACY_APP_NAMES = new Set([
  'Hujjaj',
  'حجاج',
  'Hujjaj Hajj & Omra',
  'حجاج للحج والعمرة',
]);

export const tealPalette: MantineColorsTuple = [
  '#E7F3F2',
  '#C8E4E2',
  '#96CBC8',
  '#5EAAA6',
  '#2E8F8B',
  '#0C7774',
  '#063F46',
  '#05353B',
  '#042A2F',
  '#071D35',
];

export const goldPalette: MantineColorsTuple = [
  '#FBF6EA',
  '#F4E6C4',
  '#E5C46A',
  '#D4B054',
  '#C99A3D',
  '#B88932',
  '#A07828',
  '#7A5C1E',
  '#534013',
  '#2E240A',
];

export const appTheme = createTheme({
  fontFamily: "'Tajawal', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  primaryColor: 'teal',
  defaultRadius: 'lg',
  colors: {
    teal: tealPalette,
    gold: goldPalette,
    brown: tealPalette,
  },
  shadows: {
    sm: '0 1px 2px rgba(7, 29, 53, 0.06)',
    md: '0 4px 14px rgba(7, 29, 53, 0.07)',
    lg: '0 12px 32px rgba(7, 29, 53, 0.12)',
  },
  headings: {
    fontFamily: "'Tajawal', sans-serif",
    fontWeight: '700',
  },
  components: {
    Button: {
      defaultProps: { radius: 'md' },
    },
    Paper: {
      defaultProps: { radius: 'lg' },
    },
    Card: {
      defaultProps: { radius: 'lg' },
    },
  },
});
